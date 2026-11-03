const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createApp}=require('../server');
const model=require('../public/chemical-math');
async function harness(t,seed){
  const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'inventory-drafts-'));
  if(seed)fs.writeFileSync(path.join(dataDir,'inventories.json'),JSON.stringify(seed));
  let server,base;
  const start=async()=>{server=createApp({dataDir,chemicalHistory:[]});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;};
  await start();t.after(async()=>{await new Promise(resolve=>server.close(resolve));fs.rmSync(dataDir,{recursive:true,force:true});});
  return{restart:async()=>{await new Promise(resolve=>server.close(resolve));await start();},request:async(route,method='GET',body)=>{const response=await fetch(base+route,{method,headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return{status:response.status,data:await response.json()};}};
}
test('simultaneous supply starts resume one draft per type and preserve its operator, date and counts',async t=>{
  const {request,restart}=await harness(t),body={worksheet:'operating',operator:'First Operator',date:'2026-10-28'};
  const results=await Promise.all([request('/api/inventories','POST',body),request('/api/inventories','POST',{...body,operator:'Second Operator',date:'2026-10-29'})]);
  assert.deepEqual(results.map(r=>r.status).sort(),[200,201]);assert.equal(results[0].data.id,results[1].data.id);
  const original=results.find(r=>r.status===201).data;
  await request('/api/inventories/'+original.id,'PATCH',{revision:0,counts:{[original.items[0].id]:7}});
  const resumed=await request('/api/inventories','POST',body);assert.equal(resumed.data.resumed,true);assert.equal(resumed.data.counts[original.items[0].id],7);assert.equal(resumed.data.operator,original.operator);assert.equal(resumed.data.date,original.date);
  assert.equal((await request('/api/inventories','POST',{...body,worksheet:'janitorial'})).status,201,'Different inventory types can be unfinished together');
  await restart();assert.equal((await request('/api/inventories','POST',body)).data.id,original.id);assert.equal((await request('/api/inventories')).data.length,2);
});
test('chemical drafts resume across restarts, reject duplicate starts and incomplete completion, and become read-only when finished',async t=>{
  const {request,restart}=await harness(t),url='/api/chemicals/records/2026-10-28';
  const body={revision:0,operator:'Blaine Alward',notes:'',readings:{},status:'draft'};
  let saved=await request(url,'PUT',body);assert.equal(saved.status,200);assert.equal(saved.data.records[0].counted,0);
  saved=await request(url,'PUT',{...body,revision:1,readings:{salt:.5}});assert.equal(saved.data.records[0].status,'draft');assert.equal(saved.data.records[0].counted,1);
  assert.equal((await request('/api/chemicals/records/2026-10-29','PUT',{...body,revision:2})).status,409);
  assert.equal((await request(url,'PUT',{...body,revision:2,status:'complete',readings:{salt:.5}})).status,400);
  await restart();assert.equal((await request('/api/chemicals')).data.records[0].readings.salt,.5);
  const readings=Object.fromEntries(model.fields.map(([id])=>[id,0]));
  saved=await request(url,'PUT',{...body,revision:2,status:'complete',readings});assert.equal(saved.status,200);assert.equal(saved.data.records[0].status,'complete');assert.ok(saved.data.records[0].completedAt);assert.equal(saved.data.records[0].counted,16);
  assert.equal((await request(url,'PUT',{...body,revision:3,readings:{salt:1}})).status,409,'Completed readings cannot be overwritten');
  assert.equal((await request('/api/chemicals/records/2026-10-29','PUT',{...body,revision:3})).status,200,'Completion permits the next inventory');
});
test('concurrent chemical starts sharing a revision create only one unfinished inventory',async t=>{
  const {request}=await harness(t),body={revision:0,operator:'Blaine Alward',notes:'',readings:{salt:0},status:'draft'};
  const results=await Promise.all(['2026-10-28','2026-10-29'].map(date=>request('/api/chemicals/records/'+date,'PUT',body)));
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);assert.equal((await request('/api/chemicals')).data.records.length,1);
});

test('explicit corrections preserve completed supply status, completion date and revision protection',async t=>{
  const {request}=await harness(t);
  let run=(await request('/api/inventories','POST',{worksheet:'operating',operator:'Blaine',date:'2026-10-20'})).data;
  const url='/api/inventories/'+run.id,counts=Object.fromEntries(run.items.map(item=>[item.id,1]));
  run=(await request(url,'PATCH',{revision:run.revision,counts,status:'complete'})).data;
  const completedAt=run.completedAt,item=run.items[0].id;
  await request('/api/inventories','POST',{worksheet:'operating',operator:'Carson',date:'2026-10-28'});
  const result=await request(url,'PATCH',{revision:run.revision,counts:{[item]:2},editCompleted:true,status:'draft'});
  assert.equal(result.status,200);assert.equal(result.data.counts[item],2);assert.equal(result.data.status,'complete');assert.equal(result.data.completedAt,completedAt);
  assert.equal((await request(url,'PATCH',{revision:run.revision,counts:{[item]:3},editCompleted:true})).status,409);
  assert.equal((await request(url,'PATCH',{revision:result.data.revision,counts:{[item]:null},editCompleted:true})).status,400);
  assert.equal((await request('/api/inventories')).data.filter(r=>r.status==='draft').length,1);
});

test('completed chemical corrections coexist with a draft and keep imported totals separate from tank formulas',async t=>{
  const readings=Object.fromEntries(model.fields.map(([id])=>[id,1]));
  const imported={date:'2026-01-08',operator:'Workbook',notes:'',status:'complete',readings:Object.fromEntries(model.fields.map(([id])=>[id,null])),recordedGallons:Object.fromEntries(model.chemicals.map(c=>[c.id,100])),source:{type:'workbook'}};
  const {request}=await harness(t,{inventories:[],chemicalInventory:{revision:0,draftLifecycleVersion:1,records:[imported]}});
  let state=(await request('/api/chemicals/records/2026-10-20','PUT',{revision:0,readings,operator:'Blaine',notes:'',status:'complete'})).data;
  const completedAt=state.records[0].completedAt;
  state=(await request('/api/chemicals/records/2026-10-28','PUT',{revision:state.revision,readings:{},operator:'Carson',notes:'',status:'draft'})).data;
  let result=await request('/api/chemicals/records/2026-10-20','PUT',{revision:state.revision,readings:{...readings,naohEast:3},operator:'Blaine',notes:'Corrected',status:'draft',editCompleted:true});
  assert.equal(result.status,200);let record=result.data.records.find(r=>r.date==='2026-10-20');assert.equal(record.status,'complete');assert.equal(record.completedAt,completedAt);assert.equal(record.readings.naohEast,3);
  const gallons={...imported.recordedGallons,naoh:222};
  result=await request('/api/chemicals/records/2026-01-08','PUT',{revision:result.data.revision,recordedGallons:gallons,operator:'Blaine',notes:'Corrected workbook total',editCompleted:true});
  assert.equal(result.status,200);record=result.data.records.find(r=>r.date===imported.date);assert.equal(record.totals.naoh.gallons,222);assert.equal(record.source.type,'workbook');assert.equal(record.readings.naohEast,null);assert.equal(result.data.records.filter(r=>r.status==='draft').length,1);
  assert.equal((await request('/api/chemicals/records/2026-01-08','PUT',{revision:result.data.revision-1,recordedGallons:gallons,operator:'Blaine',notes:'',editCompleted:true})).status,409);
});
test('the latest legacy partial chemical inventory reopens once without changing historical readings',async t=>{
  const seed={inventories:[],chemicalInventory:{revision:4,records:[{date:'2026-10-14',operator:'Earlier',readings:{salt:1},notes:'Older snapshot',updatedAt:'2026-10-14T12:00:00Z'},{date:'2026-10-21',operator:'Latest',readings:{naohEast:8},notes:'Unfinished reading',updatedAt:'2026-10-21T12:00:00Z'}]}};
  const {request,restart}=await harness(t,seed);let result=(await request('/api/chemicals')).data;
  assert.equal(result.revision,5);assert.equal(result.records[0].status,'draft');assert.equal(result.records[0].readings.naohEast,8);assert.equal(result.records[1].status,'complete');assert.equal(result.records[1].notes,'Older snapshot');
  await restart();result=(await request('/api/chemicals')).data;assert.equal(result.revision,5);assert.equal(result.records.filter(record=>record.status==='draft').length,1,'Migration runs once');
});
