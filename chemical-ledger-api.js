'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),{randomUUID,createHash}=require('node:crypto');
const Ledger=require('./apps/chemical-ledger/engine.js');
const Inventory=require('./apps/chemical-ledger/inventory.js');
function valid(state){
  try{return Ledger.validState(state)&&state.deliveries.length<=50000&&state.usage.length<=50000&&['deliveries','usage'].every(k=>state[k].every(r=>r.id.length<=128&&['notes','supplier','reference'].every(f=>r[f]===undefined||r[f].length<=4000)))&&(!state.history||typeof state.history==='object'&&!Array.isArray(state.history)&&Object.entries(state.history).every(([year,h])=>/^\d{4}$/.test(year)&&h&&Number.isFinite(h.months)&&h.months>0&&h.months<=12&&Number.isFinite(h.weight)&&h.weight>=0));}catch{return false;}
}
function normalize(value){
  const state=Ledger.migrateState(value);if(!valid(state))throw Object.assign(new Error('This is not a valid Chemical Ledger backup.'),{status:400});
  const record=(r,delivery)=>({id:r.id,date:r.date,chemical:r.chemical,quantity:r.quantity,notes:r.notes||'',...(delivery?{price:r.price,reference:r.reference||'',supplier:r.supplier||'',superfundTax:r.superfundTax??0,energySurcharge:r.energySurcharge??0,...(r.receivedQuantity!==undefined?{receivedQuantity:r.receivedQuantity,receivedUnit:r.receivedUnit,receivedDate:r.receivedDate,countTiming:r.countTiming}:{})}:{...(r.periodStart!==undefined?{periodStart:r.periodStart,periodEnd:r.periodEnd}:{}),...(r.source?{source:structuredClone(r.source)}:{})})});
  return {version:1,chemicals:Ledger.initial().chemicals.map(c=>({...c,price:state.chemicals.find(x=>x.id===c.id).price})),deliveries:state.deliveries.map(r=>record(r,true)),usage:state.usage.map(r=>record(r,false)),plans:state.plans,history:state.history||{},...(state.alumUnitCorrected?{alumUnitCorrected:true}:{})};
}
module.exports=function register(app,options={}){
  const directory=options.directory||process.env.CHEMICAL_LEDGER_DATA_DIR||path.join(__dirname,'data','chemical-ledger'),file=path.join(directory,'ledger.json');
  let queue=Promise.resolve();
  let inventoryCache={records:[],sourceRevision:null,lastSuccess:null,error:'Inventory has not been synchronized yet.'},refreshing=null;
  const inventoryFile=path.join(directory,'inventory-source.json'),fingerprint=s=>createHash('sha256').update(s).digest('hex');
  const rows=state=>Inventory.build(state,inventoryCache.records,fingerprint);
  const cacheReady=fs.readFile(inventoryFile,'utf8').then(raw=>{const saved=JSON.parse(raw);if(!Array.isArray(saved.records))throw Error('Invalid inventory cache');inventoryCache=saved;}).catch(e=>{if(e.code!=='ENOENT')inventoryCache.error='Saved inventory snapshots could not be read. Refresh Inventory to reload the source.';});
  const initial=()=>({revision:0,updatedAt:null,lastMutationId:null,state:Ledger.initial()});
  async function read(){
    try{const saved=JSON.parse(await fs.readFile(file,'utf8'));if(!Number.isSafeInteger(saved.revision)||saved.revision<1)throw Error('Invalid shared ledger');let state;try{state=normalize(saved.state);}catch{throw Error('Invalid shared ledger');}return {...saved,state};}
    catch(e){if(e.code==='ENOENT')return initial();throw e;}
  }
  async function write(next,previous){
    await fs.mkdir(directory,{recursive:true});
    if(previous.revision){const backups=path.join(directory,'backups');await fs.mkdir(backups,{recursive:true});await fs.writeFile(path.join(backups,`ledger-${previous.revision}-${randomUUID()}.json`),JSON.stringify(previous),{flag:'wx'});}
    const temporary=file+'.'+randomUUID()+'.tmp';
    try{const handle=await fs.open(temporary,'wx');try{await handle.writeFile(JSON.stringify(next,null,2));await handle.sync();}finally{await handle.close();}await fs.rename(temporary,file);}finally{await fs.unlink(temporary).catch(()=>{});}
  }
  async function syncInventory(){
    if(refreshing)return refreshing;
    refreshing=(async()=>{
      await cacheReady;
      try{
        const source=options.inventoryFetcher?await options.inventoryFetcher():await fetch(process.env.CHEMICAL_INVENTORY_URL||'https://inventory.gibbhub.io/api/chemicals',{signal:AbortSignal.timeout(15000)}).then(r=>{if(!r.ok)throw Error('Inventory HTTP '+r.status);return r.json();});
        if(!Array.isArray(source.records)||!Number.isSafeInteger(source.revision))throw Error('Inventory returned an invalid response.');
        const records=source.records.filter(r=>(r.status||'complete')==='complete').map(r=>{
          if(!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||new Date(r.date+'T00:00:00Z').toISOString().slice(0,10)!==r.date)throw Error('Invalid inventory date.');
          const gallons=Object.fromEntries(['naoh','hypochlorite','alum','polymer','permanganate'].map(key=>{const value=r.totals?.[key]?.gallons;if(value!==null&&value!==undefined&&!(typeof value==='number'&&Number.isFinite(value)&&value>=0))throw Error('Invalid saved inventory gallons.');return [key,value??null];}));
          return {date:r.date,status:'complete',gallons,updatedAt:r.updatedAt||null,operator:r.operator||'',settingsVersion:r.settingsVersion||null,source:r.source?.type||'app'};
        });
        if(new Set(records.map(r=>r.date)).size!==records.length)throw Error('Duplicate inventory dates.');
        const next={records,sourceRevision:source.revision,lastSuccess:new Date().toISOString(),error:''};
        await fs.mkdir(directory,{recursive:true});const temporary=inventoryFile+'.'+randomUUID()+'.tmp';try{await fs.writeFile(temporary,JSON.stringify(next));await fs.rename(temporary,inventoryFile);}finally{await fs.unlink(temporary).catch(()=>{});}inventoryCache=next;
        const operation=queue.then(async()=>{const current=await read(),state=Inventory.reconcile(current.state,rows(current.state));if(state!==current.state)await write({revision:current.revision+1,updatedAt:new Date().toISOString(),lastMutationId:'inventory-sync-'+randomUUID(),state},current);});queue=operation.catch(()=>{});await operation;
      }catch(e){inventoryCache={...inventoryCache,error:'Inventory sync failed: '+e.message};}
    })().finally(()=>{refreshing=null;});return refreshing;
  }
  async function inventoryResponse(){await cacheReady;const current=await read();return {...current,inventory:{profiles:Inventory.profiles,sourceRevision:inventoryCache.sourceRevision,lastSuccess:inventoryCache.lastSuccess,error:inventoryCache.error,recordCount:inventoryCache.records.length,candidates:rows(current.state)}};}
  const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
  function route(handler){return async(req,res)=>{
    res.set('Cache-Control','no-store');
    try{
      if(req.method!=='GET'){
        const origin=req.get('origin');let crossOrigin=false;
        if(origin){try{const parsed=new URL(origin);crossOrigin=!['http:','https:'].includes(parsed.protocol)||parsed.host!==req.get('host');}catch{crossOrigin=true;}}
        if(crossOrigin||req.get('sec-fetch-site')==='cross-site'||req.get('x-chemical-ledger')!=='1')fail(403,'Open Chemical Ledger on the suite to save records.');
      }
      await handler(req,res);
    }catch(e){if(!e.status)console.error('Chemical Ledger storage error:',e.message);res.status(e.status||503).json({error:e.status?e.message:'The shared ledger could not be read or saved. Existing server records have not been replaced.'});}
  };}
  app.get('/api/chemical-ledger',route(async(req,res)=>res.json(await read())));
  app.get('/api/chemical-ledger/inventory',route(async(req,res)=>res.json(await inventoryResponse())));
  app.post('/api/chemical-ledger/inventory/refresh',route(async(req,res)=>{await syncInventory();res.json(await inventoryResponse());}));
  app.post('/api/chemical-ledger/inventory/approve',route(async(req,res)=>{
    await syncInventory();
    const operation=queue.then(async()=>{
      if(inventoryCache.error||!inventoryCache.lastSuccess||Date.now()-Date.parse(inventoryCache.lastSuccess)>300000)fail(503,'Refresh a working inventory connection before approving usage.');
      const current=await read(),body=req.body||{};if(body.revision!==current.revision)fail(409,'The ledger changed. Refresh Inventory Review before approving.');
      const row=rows(current.state).find(r=>r.id===body.id);if(!row||row.fingerprint!==body.fingerprint)fail(409,'The inventory or receipts changed. Review the updated interval.');
      if(!row.ready)fail(400,row.blockers.join(' '));if(body.receiptsConfirmed!==true)fail(400,'Confirm the stock dates, physical receipts, and conversion before approving.');
      if(row.approved)return current;
      const source={type:'inventory',status:'active',start:row.start,end:row.end,days:row.days,rawGallons:Math.max(0,row.rawGallons),beginningGallons:row.beginning,endingGallons:row.ending,receivedGallons:row.received,profileVersion:row.profile.version,profile:row.profile,estimated:row.profile.estimated,fingerprint:row.fingerprint,reviewedAt:new Date().toISOString(),snapshots:inventoryCache.records.filter(r=>[row.start,row.end].includes(r.date)),receipts:row.receipts};
      const usage={id:row.id,date:row.end,chemical:row.chemical,quantity:row.quantity,notes:`Inventory withdrawal ${row.start} to ${row.end}. ${row.profile.estimated?'Estimated conversion. ':''}Receipts and stock dates reviewed.`,source};
      const state={...current.state,usage:[...current.state.usage.filter(r=>r.id!==row.id),usage]};if(!valid(state))fail(400,'Calculated inventory usage is invalid.');
      const next={revision:current.revision+1,updatedAt:new Date().toISOString(),lastMutationId:'inventory-approve-'+randomUUID(),state};await write(next,current);return next;
    });queue=operation.catch(()=>{});res.json(await operation);
  }));
  async function change(req,res,merge){
    const operation=queue.then(async()=>{
      await cacheReady;const body=req.body||{},current=await read();
      if(!Number.isSafeInteger(body.revision)||body.revision<0||typeof body.mutationId!=='string'||!/^[a-zA-Z0-9-]{1,128}$/.test(body.mutationId))fail(400,'A shared ledger revision and save identifier are required.');
      if(body.mutationId===current.lastMutationId)return current;
      if(body.revision!==current.revision)fail(409,'The ledger changed on another computer. Download your unsaved backup, then reload the shared ledger and reapply your changes.');
      const incoming=normalize(body.state);let state=incoming,imported;
      if(!merge){for(const row of current.state.usage.filter(r=>r.source)){if(JSON.stringify(incoming.usage.find(r=>r.id===row.id))!==JSON.stringify(row))fail(409,'Inventory-derived usage must be updated through Inventory Review.');}if(incoming.usage.some(r=>r.source&&!current.state.usage.some(old=>old.id===r.id)))fail(400,'Create inventory-derived usage through Inventory Review.');}
      if(merge){
        state=current.revision===0?structuredClone(incoming):structuredClone(current.state);imported={deliveries:0,usage:0};
        for(const k of ['deliveries','usage']){
          const existing=new Map(current.state[k].map(r=>[r.id,r]));
          for(const r of incoming[k]){const old=existing.get(r.id);if(old&&JSON.stringify(old)!==JSON.stringify(r))fail(409,'An imported record has the same ID as a different shared record. Existing records were kept. Review the backup before importing.');if(!old){imported[k]++;if(current.revision!==0)state[k].push(r);}}
        }
        if(current.revision!==0){for(const k of ['plans','history'])for(const [id,value]of Object.entries(incoming[k]))if(!Object.hasOwn(state[k],id))Object.defineProperty(state[k],id,{value,enumerable:true,writable:true,configurable:true});}
        if(JSON.stringify(state)===JSON.stringify(current.state))return {...current,imported};
      }
      state=Inventory.reconcile(state,rows(state));if(!valid(state))fail(400,'The combined ledger is too large or contains invalid entries.');
      const next={revision:current.revision+1,updatedAt:new Date().toISOString(),lastMutationId:body.mutationId,state};await write(next,current);return {...next,...(imported?{imported}:{})};
    });queue=operation.catch(()=>{});res.json(await operation);
  }
  app.put('/api/chemical-ledger',route((req,res)=>change(req,res,false)));
  app.post('/api/chemical-ledger/import',route((req,res)=>change(req,res,true)));
  if(options.inventorySync!==false&&process.env.NODE_ENV==='production'){void syncInventory();const timer=setInterval(()=>void syncInventory(),60000);timer.unref();}
};
module.exports.normalize=normalize;
