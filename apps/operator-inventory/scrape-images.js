// Offline importer: run node scrape-images.js. Never runs during inventory entry.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const catalog = require('./catalog.json');
const sources = require('./image-sources.json');
const root = path.join(__dirname, 'public', 'images');
const manifestPath = path.join(root, 'manifest.json');
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : { items:{} };
const decode = text => text.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const normalized = text => String(text).replace(/[^a-z0-9]/gi, '').toLowerCase();
async function request(url) {
  const response = await fetch(url, { signal:AbortSignal.timeout(18000), headers:{ 'User-Agent':'OperatorInventory-ImageImporter/1.0' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response;
}
function findImage(html, sku) {
  if (!sku || /^(?:N\/?A|\?+)$/i.test(sku)) return [];
  const candidates = [];
  function visit(value) {
    if (!value || typeof value !== 'object') return;
    const types = [].concat(value['@type'] || []);
    if (types.includes('Product') && normalized(value.sku || value.mpn || '') === normalized(sku)) {
      for (const image of [].concat(value.image || [])) candidates.push(typeof image === 'string' ? image : image.url || image.contentUrl);
    }
    for (const child of Object.values(value)) if (typeof child === 'object') {
      if (Array.isArray(child)) child.forEach(visit); else visit(child);
    }
  }
  for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { visit(JSON.parse(match[1])); } catch { /* Ignore malformed supplier metadata. */ }
  }
  // Product hero metadata is only accepted if the exact SKU is present on the page.
  if (normalized(html).includes(normalized(sku))) {
    for (const tag of html.matchAll(/<meta\b[^>]*>/gi)) {
      const attrs = Object.fromEntries([...tag[0].matchAll(/([\w:-]+)=["']([^"']*)["']/g)].map(m => [m[1].toLowerCase(),decode(m[2])]));
      if (['og:image','twitter:image'].includes(attrs.property || attrs.name)) candidates.push(attrs.content);
    }
    // Older Hach pages use a product-specific image rather than social metadata.
    for (const tag of html.matchAll(/<img\b[^>]*>/gi)) {
      const attrs = Object.fromEntries([...tag[0].matchAll(/([\w:-]+)=["']([^"']*)["']/g)].map(m => [m[1].toLowerCase(),decode(m[2])]));
      if (normalized(attrs.alt || '').includes(normalized(sku)) || /product(?:Detail|Image|_image|-image)/i.test(attrs.class || attrs.id || '')) candidates.push(attrs.src || attrs['data-src']);
    }
  }
  return [...new Set(candidates.filter(Boolean))].filter(url => !/logo|placeholder|no[_-]?image|photo[-_ ]coming[-_ ]soon/i.test(url));
}
function imageExtension(bytes) {
  return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff ? 'jpg'
    : bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'png'
    : bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP' ? 'webp'
    : /^GIF8[79]a$/.test(bytes.toString('ascii',0,6)) ? 'gif' : null;
}
async function main() {
  fs.mkdirSync(root, { recursive:true });
  const report = Object.entries(manifest.items).map(([id, photo]) => ({ id, description:photo.description, productUrl:photo.productUrl, status:'cached', attempts:[] }));
  const pending = catalog.items.filter(item => (item.productUrl || sources[item.id]) && !manifest.items[item.id]);
  async function scrape(item) {
    const result = { id:item.id, description:item.description, productUrl:item.productUrl, status:'unavailable', attempts:[] };
    // Workbook says 5.25 N; the linked supplier page describes 19.2 N.
    if (item.id === 's1-r18') { result.status = 'needs-review'; result.attempts.push({error:'Workbook concentration and linked product concentration disagree'}); report.push(result); return; }
    const extra = sources[item.id]?.itemNumber === item.itemNumber ? sources[item.id].urls : [];
    const urls = [...extra, ...[item.productUrl].filter(Boolean)];
    const workbookUrls = new Set([item.productUrl].filter(Boolean));
    if (item.company === 'VWR' && item.itemNumber && !urls.some(url=>url.includes('www.nwsci.com'))) urls.unshift('https://www.nwsci.com/itemdetail/?itemCode=' + encodeURIComponent('VAN/' + item.itemNumber));
    // Official regional product pages retain the same Hach product number.
    if (item.productUrl && new URL(item.productUrl).hostname === 'www.hach.com') {
      const regional = new URL(item.productUrl); regional.hostname = 'sea.hach.com'; urls.push(regional.href);
      workbookUrls.add(regional.href);
      if (regional.pathname.endsWith('/product')) {
        regional.pathname = '/p-' + regional.pathname.split('/')[1] + '/' + item.itemNumber.replace(/-/g,'');
        regional.search = ''; urls.push(regional.href);
        workbookUrls.add(regional.href);
      }
    }
    for (const url of urls) {
      try {
        const page = await request(url), html = await page.text();
        if (process.env.IMAGE_IMPORT_DEBUG === '1') {
          const debug = path.join(__dirname,'preview','supplier-pages'); fs.mkdirSync(debug,{recursive:true});
          fs.writeFileSync(path.join(debug,`${item.id}-${new URL(url).hostname}.html`),html);
        }
        const images = findImage(html, item.itemNumber);
        if (!images.length) throw new Error('No product image with matching SKU metadata');
        for (const candidate of images) {
          const imageUrl = new URL(decode(candidate), page.url).href;
          try {
            const imagePath = new URL(imageUrl).pathname;
            const namedSku = path.basename(imagePath).match(/^([0-9]{5,}|LZY\d+|DPD\w+)/i)?.[1];
            if (new URL(imageUrl).hostname === 'cdn.hach.com' && namedSku && !normalized(namedSku).startsWith(normalized(item.itemNumber))) throw new Error('Photo filename identifies a different product number');
            const image = await request(imageUrl);
            const bytes = Buffer.from(await image.arrayBuffer());
            // Some suppliers serve JPEGs as application/octet-stream. Validate bytes.
            const ext = imageExtension(bytes);
            if (!ext) throw new Error('Not a supported raster image');
            if (bytes.length < 500 || bytes.length > 5000000) throw new Error('Unexpected image size');
            const filename = `${item.id}.${ext}`;
            fs.writeFileSync(path.join(root, filename), bytes);
            manifest.items[item.id] = { description:item.description, itemNumber:item.itemNumber, src:`/images/${filename}`, productUrl:page.url, imageUrl, sourceType:workbookUrls.has(url) ? 'workbook-link' : 'additional-search', sourceUrl:url, fetchedAt:new Date().toISOString() };
            result.status = 'downloaded'; break;
          } catch (error) { result.attempts.push({ url:imageUrl, error:error.message }); }
        }
        if (result.status === 'downloaded') break;
      } catch (error) { result.attempts.push({ url, error:error.message }); }
    }
    console.log(`${result.status}: ${item.description}`); report.push(result);
  }
  // Limit supplier traffic to two concurrent requests.
  let cursor = 0;
  await Promise.all([0,1].map(async () => { while (cursor < pending.length) await scrape(pending[cursor++]); }));
  manifest.updatedAt = new Date().toISOString();
  fs.writeFileSync(manifestPath, JSON.stringify(manifest,null,2) + '\n');
  fs.writeFileSync(path.join(__dirname,'image-import-report.json'), JSON.stringify({ generatedAt:manifest.updatedAt, noLink:catalog.items.filter(i=>!i.productUrl).map(i=>({id:i.id,description:i.description})), results:report },null,2) + '\n');
  console.log(`${Object.keys(manifest.items).length} local product photos; ${catalog.items.filter(i=>!i.productUrl).length} items have no workbook link.`);
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode=1; });
module.exports = { findImage, imageExtension };
