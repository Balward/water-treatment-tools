const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {reconcile}=require('../chemical-orders'),model=require('../public/chemical-math'),{createApp}=require('../server');
const today='2026-10-28';
function record(date=today,overrides={}){return{date,operator:'Blaine',status:'complete',updatedAt:date+'T12:00:00Z',notes:'',readings:Object.fromEntries(model.fields.map(([id])=>[id,1])),...overrides};}
const state=records=>({inventories:[],chemicalInventory:{revision:0,draftLifecycleVersion:1,records}});
test('chemical recommendations use completed app readings only and keep one stable entry per chemical',()=>{
  assert.equal(reconcile(state([record(today,{status:'draft'})]),today).orderList,undefined);
  assert.equal(reconcile(state([record(today,{source:{type:'workbook'}})]),today).orderList,undefined);
  const saved=reconcile(state([record()]),today);assert.equal(saved.orderList.length,5);
  assert.equal(reconcile(saved,today),saved,'Repeated reads do not change revisions or IDs');
  assert.equal(saved.orderList.find(e=>e.chemicalKey==='polymer').quantity,1);
  assert.equal(saved.orderList.find(e=>e.chemicalKey==='naoh').quantity,4000);
  const next=reconcile({...saved,chemicalInventory:{records:[record('2026-10-29')]}},'2026-10-29');
  assert.equal(next.orderList.length,5);assert.equal(next.orderList[0].id,saved.orderList[0].id);
});
test('stock above threshold can become due based on recent usage and seven-day notice',()=>{
  const records=['2026-10-14','2026-10-21','2026-10-28'].map((date,i)=>record(date,{recordedGallons:{naoh:5000,alum:15000,hypochlorite:3500-i*500,polymer:800,permanganate:800}}));
  const saved=reconcile(state(records),today);const entry=saved.orderList.find(e=>e.chemicalKey==='hypochlorite');
  assert.ok(entry);assert.equal(entry.onHand,2500);assert.ok(entry.planning.rate>0);
  const constrained=reconcile(state([record(today,{recordedGallons:{naoh:1800}})]),today).orderList[0];
  assert.ok(constrained.planning.warnings.some(text=>text.includes('does not fit')));
});
test('corrections preserve purchasing edits, replenishment removes recommendations, and missing values are not zero',()=>{
  const saved=reconcile(state([record()]),today),entry=saved.orderList[0];entry.quantity=23;entry.notes='Keep this';entry.item.company='Supplier';entry.deliveryDate='2026-11-12';entry.deliveryDateEdited=true;
  const updated=reconcile({...saved,chemicalInventory:{records:[record('2026-10-29')]}},'2026-10-29').orderList.find(e=>e.id===entry.id);
  assert.equal(updated.quantity,23);assert.equal(updated.notes,'Keep this');assert.equal(updated.item.company,'Supplier');assert.equal(updated.deliveryDate,'2026-11-12');
  const full=record('2026-10-29',{recordedGallons:{alum:15000,hypochlorite:6000,naoh:5000,polymer:800,permanganate:800}});
  assert.equal(reconcile({...saved,chemicalInventory:{records:[full]}},'2026-10-29').orderList.length,0);
  assert.equal(reconcile(state([record(today,{readings:{}})]),today).orderList,undefined);
});
test('removal suppresses the same reading and scheduled orders cover readings before delivery',()=>{
  let saved=reconcile(state([record()]),today),entry=saved.orderList[0];
  saved={...saved,chemicalOrderResolutions:{[entry.chemicalKey]:{readingKey:entry.readingKey,action:'removed'}}};
  assert.ok(!reconcile(saved,today).orderList.some(e=>e.id===entry.id));
  saved={...saved,orderHistory:[{items:[{...entry,deliveryDate:'2026-11-04'}]}],chemicalOrderResolutions:{}};
  assert.ok(!reconcile({...saved,chemicalInventory:{records:[record('2026-10-29')]}},'2026-10-29').orderList.some(e=>e.chemicalKey===entry.chemicalKey));
  assert.ok(reconcile({...saved,chemicalInventory:{records:[record('2026-11-05')]}},'2026-11-05').orderList.some(e=>e.chemicalKey===entry.chemicalKey));
});
test('chemical purchasing API validates supplier and delivery, protects revisions, and persists placed orders',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'chemical-orders-'));fs.writeFileSync(path.join(dir,'inventories.json'),JSON.stringify(state([record()])));
  const server=createApp({dataDir:dir,chemicalHistory:[]});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  t.after(async()=>{await new Promise(r=>server.close(r));fs.rmSync(dir,{recursive:true,force:true});});
  const request=async(route,method='GET',body)=>{const response=await fetch(base+route,{method,headers:{Origin:base,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return{status:response.status,data:await response.json()};};
  let list=(await request('/api/order-list')).data;const entry=list.items.find(e=>e.chemicalKey==='naoh');
  assert.equal((await request('/api/order-list')).data.revision,list.revision);
  const ordered=()=>({revision:list.revision,date:today,operator:'Blaine',ids:[entry.id],reference:'PO-TEST'});
  assert.equal((await request('/api/order-list/ordered','POST',ordered())).status,400);
  const body={revision:list.revision,quantity:4000,orderUnit:'gal',notes:'Delivery arranged',supplier:'Chemical Supplier',deliveryDate:'2026-02-30'};
  assert.equal((await request('/api/order-list/'+entry.id,'PATCH',body)).status,400);
  let result=await request('/api/order-list/'+entry.id,'PATCH',{...body,deliveryDate:'2026-11-04'});assert.equal(result.status,200);list=result.data;
  assert.equal((await request('/api/order-list/'+entry.id,'PATCH',{...body,deliveryDate:'2026-11-04'})).status,409);
  result=await request('/api/order-list/ordered','POST',ordered());assert.equal(result.status,201);list=result.data;
  assert.equal(list.orders[0].items[0].deliveryDate,'2026-11-04');assert.ok(!list.items.some(e=>e.chemicalKey==='naoh'));
  const another=list.items[0];list=(await request('/api/order-list/'+another.id,'DELETE',{revision:list.revision})).data;
  assert.ok(!(await request('/api/order-list')).data.items.some(e=>e.id===another.id));
  const stored=JSON.parse(fs.readFileSync(path.join(dir,'inventories.json'),'utf8'));assert.equal(stored.orderHistory[0].reference,'PO-TEST');
});

test('chemical history summaries assess each date independently and distinguish due, no order, missing and sparse trends',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'chemical-card-summary-'));
  const high={alum:10000,hypochlorite:6000,naoh:4500,polymer:700,permanganate:700};
  const records=['2026-10-01','2026-10-08','2026-10-15'].map(date=>record(date,{recordedGallons:high}));
  records.push(record('2026-10-22',{recordedGallons:{...high,alum:3000,naoh:1000}}),record('2026-11-01',{recordedGallons:{alum:0,hypochlorite:0,naoh:0,polymer:0,permanganate:0}}));
  fs.writeFileSync(path.join(dir,'inventories.json'),JSON.stringify(state(records)));
  const server=createApp({dataDir:dir,chemicalHistory:[]});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>server.close(r));fs.rmSync(dir,{recursive:true,force:true});});
  const saved=(await(await fetch('http://127.0.0.1:'+server.address().port+'/api/chemicals')).json()).records;
  assert.deepEqual(saved.find(r=>r.date==='2026-10-01').orderSummary,{needed:0,review:5});
  assert.deepEqual(saved.find(r=>r.date==='2026-10-15').orderSummary,{needed:0,review:0},'Future low readings do not change a historical no-order result');
  assert.equal(saved.find(r=>r.date==='2026-10-22').orderSummary.needed,2);
  assert.equal(saved.find(r=>r.date==='2026-11-01').orderSummary.needed,5);
});
