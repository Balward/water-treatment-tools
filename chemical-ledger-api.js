'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),{randomUUID}=require('node:crypto');
const Ledger=require('./apps/chemical-ledger/engine.js');
function valid(state){
  try{return Ledger.validState(state)&&state.deliveries.length<=50000&&state.usage.length<=50000&&['deliveries','usage'].every(k=>state[k].every(r=>r.id.length<=128&&['notes','supplier','reference'].every(f=>r[f]===undefined||r[f].length<=4000)))&&(!state.history||typeof state.history==='object'&&!Array.isArray(state.history)&&Object.entries(state.history).every(([year,h])=>/^\d{4}$/.test(year)&&h&&Number.isFinite(h.months)&&h.months>0&&h.months<=12&&Number.isFinite(h.weight)&&h.weight>=0));}catch{return false;}
}
function normalize(value){
  const state=Ledger.migrateState(value);if(!valid(state))throw Object.assign(new Error('This is not a valid Chemical Ledger backup.'),{status:400});
  const record=(r,delivery)=>({id:r.id,date:r.date,chemical:r.chemical,quantity:r.quantity,notes:r.notes||'',...(delivery?{price:r.price,reference:r.reference||'',supplier:r.supplier||'',superfundTax:r.superfundTax??0,energySurcharge:r.energySurcharge??0}:{})});
  return {version:1,chemicals:Ledger.initial().chemicals.map(c=>({...c,price:state.chemicals.find(x=>x.id===c.id).price})),deliveries:state.deliveries.map(r=>record(r,true)),usage:state.usage.map(r=>record(r,false)),plans:state.plans,history:state.history||{},...(state.alumUnitCorrected?{alumUnitCorrected:true}:{})};
}
module.exports=function register(app,options={}){
  const directory=options.directory||process.env.CHEMICAL_LEDGER_DATA_DIR||path.join(__dirname,'data','chemical-ledger'),file=path.join(directory,'ledger.json');
  let queue=Promise.resolve();
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
  async function change(req,res,merge){
    const operation=queue.then(async()=>{
      const body=req.body||{},current=await read();
      if(!Number.isSafeInteger(body.revision)||body.revision<0||typeof body.mutationId!=='string'||!/^[a-zA-Z0-9-]{1,128}$/.test(body.mutationId))fail(400,'A shared ledger revision and save identifier are required.');
      if(body.mutationId===current.lastMutationId)return current;
      if(body.revision!==current.revision)fail(409,'The ledger changed on another computer. Download your unsaved backup, then reload the shared ledger and reapply your changes.');
      const incoming=normalize(body.state);let state=incoming,imported;
      if(merge){
        state=current.revision===0?structuredClone(incoming):structuredClone(current.state);imported={deliveries:0,usage:0};
        for(const k of ['deliveries','usage']){
          const existing=new Map(current.state[k].map(r=>[r.id,r]));
          for(const r of incoming[k]){const old=existing.get(r.id);if(old&&JSON.stringify(old)!==JSON.stringify(r))fail(409,'An imported record has the same ID as a different shared record. Existing records were kept. Review the backup before importing.');if(!old){imported[k]++;if(current.revision!==0)state[k].push(r);}}
        }
        if(current.revision!==0){for(const k of ['plans','history'])for(const [id,value]of Object.entries(incoming[k]))if(!Object.hasOwn(state[k],id))Object.defineProperty(state[k],id,{value,enumerable:true,writable:true,configurable:true});}
        if(JSON.stringify(state)===JSON.stringify(current.state))return {...current,imported};
      }
      if(!valid(state))fail(400,'The combined ledger is too large or contains invalid entries.');
      const next={revision:current.revision+1,updatedAt:new Date().toISOString(),lastMutationId:body.mutationId,state};await write(next,current);return {...next,...(imported?{imported}:{})};
    });queue=operation.catch(()=>{});res.json(await operation);
  }
  app.put('/api/chemical-ledger',route((req,res)=>change(req,res,false)));
  app.post('/api/chemical-ledger/import',route((req,res)=>change(req,res,true)));
};
module.exports.normalize=normalize;
