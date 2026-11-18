const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createApp}=require('../server');
const {buildChemicalReportEmail}=require('../email');
const model=require('../public/chemical-math');

test('chemical email preserves missing stock, draft status, escaped notes and dated order guidance',()=>{
  const record={date:'2026-11-18',operator:'<Operator>',status:'draft',notes:'<Check delivery>',readings:{},recordedGallons:{naoh:0,alum:14000,hypochlorite:6000,polymer:null,permanganate:700}};
  const records=model.calculate([record]);
  const report=buildChemicalReportEmail(records[0],records);
  assert.match(report.subject,/^DRAFT - Order Needed: Chemical Inventory/);
  assert.match(report.text,/1 chemical needs ordering/);
  assert.match(report.text,/Sodium Hydroxide\n0 gal\nOrder Now/i);
  assert.match(report.text,/Not recorded\nReading Missing/);
  assert.match(report.text,/does not place an order/);
  assert.match(report.html,/&lt;Operator&gt;/);
  assert.match(report.html,/&lt;Check delivery&gt;/);
  assert.doesNotMatch(report.html,/<Check delivery>|<Operator>/);
});

test('chemical email endpoint validates origin, recipient, saved revision and shared send cooldown',async t=>{
  const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'chemical-email-'));
  fs.writeFileSync(path.join(dataDir,'inventories.json'),JSON.stringify({inventories:[],chemicalInventory:{revision:3,draftLifecycleVersion:1,records:[{date:'2026-11-18',status:'complete',operator:'Operator',notes:'',readings:Object.fromEntries(model.fields.map(([id])=>[id,1]))}]}}));
  let sent;
  const server=createApp({dataDir,chemicalHistory:[],mailer:{enabled:true,defaultTo:'staff@example.com',send:async(to,report)=>{sent={to,report};}}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  t.after(async()=>{await new Promise(r=>server.close(r));fs.rmSync(dataDir,{recursive:true,force:true});});
  const base='http://127.0.0.1:'+server.address().port,route='/api/chemicals/records/2026-11-18/email';
  const send=async(body,origin=base,url=route)=>fetch(base+url,{method:'POST',headers:{'Content-Type':'application/json',...(origin?{Origin:origin}:{})},body:JSON.stringify(body)});
  const body={to:'staff@example.com',revision:3};
  assert.equal((await send(body,'https://another.example')).status,403);
  assert.equal((await send(body,null)).status,403);
  assert.equal((await send({...body,to:'bad'})).status,400);
  assert.equal((await send({...body,revision:2})).status,409);
  assert.equal((await send(body,base,'/api/chemicals/records/2026-11-17/email')).status,404);
  assert.equal(sent,undefined);
  assert.equal((await send(body)).status,200);
  assert.equal(sent.to,body.to);
  assert.match(sent.report.subject,/^Order Needed: Chemical Inventory - 2026-11-18$/);
  assert.equal((await send(body)).status,429);
});
