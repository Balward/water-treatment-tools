'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const seedCatalog = require('./catalog.json');
const packSizes = require('./public/pack-sizes');
const imageManifest = require('./public/images/manifest.json');
const { createMailer, buildReportEmail, validAddress } = require('./email');
const worksheets = [
  { id: 'operating', name: 'Operating Supplies', sourceSheet: 1 },
  { id: 'janitorial', name: 'Janitorial Supplies', sourceSheet: 2 },
  { id: 'dewatering', name: 'Dewatering Inventory', sourceSheet: 3 }
];

function createApp({ dataDir = process.env.DATA_DIR || path.join(__dirname, 'data'), mailer = createMailer() } = {}) {
  let sendingEmail = false, nextEmailAt = 0;
  const releaseHash = createHash('sha256');
  for (const name of ['server.js', 'email.js', 'catalog.json', 'public/images/manifest.json', 'public/index.html', 'public/styles.css', 'public/app.js', 'public/pack-sizes.js', 'public/branding/northglenn-logo.png']) releaseHash.update(fs.readFileSync(path.join(__dirname, name)));
  const release = releaseHash.digest('hex').slice(0, 12);
  fs.mkdirSync(dataDir, { recursive: true });
  const file = path.join(dataDir, 'inventories.json');
  let state = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { inventories: [] };
  const currentCatalog = () => ({...seedCatalog, items:(state.catalogItems || seedCatalog.items).map(packSizes.normalize), revision:state.catalogRevision || 0});
  const persist = next => {
    const temp = file + '.tmp';
    const fd = fs.openSync(temp, 'w');
    try { fs.writeFileSync(fd, JSON.stringify(next, null, 2)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    fs.renameSync(temp, file);
    state = next;
  };
  // Remove the old combined records from persisted storage on upgrade.
  const retained = state.inventories.filter(run => run.worksheet !== 'legacy' && new Set(run.items.map(item => item.sourceSheet)).size <= 1);
  const removed = state.inventories.length - retained.length;
  if (removed) {
    persist({ ...state, inventories: retained });
    console.log(`Removed ${removed} old combined inventories.`);
  }
  const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
  function metadata(body) {
    if (typeof body.operator !== 'string' || !body.operator.trim() || body.operator.trim().length > 100) fail(400, 'Enter an operator name (up to 100 characters).');
    if (typeof body.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.date) || !Number.isFinite(Date.parse(body.date)) || new Date(body.date).toISOString().slice(0, 10) !== body.date) fail(400, 'Choose a valid inventory date.');
  }
  function summary(run) {
    const counted = Object.keys(run.counts).length;
    const low = run.items.filter(i => typeof run.counts[i.id] === 'number' && i.par !== null && run.counts[i.id] <= i.par).length;
    return { id: run.id, worksheet: run.worksheet, date: run.date, operator: run.operator, status: run.status, updatedAt: run.updatedAt, counted, total: run.items.length, low };
  }
  async function bodyOf(req) {
    let body = ''; for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body) > 100000) fail(413, 'Request is too large.'); }
    let parsed;
    try { parsed = JSON.parse(body); } catch { fail(400, 'Invalid JSON.'); }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) fail(400, 'Provide a JSON object.');
    return parsed;
  }
  return http.createServer(async (req, res) => {
    const json = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Inventory-Version': release }); res.end(JSON.stringify(data)); };
    try {
      const url = new URL(req.url, 'http://localhost');
      const route = url.pathname;
      if (route === '/api/health' && req.method === 'GET') return json(200, { ok: true });
      if (route === '/api/email-config' && req.method === 'GET') return json(200, { enabled:mailer.enabled, defaultTo:mailer.defaultTo });
      if (route === '/api/catalog' && req.method === 'GET') return json(200, { ...currentCatalog(), worksheets, images:imageManifest.items });
      const itemMatch = route.match(/^\/api\/catalog\/items\/([a-z0-9-]+)$/);
      if ((route === '/api/catalog/items' && req.method === 'POST') || (itemMatch && ['PATCH','DELETE'].includes(req.method))) {
        let origin;
        try { origin = new URL(req.headers.origin); } catch { fail(403,'Manage items from the inventory app.'); }
        if (!['http:','https:'].includes(origin.protocol) || origin.host !== req.headers.host) fail(403,'Manage items from the inventory app.');
        const body = await bodyOf(req), catalog = currentCatalog();
        if (body.revision !== catalog.revision) fail(409,'The item list changed in another browser. Reopen Manage items and try again.');
        const existing = itemMatch && catalog.items.find(item => item.id === itemMatch[1]);
        if (itemMatch && !existing) fail(404,'Item was not found.');
        let items;
        if (req.method === 'DELETE') items = catalog.items.filter(item => item.id !== existing.id);
        else {
          const worksheet = worksheets.find(w => w.id === body.worksheet);
          if (!worksheet) fail(400,'Choose a worksheet.');
          const field = (name, required = false, max = 200) => {
            if (body[name] !== undefined && body[name] !== null && typeof body[name] !== 'string') fail(400,`Invalid ${name}.`);
            const value = (body[name] || '').trim();
            if ((required && !value) || value.length > max) fail(400,`Enter ${name} (${required ? 'required, ' : ''}up to ${max} characters).`);
            return value;
          };
          const productUrl = field('productUrl',false,2000);
          if (productUrl) {
            let url; try { url = new URL(productUrl); } catch { fail(400,'Enter a valid product page URL.'); }
            if (!['http:','https:'].includes(url.protocol) || url.username || url.password) fail(400,'Use an HTTP or HTTPS product page URL without credentials.');
          }
          if (body.par !== null && (typeof body.par !== 'number' || !Number.isFinite(body.par) || body.par < 0 || body.par > 1000000000)) fail(400,'PAR must be a nonnegative number, or blank for manual review.');
          const item = {...existing,id:existing?.id || 'custom-' + randomUUID(),sourceSheet:worksheet.sourceSheet,sourceRow:existing?.sourceRow || null,category:worksheet.name,description:field('description',true),location:field('location',true),countSize:field('countSize',true),par:body.par,parNote:field('parNote'),company:field('company'),itemNumber:field('itemNumber'),caseSize:field('caseSize'),productUrl};
          items = existing ? catalog.items.map(old => old.id === item.id ? item : old) : [...catalog.items,item];
        }
        persist({...state,catalogItems:items,catalogRevision:catalog.revision + 1});
        return json(req.method === 'POST' ? 201 : 200,{...currentCatalog(),worksheets,images:imageManifest.items});
      }
      if (route === '/api/inventories' && req.method === 'GET') return json(200, state.inventories.map(summary).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)));
      if (route === '/api/inventories' && req.method === 'POST') {
        const body = await bodyOf(req); metadata(body);
        const worksheet = worksheets.find(w => w.id === body.worksheet);
        if (!worksheet) fail(400, 'Choose Operating Supplies, Janitorial Supplies, or Dewatering Inventory.');
        const items = structuredClone(currentCatalog().items.filter(i => i.sourceSheet === worksheet.sourceSheet));
        if (!items.length) fail(400,'This worksheet has no items. Add items before starting inventory.');
        const previous = state.inventories.filter(r => r.worksheet === worksheet.id && r.status === 'complete').sort((a,b) => b.date.localeCompare(a.date) || (b.completedAt || b.updatedAt).localeCompare(a.completedAt || a.updatedAt))[0];
        const previousCounts = {};
        for (const item of items) {
          // Row numbers can move on re-import. Only reuse matching names, units, and locations.
          const matches = previous?.items.filter(old => packSizes.normalize(old).description === item.description && packSizes.countSize(old) === item.countSize && old.location === item.location) || [];
          const old = matches.length === 1 ? matches[0] : matches.find(old => old.id === item.id);
          const value = old ? previous.counts[old.id] : undefined;
          if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1000000000) previousCounts[item.id] = value;
        }
        const run = { id: randomUUID(), worksheet: worksheet.id, date: body.date, operator: body.operator.trim(), status: 'draft', revision: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), counts: {}, items, previousCounts, sourceInventoryId: previous?.id || null, sourceInventoryDate: previous?.date || null };
        persist({ ...state, inventories: [...state.inventories, run] }); return json(201, run);
      }
      const emailMatch = route.match(/^\/api\/inventories\/([a-f0-9-]+)\/email$/);
      if (emailMatch && req.method === 'POST') {
        let origin;
        try { origin = new URL(req.headers.origin); } catch { fail(403, 'Send email from the inventory app.'); }
        if (!['http:','https:'].includes(origin.protocol) || origin.host !== req.headers.host) fail(403, 'Send email from the inventory app.');
        if (!mailer.enabled) fail(503, 'Email sending has not been configured on the server.');
        const body = await bodyOf(req);
        if (!validAddress(body.to)) fail(400, 'Enter one valid recipient email address.');
        const inventory = state.inventories.find(r => r.id === emailMatch[1]);
        if (!inventory) fail(404, 'Inventory was not found.');
        if (body.revision !== inventory.revision) fail(409, 'This inventory changed. Reopen the report before emailing it.');
        if (sendingEmail || Date.now() < nextEmailAt) fail(429, 'Please wait 30 seconds before sending another email.');
        sendingEmail = true;
        try {
          await mailer.send(body.to, buildReportEmail(inventory, worksheets.find(w => w.id === inventory.worksheet)?.name || 'Inventory'));
          nextEmailAt = Date.now() + 30000;
          return json(200, { accepted:true, to:body.to });
        } catch (error) {
          console.error('Report email failed:', error.code || 'SMTP_SEND_FAILED');
          nextEmailAt = Date.now() + 5000;
          fail(502, 'Could not confirm email acceptance. Check the recipient inbox before retrying, then check the server email settings.');
        } finally { sendingEmail = false; }
      }
      const match = route.match(/^\/api\/inventories\/([a-f0-9-]+)$/);
      if (match) {
        const run = state.inventories.find(r => r.id === match[1]);
        if (!run) fail(404, 'Inventory was not found.');
        if (req.method === 'GET') return json(200, run);
        if (req.method === 'DELETE') {
          const body = await bodyOf(req);
          const current = state.inventories.find(r => r.id === match[1]);
          if (!current) fail(404, 'Inventory was not found.');
          if (body.revision !== current.revision) fail(409, 'This inventory changed elsewhere. Open the delete confirmation again to review it.');
          persist({ ...state, inventories:state.inventories.filter(r => r.id !== current.id) });
          return json(200, { deleted:current.id });
        }
        if (req.method === 'PATCH') {
          const body = await bodyOf(req);
          // Re-read after awaiting the request: another request may have saved in the meantime.
          const current = state.inventories.find(r => r.id === match[1]);
          if (!current) fail(404, 'This inventory was deleted.');
          if (body.revision !== current.revision) fail(409, 'This inventory changed in another browser. Reload it before making more changes.');
          if (current.status === 'complete') fail(409, 'Completed inventories are read-only. Start a new inventory for a new count.');
          if (!body.counts || typeof body.counts !== 'object' || Array.isArray(body.counts)) fail(400, 'Provide item counts.');
          const counts = { ...current.counts };
          for (const [id, count] of Object.entries(body.counts)) {
            if (!current.items.some(i => i.id === id)) fail(400, 'Unknown inventory item.');
            if (count === null) { delete counts[id]; continue; }
            if (typeof count !== 'number' || !Number.isFinite(count) || count < 0 || count > 1000000000) fail(400, 'Counts must be numbers from 0 to 1,000,000,000.');
            counts[id] = count;
          }
          if (body.status !== undefined && !['draft', 'complete'].includes(body.status)) fail(400, 'Invalid inventory status.');
          if (body.status === 'complete' && current.items.some(i => counts[i.id] === undefined)) fail(400, 'Count every item before completing inventory. Use 0 for items with no stock.');
          const updated = { ...current, counts, status: body.status || current.status, revision: current.revision + 1, updatedAt: new Date().toISOString() };
          if (updated.status === 'complete') updated.completedAt = updated.updatedAt;
          persist({ ...state, inventories: state.inventories.map(r => r.id === updated.id ? updated : r) }); return json(200, updated);
        }
      }
      if (route.startsWith('/api/')) return json(404, { error: 'Endpoint not found.' });
      if (!['GET', 'HEAD'].includes(req.method)) return json(405, { error: 'Method not allowed.' });
      const assets = { '/': 'index.html', '/index.html': 'index.html', '/app.js': 'app.js', '/pack-sizes.js':'pack-sizes.js', '/styles.css': 'styles.css', '/branding/northglenn-logo.png':'branding/northglenn-logo.png' };
      // Only filenames in the imported manifest are exposed, never arbitrary paths.
      for (const photo of Object.values(imageManifest.items)) {
        if (/^\/images\/s[123]-r\d+\.(jpg|png|webp|gif)$/.test(photo.src)) assets[photo.src] = photo.src.slice(1);
      }
      if (!assets[route]) return json(404, { error: 'Page not found.' });
      const asset = assets[route];
      const imageType = { '.jpg':'image/jpeg', '.png':'image/png', '.webp':'image/webp', '.gif':'image/gif' }[path.extname(asset)];
      res.writeHead(200, { 'Content-Type': imageType || (asset.endsWith('.css') ? 'text/css; charset=utf-8' : asset.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8'), 'Cache-Control': 'no-store', 'X-Inventory-Version': release, 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; frame-ancestors 'self'" });
      let content = fs.readFileSync(path.join(__dirname, 'public', asset));
      if (asset === 'index.html') content = content.toString('utf8').replace(/(href|src)="\.\/(styles\.css|app\.js|pack-sizes\.js)(?:\?[^\"]*)?"/g, (_, attr, name) => `${attr}="./${name}?v=${release}"`);
      res.end(req.method === 'HEAD' ? undefined : content);
    } catch (error) {
      if (!error.status) console.error(error);
      json(error.status || 500, { error: error.status ? error.message : 'Could not save or load inventory. Check server storage and try again.' });
    }
  });
}
if (require.main === module) {
  const server = createApp();
  server.listen(Number(process.env.PORT || 3080), '0.0.0.0', () => console.log(`Operator Inventory listening on port ${process.env.PORT || 3080}`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
}
module.exports = { createApp };
