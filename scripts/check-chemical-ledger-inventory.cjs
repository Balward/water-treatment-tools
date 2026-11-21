'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),{createHash,randomUUID}=require('node:crypto');
const express=require('express'),register=require('../chemical-ledger-api'),Ledger=require('../apps/chemical-ledger/engine'),Inventory=require('../apps/chemical-ledger/inventory');
const {removeTemporaryDirectory}=require('./lib/browser-check.cjs');
const hash=s=>createHash('sha256').update(s).digest('hex'),closeTo=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const snapshot=(date,gallons=1000)=>({date,status:'complete',gallons:Object.fromEntries(['naoh','hypochlorite','alum','polymer','permanganate'].map(k=>[k,gallons]))});
const receipt=(id,date,quantity=50,extra={})=>({id,date,chemical:'hypochlorite',quantity,price:2.56,receivedQuantity:quantity,receivedUnit:'gal',receivedDate:date,countTiming:'unknown',...extra});
const records=[snapshot('2026-07-01'),snapshot('2026-07-08',900)];
let state=Ledger.initial(),rows=Inventory.build(state,records,hash);
const get=(id='hypochlorite')=>rows.find(r=>r.chemical===id);
closeTo(get('polymer').quantity,100*2295/265);closeTo(get('permanganate').quantity,100*2550/265);closeTo(get('alum').quantity,.266719038);
assert(get('alum').warnings.length);assert.equal(get('hydroxide').ready,false);
state.deliveries=[receipt('start','2026-07-01',10,{countTiming:'after'}),receipt('end','2026-07-08',20,{countTiming:'before'}),receipt('outside','2026-07-08',80,{countTiming:'after'})];
rows=Inventory.build(state,records,hash);assert.equal(get().quantity,130);const original=get().fingerprint;
state.deliveries.reverse();rows=Inventory.build(state,records,hash);assert.equal(get().fingerprint,original,'Ordering does not change receipt provenance');
state.deliveries[1].countTiming='unknown';rows=Inventory.build(state,records,hash);assert.equal(get().ready,false,'Count-day timing must be known');
state.deliveries=[{id:'old',date:'2026-07-04',chemical:'hypochlorite',quantity:50,price:2.56}];rows=Inventory.build(state,records,hash);assert.equal(get().ready,false,'Invoice quantity cannot stand in for physical receipt');
state=Ledger.initial();state.usage=[{id:'annual',date:'2026-06-30',chemical:'hypochlorite',quantity:100}];rows=Inventory.build(state,records,hash);assert.equal(get().ready,false,'Undated manual coverage blocks double counting');
state.usage[0].periodStart='2026-01-01';state.usage[0].periodEnd='2026-06-30';rows=Inventory.build(state,records,hash);assert.equal(get().ready,true);
state.usage[0].periodEnd='2026-07-02';rows=Inventory.build(state,records,hash);assert.equal(get().ready,false,'Overlapping dated manual coverage blocks approval');
rows=Inventory.build(Ledger.initial(),[snapshot('2026-07-01',0),snapshot('2026-07-08',0)],hash);assert.equal(get().quantity,0);assert.equal(get().ready,true,'True zero readings are valid');
const missing=structuredClone(records);missing[1].gallons.hypochlorite=null;rows=Inventory.build(Ledger.initial(),missing,hash);assert.equal(get().ready,false,'Missing readings never become zero');
rows=Inventory.build(Ledger.initial(),[snapshot('2026-07-01',0),snapshot('2026-07-08',1)],hash);assert.equal(get().ready,false,'Unexplained stock increases are blocked');
rows=Inventory.build(Ledger.initial(),[snapshot('2025-12-31',1000),snapshot('2026-01-07',930)],hash);
const r=get(),usage={id:r.id,date:r.end,chemical:r.chemical,quantity:r.quantity,source:{type:'inventory',status:'active',start:r.start,end:r.end,days:r.days,rawGallons:r.rawGallons,profileVersion:r.profile.version,fingerprint:r.fingerprint}};
state=Ledger.initial();state.usage=[usage];assert(Ledger.validState(state));assert.equal(Ledger.totals(state,2026).find(c=>c.id==='hypochlorite').used,60);assert.equal(Ledger.totals(state,2025).find(c=>c.id==='hypochlorite').used,10);
const weighted=Ledger.weighted(state,'hypochlorite',2026);assert.equal(weighted.entries[0].coverageDays,6);closeTo(weighted.entries[0].annual,3650);
assert.equal(Inventory.reconcile(state,[]).usage[0].source.status,'stale');state.usage[0].source.status='stale';assert.equal(Ledger.totals(state,2026).find(c=>c.id==='hypochlorite').used,0);assert.equal(Ledger.weighted(state,'hypochlorite',2026).annual,null);

(async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'ledger-inventory-'));let server,base,failed=false;
 let source={revision:1,records:records.map(r=>({...r,totals:Object.fromEntries(Object.entries(r.gallons).map(([k,gallons])=>[k,{gallons}]))})).concat({date:'2026-07-15',status:'draft'})};
 async function start(){const app=express();app.use(express.json());register(app,{directory,inventorySync:false,inventoryFetcher:async()=>{if(failed)throw Error('Offline test');return structuredClone(source);}});server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});base='http://127.0.0.1:'+server.address().port;}
 const stop=()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);});
 async function request(method='GET',suffix='',body,status=200){const response=await fetch(base+'/api/chemical-ledger'+suffix,{method,headers:{'Content-Type':'application/json','X-Chemical-Ledger':'1'},...(body?{body:JSON.stringify(body)}:{})});const value=await response.json();assert.equal(response.status,status,JSON.stringify(value));return value;}
 const save=current=>request('PUT','',{revision:current.revision,mutationId:randomUUID(),state:current.state});
 const approve=(current,row=current.inventory.candidates.find(r=>r.chemical==='hypochlorite'),status=200)=>request('POST','/inventory/approve',{revision:current.revision,id:row.id,fingerprint:row.fingerprint,receiptsConfirmed:true},status);
 try{
  await start();let current=await request('POST','/inventory/refresh',{});assert.equal(current.inventory.recordCount,2,'Draft inventories are excluded');
  current.state.deliveries=[receipt('invoice','2026-07-04')];await save(current);current=await request('GET','/inventory');
  const first=await approve(current);assert.equal(first.state.usage[0].quantity,150);assert.equal(first.state.usage[0].source.snapshots.length,2);assert.equal(first.state.usage[0].source.receipts[0].quantity,50);
  current=await request('GET','/inventory');assert.equal((await approve(current)).revision,first.revision,'Repeated approval is idempotent');
  const edited=structuredClone(first);edited.state.usage[0].quantity=999;await request('PUT','',{revision:first.revision,mutationId:randomUUID(),state:edited.state},409);
  source.revision++;source.records[1].totals.hypochlorite.gallons=850;current=await request('POST','/inventory/refresh',{});assert.equal(current.state.usage[0].source.status,'stale');assert.equal(current.inventory.candidates.find(r=>r.chemical==='hypochlorite').needsReview,true);
  const corrected=await approve(current);assert.equal(corrected.state.usage.length,1);assert.equal(corrected.state.usage[0].quantity,200);
  corrected.state.deliveries[0].receivedQuantity=60;current=await save(corrected);assert.equal(current.state.usage[0].source.status,'stale','Receipt changes invalidate approved usage');current=await request('GET','/inventory');assert.equal((await approve(current)).state.usage[0].quantity,210);
  source.revision++;source.records.push({...source.records[0],date:'2026-07-03',totals:Object.fromEntries(['naoh','hypochlorite','alum','polymer','permanganate'].map(k=>[k,{gallons:950}]))});current=await request('POST','/inventory/refresh',{});assert.equal(current.state.usage[0].source.status,'stale','Backfilled inventory supersedes the original interval');assert.equal(current.inventory.candidates.filter(r=>r.chemical==='hypochlorite').length,2);
  failed=true;const before=current.revision;current=await request('POST','/inventory/refresh',{});assert.match(current.inventory.error,/Offline/);assert.equal(current.inventory.recordCount,3);assert.equal(current.revision,before);await approve(current,current.inventory.candidates.find(r=>r.chemical==='hypochlorite'),503);
  await stop();await start();current=await request('GET','/inventory');assert.equal(current.inventory.recordCount,3,'Completed source snapshots survive restart');assert.equal(current.state.usage[0].source.status,'stale');
  console.log('Chemical inventory integration passed: conversions, zero/missing readings, receipt timing, manual overlap, year allocation, day coverage, review approval, idempotency, corrections, backfills, outages, and persisted provenance.');
 }finally{if(server)await stop();await removeTemporaryDirectory(directory);}
})().catch(e=>{console.error(e);process.exitCode=1;});
