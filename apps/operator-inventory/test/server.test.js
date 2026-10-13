const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../server');
const catalog = require('../catalog.json');

test('workbook catalog preserves location groups, units, fractional PAR and exceptions', () => {
  assert.equal(catalog.items.length, 72);
  assert.equal(new Set(catalog.items.map(i => i.location)).size, 8);
  assert.equal(catalog.items.find(i => i.description === 'XL 3 mil gloves').par, 0.5);
  assert.equal(catalog.items.find(i => i.description === 'pH 10 Buffer Singlets').location, 'Under Stairwell');
  assert.equal(catalog.items.find(i => i.description === 'White Rags').par, null);
  assert.equal(catalog.items.find(i => i.description === 'White Rags').parNote, 'Fill As Needed');
});

test('inventory lifecycle persists, validates counts, protects concurrent edits and completed records', async t => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'operator-inventory-test-'));
  let server = createApp({ dataDir });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => { await new Promise(resolve => server.close(resolve)); fs.rmSync(dataDir, { recursive:true, force:true }); });
  async function request(route, method = 'GET', body) {
    const response = await fetch(base + route, { method, headers:{ 'Content-Type':'application/json' }, ...(body ? { body:JSON.stringify(body) } : {}) });
    return { status:response.status, data:await response.json() };
  }
  assert.equal((await request('/api/health')).status, 200);
  assert.equal((await request('/api/inventories', 'POST', { operator:' ', date:'2026-10-08' })).status, 400);
  assert.equal((await request('/api/inventories', 'POST', { operator:'Blain', date:'2026-02-30' })).status, 400);
  const created = await request('/api/inventories', 'POST', { worksheet:'operating', operator:' Blain ', date:'2026-10-08' });
  assert.equal(created.status, 201);
  assert.equal(created.data.operator, 'Blain');
  const route = '/api/inventories/' + created.data.id;
  const first = created.data.items[0], fractional = created.data.items.find(i => i.par === 0.5);
  assert.equal((await request(route, 'PATCH', { revision:0, counts:{ [first.id]:-1 } })).status, 400);
  assert.equal((await request(route, 'PATCH', { revision:0, counts:{ [first.id]:'1' } })).status, 400);
  assert.equal((await request(route, 'PATCH', { revision:0, counts:{ unknown:1 } })).status, 400);
  const saved = await request(route, 'PATCH', { revision:0, counts:{ [first.id]:0, [fractional.id]:0.5 } });
  assert.equal(saved.status, 200);
  assert.equal(saved.data.revision, 1);
  assert.equal((await request('/api/inventories')).data[0].low, 2);
  assert.equal((await request(route, 'PATCH', { revision:0, counts:{ [first.id]:5 } })).status, 409);
  assert.equal((await request(route, 'PATCH', { revision:1, counts:{ [first.id]:null }, status:'complete' })).status, 400);
  const removed = await request(route, 'PATCH', { revision:1, counts:{ [first.id]:null } });
  assert.equal(Object.hasOwn(removed.data.counts, first.id), false);
  // Two simultaneous writers sharing a revision: exactly one may succeed.
  const concurrent = await Promise.all([request(route, 'PATCH', { revision:2, counts:{ [first.id]:1 } }), request(route, 'PATCH', { revision:2, counts:{ [first.id]:2 } })]);
  assert.deepEqual(concurrent.map(r => r.status).sort(), [200,409]);
  await new Promise(resolve => server.close(resolve));
  server = createApp({ dataDir });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  const restored = await request(route);
  assert.equal(restored.data.revision, 3);
  assert.equal(restored.data.counts[fractional.id], 0.5);
  const counts = Object.fromEntries(restored.data.items.map(i => [i.id,0]));
  const completed = await request(route, 'PATCH', { revision:3, counts, status:'complete' });
  assert.equal(completed.status, 200);
  assert.equal(completed.data.status, 'complete');
  assert.equal((await request('/api/inventories')).data[0].low, 40);
  assert.equal((await request(route, 'PATCH', { revision:4, counts:{ [first.id]:5 } })).status, 409);
  assert.equal((await request('/api/inventories')).data[0].counted, 40);
  const response = await fetch(base + '/'); assert.equal(response.status,200);
  const html = await response.text(); assert.match(html, /New Inventory/);
  const version = response.headers.get('x-inventory-version'); assert.match(version,/^[a-f0-9]{12}$/);
  assert.match(html, new RegExp('styles\\.css\\?v=' + version));
  assert.match(html, new RegExp('app\\.js\\?v=' + version));
  for (const asset of ['styles.css','app.js']) {
    const result = await fetch(base + '/' + asset + '?v=' + version);
    assert.equal(result.status,200); assert.equal(result.headers.get('x-inventory-version'),version);
    assert.equal(result.headers.get('cache-control'),'no-store');
    assert.ok(result.headers.get('content-type').includes(asset.endsWith('.css') ? 'text/css' : 'text/javascript'));
  }
  assert.equal((await fetch(base + '/server.js')).status,404);
  const media = (await request('/api/catalog')).data.images;
  const photo = media['s1-r6'];
  assert.equal(photo.itemNumber,'2770020');
  const imageResponse = await fetch(base + photo.src);
  assert.equal(imageResponse.status,200);
  assert.equal(imageResponse.headers.get('content-type'),'image/jpeg');
  assert.ok((await imageResponse.arrayBuffer()).byteLength > 500);
  assert.equal((await fetch(base + '/images/manifest.json')).status,404);
  assert.equal((await fetch(base + '/images/s1-r999.jpg')).status,404);
  assert.equal((await request(route, 'DELETE', { revision:3 })).status,409,'Stale confirmation cannot delete a changed inventory');
  assert.equal((await request(route)).status,200);
  assert.equal((await request(route, 'DELETE', { revision:4 })).status,200,'Completed inventories can be deleted');
  assert.equal((await request(route)).status,404);
  assert.equal((await request(route, 'DELETE', { revision:4 })).status,404);
  await new Promise(resolve => server.close(resolve));
  server = createApp({ dataDir });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  assert.deepEqual((await request('/api/inventories')).data,[],'Deletion persists after restart');
  const next = await request('/api/inventories','POST',{worksheet:'operating',operator:'Next operator',date:'2026-10-09'});
  assert.equal(next.data.sourceInventoryId,null,'Deleted completed inventory is not used for future previous counts');
  assert.equal((await request('/api/inventories/' + next.data.id,'DELETE',{revision:0})).status,200,'Draft inventories can be deleted');
});

test('new counts are isolated by worksheet, and combined inventories are wiped from storage', async t => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'operator-worksheets-test-'));
  const legacy = { id:'12345678-abcd-1234-abcd-123456789012', operator:'Earlier operator', date:'2026-10-01', status:'draft', revision:0, updatedAt:'2026-10-01T00:00:00Z', counts:{ [catalog.items[0].id]:2 }, items:catalog.items };
  const modern = { ...legacy, id:'23456789-abcd-1234-abcd-123456789012', worksheet:'operating', items:catalog.items.filter(i => i.sourceSheet === 1) };
  const completedLegacy = { ...legacy, id:'34567890-abcd-1234-abcd-123456789012', status:'complete' };
  fs.writeFileSync(path.join(dataDir, 'inventories.json'), JSON.stringify({ inventories:[legacy, modern, completedLegacy] }));
  const server = createApp({ dataDir });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => { await new Promise(resolve => server.close(resolve)); fs.rmSync(dataDir, { recursive:true, force:true }); });
  async function request(route, method = 'GET', body) {
    const response = await fetch(base + route, { method, headers:{ 'Content-Type':'application/json' }, ...(body ? { body:JSON.stringify(body) } : {}) });
    return { status:response.status, data:await response.json() };
  }
  const metadata = { operator:'Blain', date:'2026-10-08' };
  assert.equal((await request('/api/catalog')).data.worksheets.length, 3);
  for (const worksheet of [undefined,'weekly-order','master-order']) {
    assert.equal((await request('/api/inventories','POST',{ ...metadata, worksheet })).status,400);
  }
  const expected = [['operating',1,40],['janitorial',2,18],['dewatering',3,14]];
  for (const [worksheet, sourceSheet, total] of expected) {
    const created = await request('/api/inventories', 'POST', { ...metadata, worksheet });
    assert.equal(created.status,201);
    const run = created.data;
    assert.equal(run.worksheet,worksheet);
    assert.equal(run.items.length,total);
    assert.ok(run.items.every(i => i.sourceSheet === sourceSheet));
    const outside = catalog.items.find(i => i.sourceSheet !== sourceSheet);
    assert.equal((await request('/api/inventories/'+run.id,'PATCH',{ revision:0, counts:{ [outside.id]:3 } })).status,400);
    const counts = Object.fromEntries(run.items.map(i => [i.id,0]));
    const complete = await request('/api/inventories/'+run.id, 'PATCH', { revision:0, counts, status:'complete' });
    assert.equal(complete.status,200);
    assert.equal(complete.data.status,'complete');
    const summary = (await request('/api/inventories')).data.find(r => r.id === run.id);
    assert.equal(summary.total,total); assert.equal(summary.worksheet,worksheet);
  }
  assert.equal((await request('/api/inventories/'+legacy.id)).status,404);
  assert.equal((await request('/api/inventories/'+completedLegacy.id)).status,404);
  assert.equal((await request('/api/inventories/'+legacy.id,'PATCH',{ revision:0, counts:{} })).status,404);
  const preserved = (await request('/api/inventories/'+modern.id)).data;
  assert.equal(preserved.items.length,40); assert.equal(preserved.counts[catalog.items[0].id],2);
  const stored = JSON.parse(fs.readFileSync(path.join(dataDir,'inventories.json'),'utf8'));
  assert.ok(!stored.inventories.some(r => r.id === legacy.id || r.id === completedLegacy.id));
  assert.ok(stored.inventories.some(r => r.id === modern.id));
  assert.equal((await request('/api/inventories')).data.length,4);
});

test('previous quantities are references only; new counts stay blank until explicitly entered', async t => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inventory-prefill-test-'));
  const items = catalog.items.filter(i => i.sourceSheet === 1);
  const record = (id, date, status, value, worksheet='operating', entries=items) => ({ id, date, status, worksheet, operator:'Operator', revision:0, updatedAt:'2026-10-08T10:00:00Z', items:structuredClone(entries), counts:Object.fromEntries(entries.map(i=>[i.id,value])) });
  const oldest = record('10000000-abcd-1234-abcd-123456789012','2026-10-01','complete',9);
  const newest = record('20000000-abcd-1234-abcd-123456789012','2026-10-07','complete',2.5);
  newest.updatedAt='2026-10-07T10:00:00Z';
  newest.items[0].countSize='Different unit';
  const draft = record('30000000-abcd-1234-abcd-123456789012','2026-10-08','draft',99);
  const other = record('40000000-abcd-1234-abcd-123456789012','2026-10-08','complete',88,'janitorial',catalog.items.filter(i=>i.sourceSheet===2));
  const originals = [oldest,newest,draft,other];
  fs.writeFileSync(path.join(dataDir,'inventories.json'),JSON.stringify({inventories:originals}));
  const server = createApp({dataDir});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));fs.rmSync(dataDir,{recursive:true,force:true});});
  const base = 'http://127.0.0.1:'+server.address().port;
  async function create(worksheet) {
    const response=await fetch(base+'/api/inventories',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({worksheet,date:'2026-10-08',operator:'Today'})});
    assert.equal(response.status,201);return response.json();
  }
  const run=await create('operating');
  assert.equal(run.sourceInventoryId,newest.id);
  assert.equal(run.sourceInventoryDate,'2026-10-07');
  assert.equal(Object.hasOwn(run.previousCounts,items[0].id),false,'Changed units must not show an incompatible quantity');
  assert.equal(run.previousCounts[items[1].id],2.5);
  assert.equal(Object.keys(run.previousCounts).length,39);
  assert.deepEqual(run.counts,{});
  const rows=await (await fetch(base+'/api/inventories')).json();
  const summary=rows.find(r=>r.id===run.id);
  assert.equal(summary.counted,0); assert.equal(summary.low,0);
  const premature=await fetch(base+'/api/inventories/'+run.id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:0,counts:{},status:'complete'})});
  assert.equal(premature.status,400,'Previous quantities do not satisfy completion');
  const first=await create('dewatering');
  assert.equal(first.sourceInventoryId,null);
  assert.deepEqual(first.counts,{});
  assert.deepEqual(first.previousCounts,{});
  const before=JSON.parse(fs.readFileSync(path.join(dataDir,'inventories.json'),'utf8')).inventories.find(r=>r.id===newest.id);
  await fetch(base+'/api/inventories/'+run.id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:0,counts:{[items[1].id]:3}})});
  const after=JSON.parse(fs.readFileSync(path.join(dataDir,'inventories.json'),'utf8')).inventories.find(r=>r.id===newest.id);
  assert.deepEqual(after,before,'Adjustments must not modify the completed source inventory');
  const changed=await (await fetch(base+'/api/inventories/'+run.id)).json();
  assert.equal(changed.previousCounts[items[1].id],2.5);
  assert.equal(Object.keys(changed.counts).length,1);
});
