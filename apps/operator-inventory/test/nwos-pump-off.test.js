const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const model=require('../public/chemical-math'),{createApp}=require('../server');
const readings=value=>Object.fromEntries(model.fields.map(([id])=>[id,id==='nwos'?value:1]));

test('previous readings use the last recorded completed value before the selected date, preserving zero',()=>{
  const records=[{date:'2026-10-01',readings:{nwos:0}},{date:'2026-10-08',status:'complete',readings:{nwos:null}},{date:'2026-10-15',status:'draft',readings:{nwos:100}},{date:'2026-10-29',status:'complete',readings:{nwos:999}}];
  assert.equal(model.previousReading(records,'2026-10-22','nwos').date,'2026-10-01');
  assert.equal(model.previousReading(records,'2026-10-01','nwos'),null);
});

test('pump-off saves copy a completed meter, survive restart, repeat weekly and support fresh readings',async t=>{
  const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'nwos-off-'));
  let server,base;
  const start=async()=>{server=createApp({dataDir,chemicalHistory:[]});await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;};
  await start();t.after(async()=>{await new Promise(r=>server.close(r));fs.rmSync(dataDir,{recursive:true,force:true});});
  let revision=0;
  const save=async(date,extra={})=>{const response=await fetch(base+'/api/chemicals/records/'+date,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision,operator:'Operator',notes:'',status:'complete',readings:readings(123),...extra})});const data=await response.json();if(response.ok)revision=data.revision;return{status:response.status,data};};
  assert.equal((await save('2026-10-08',{nwosPumpOff:true})).status,400,'No fabricated initial meter value');
  assert.equal((await save('2026-10-01',{readings:readings(0)})).status,200);
  assert.equal((await save('2026-10-08',{nwosPumpOff:'yes'})).status,400);
  let result=await save('2026-10-08',{nwosPumpOff:true,readings:{...readings(999),nwos:null}});
  assert.equal(result.status,200);let record=result.data.records[0];
  assert.equal(record.readings.nwos,0);assert.equal(record.nwosCarryFrom,'2026-10-01');assert.equal(record.nwosUsed,0);assert.equal(record.counted,16);
  assert.equal((await save('2026-10-08',{nwosPumpOff:true,revision:0})).status,409);
  await new Promise(r=>server.close(r));await start();
  result=await save('2026-10-15',{nwosPumpOff:true});record=result.data.records[0];assert.equal(record.readings.nwos,0);assert.equal(record.nwosCarryFrom,'2026-10-08');assert.equal(record.nwosUsed,0);
  result=await save('2026-10-15',{nwosPumpOff:false,editCompleted:true,readings:readings(20)});record=result.data.records[0];assert.equal(record.readings.nwos,20);assert.equal(record.nwosCarryFrom,null);assert.equal(record.nwosUsed,20000);
  result=await save('2026-10-08',{nwosPumpOff:true,editCompleted:true,readings:readings(999)});assert.equal(result.data.records.find(r=>r.date==='2026-10-08').readings.nwos,0,'Unrelated saves cannot overwrite the copied meter');
});
