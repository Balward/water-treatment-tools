
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const {createApp} = require('../server');
test('catalog edits persist across inventory saves and restarts while snapshots stay unchanged',async t => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(),'inventory-catalog-'));
  let server, base;
  async function start() {server=createApp({dataDir,mailer:{enabled:false}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;}
  await start();t.after(async()=>{await new Promise(resolve=>server.close(resolve));fs.rmSync(dataDir,{recursive:true,force:true});});
  async function request(route,method='GET',body,origin=base) {const response=await fetch(base+route,{method,headers:{Origin:origin,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,data:await response.json()};}
  const old=(await request('/api/inventories','POST',{worksheet:'operating',operator:'Test',date:'2026-10-10'})).data;
  let catalog=(await request('/api/catalog')).data;
  const item=catalog.items[0], body={...item,worksheet:'operating',revision:catalog.revision,description:'Changed name',par:0.5};
  const route='/api/catalog/items/'+item.id;
  assert.equal((await request(route,'PATCH',body,'https://other.example')).status,403);
  assert.equal((await request(route,'PATCH',{...body,par:-1})).status,400);
  assert.equal((await request(route,'PATCH',{...body,productUrl:'javascript:alert(1)'})).status,400);
  assert.equal((await request(route,'PATCH',{...body,description:''})).status,400);
  const edited=await request(route,'PATCH',body);assert.equal(edited.status,200);catalog=edited.data;
  assert.equal((await request(route,'PATCH',body)).status,409);
  const added=await request('/api/catalog/items','POST',{...body,revision:catalog.revision,description:'New supply',location:'New shelf',par:null});assert.equal(added.status,201);catalog=added.data;
  const custom=catalog.items.find(i=>i.description==='New supply');assert.ok(custom.id.startsWith('custom-'));assert.equal(custom.par,null);
  const next=(await request('/api/inventories','POST',{worksheet:'operating',operator:'Test',date:'2026-10-10'})).data;
  assert.equal(next.items.find(i=>i.id===item.id).description,'Changed name');assert.ok(next.items.some(i=>i.id===custom.id));
  assert.equal((await request('/api/inventories/'+old.id)).data.items[0].description,item.description);
  const counts=Object.fromEntries(old.items.map(i=>[i.id,0]));assert.equal((await request('/api/inventories/'+old.id,'PATCH',{revision:0,counts,status:'complete'})).status,200);
  assert.equal((await request('/api/catalog')).data.revision,catalog.revision);
  assert.equal((await request(route,'DELETE',{revision:0})).status,409);
  const removed=await request(route,'DELETE',{revision:catalog.revision});assert.equal(removed.status,200);catalog=removed.data;
  assert.ok(!catalog.items.some(i=>i.id===item.id));
  assert.ok((await request('/api/inventories/'+old.id)).data.items.some(i=>i.id===item.id));
  assert.ok((await request('/api/inventories/'+next.id)).data.items.some(i=>i.id===item.id));
  await request('/api/inventories/'+next.id,'DELETE',{revision:0});
  await new Promise(resolve=>server.close(resolve));await start();
  assert.deepEqual((await request('/api/catalog')).data.items,catalog.items);
  const latest=(await request('/api/inventories','POST',{worksheet:'operating',operator:'Test',date:'2026-10-10'})).data;
  assert.ok(!latest.items.some(i=>i.id===item.id));assert.ok(latest.items.some(i=>i.id===custom.id));
});
