'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const seedCatalog = require('./catalog.json');
const packSizes = require('./public/pack-sizes');
const imageManifest = require('./public/images/manifest.json');
const chemicals = require('./public/chemical-math');
const chemicalOrders = require('./chemical-orders');
const chemicalSettings = require('./public/chemical-settings');
const {reportOrderAdvice} = require('./public/chemical-trends');
const chemicalHistorySeed = require('./chemical-history-2026.json');
const { createMailer, buildReportEmail, validAddress } = require('./email');
const worksheets = [
  { id: 'operating', name: 'Operating Supplies', sourceSheet: 1 },
  { id: 'janitorial', name: 'Janitorial Supplies', sourceSheet: 2 },
  { id: 'dewatering', name: 'Dewatering Supplies', sourceSheet: 3 }
];

function createApp({ dataDir = process.env.DATA_DIR || path.join(__dirname, 'data'), mailer = createMailer(), chemicalHistory = chemicalHistorySeed.records } = {}) {
  let sendingEmail = false, nextEmailAt = 0;
  const releaseHash = createHash('sha256');
  for (const name of ['server.js', 'email.js', 'catalog.json', 'public/images/manifest.json', 'public/index.html', 'public/styles.css', 'public/app.js', 'public/pack-sizes.js', 'public/product-images.js', 'public/bin-cards.js', 'public/bin-cards.html', 'public/bin-cards.css', 'public/bin-card-print.js', 'public/vendor/qrcode.js', 'public/branding/northglenn-logo.png']) releaseHash.update(fs.readFileSync(path.join(__dirname, name)));
  for (const name of ["operations-theme.css","shared/operations/theme.css","shared/operations/navigation.css","shared/operations/header.css","shared/operations/navigation.js","shared/operations/users.js","shared/operations/Inter-VariableFont_opsz,wght.ttf","shared/operations/Inter-LICENSE.txt"]) releaseHash.update(fs.readFileSync(path.join(__dirname, 'public', name)));
  for(const name of ['trends.html','trends.js','trends.css','supply-trends.html','supply-trends.js','supply-trend-math.js','supply-trends.css','chemical-math.js','chemical-trends.js','chemical-inventory.html','chemical-inventory.js','chemical-inventory.css'])releaseHash.update(fs.readFileSync(path.join(__dirname,'public',name)));
  releaseHash.update(fs.readFileSync(path.join(__dirname,'chemical-history-2026.json')));
  const release = releaseHash.digest('hex').slice(0, 12);
  fs.mkdirSync(dataDir, { recursive: true });
  const file = path.join(dataDir, 'inventories.json');
  let state = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { inventories: [] };
  const currentCatalog = () => ({...seedCatalog, items:(state.catalogItems || seedCatalog.items).map(packSizes.normalize), revision:state.catalogRevision || 0});
  const persist = next => {
    const temp = file + '.tmp';
    const fd = fs.openSync(temp, 'w');
    try { fs.writeFileSync(fd, JSON.stringify(next, null, 2)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    fs.renameSync(temp, file);
    state = next;
  };
  // Import cached workbook values once. Never overwrite app readings on matching dates.
  if(chemicalHistory.length && !(state.chemicalInventory?.imports||[]).includes(chemicalHistorySeed.id)){
    if(fs.existsSync(file)){
      const backups=path.join(dataDir,'backups');fs.mkdirSync(backups,{recursive:true});
      fs.copyFileSync(file,path.join(backups,'before-chemical-import-'+Date.now()+'.json'),fs.constants.COPYFILE_EXCL);
    }
    const current=state.chemicalInventory||{revision:0,records:[]},dates=new Set(current.records.map(r=>r.date)),now=new Date().toISOString();
    const imported=chemicalHistory.filter(r=>!dates.has(r.date)).map(r=>({
      date:r.date,operator:'Not recorded in workbook',notes:'Imported recorded gallons; historical tank formulas have not been recalculated.',
      readings:Object.fromEntries(chemicals.fields.map(([id])=>[id,id==='nwos'?r.nwos:null])),
      recordedGallons:{...r.recordedGallons},recordedWaterUsed:r.recordedWaterUsed,recordedWaterPreviousDate:r.recordedWaterPreviousDate,
      source:{type:'workbook',file:chemicalHistorySeed.source,sheet:chemicalHistorySeed.sheet,row:r.sourceRow},updatedAt:now
    }));
    persist({...state,chemicalInventory:{...current,revision:current.revision+1,records:[...current.records,...imported],imports:[...(current.imports||[]),chemicalHistorySeed.id]}});
  }
  // Preserve old snapshots; reopen only the latest app-entered partial inventory.
  if(state.chemicalInventory&&!state.chemicalInventory.draftLifecycleVersion){
    const current=state.chemicalInventory;
    const latest=current.records.filter(record=>record.source?.type!=='workbook').sort((a,b)=>(b.updatedAt||b.date).localeCompare(a.updatedAt||a.date))[0];
    const reopen=latest&&!latest.status&&!current.records.some(record=>record.status==='draft')&&chemicals.fields.some(([id])=>typeof latest.readings[id]!=='number');
    if(reopen&&fs.existsSync(file)){
      const backups=path.join(dataDir,'backups');fs.mkdirSync(backups,{recursive:true});fs.copyFileSync(file,path.join(backups,'before-chemical-drafts-'+Date.now()+'.json'),fs.constants.COPYFILE_EXCL);
    }
    persist({...state,chemicalInventory:{...current,draftLifecycleVersion:1,revision:(current.revision||0)+(reopen?1:0),records:current.records.map(record=>reopen&&record===latest?{...record,status:'draft'}:record)}});
  }
  const itemKey = item => {
    item = packSizes.normalize(item);
    return JSON.stringify([item.id,item.description,item.itemNumber,item.company,item.countSize]);
  };
  function queueCompletedInventories(next) {
    const processed = new Set(next.queuedInventoryIds || []);
    const entries = [...(next.orderList || [])];
    let changed = false, processedNew = false;
    for (const worksheet of worksheets) {
      const latest = next.inventories.filter(run => run.worksheet === worksheet.id && run.status === 'complete').sort((a,b) => b.date.localeCompare(a.date) || (b.completedAt || b.updatedAt).localeCompare(a.completedAt || a.updatedAt))[0];
      if (!latest) continue;
      const newLatest = !processed.has(latest.id);
      // Older reports must not become new purchases if newer history is deleted.
      for (const completed of next.inventories.filter(run => run.worksheet === worksheet.id && run.status === 'complete')) {
        if (!processed.has(completed.id)) { processed.add(completed.id); processedNew = true; }
      }
      if (!newLatest) continue;
      for (const original of latest.items) {
        const count = latest.counts[original.id];
        if (typeof original.par !== 'number' || typeof count !== 'number' || count > original.par) continue;
        const item = packSizes.normalize(original), key = itemKey(item);
        const index = entries.findIndex(entry => itemKey(entry.item) === key);
        const reference = {item,inventoryId:latest.id,inventoryDate:latest.date,operator:latest.operator,worksheet:latest.worksheet,inventoryStatus:latest.status,onHand:count};
        if (index >= 0) entries[index] = {...entries[index],...reference};
        else entries.push({id:randomUUID(),quantity:null,orderUnit:item.countSize || 'Each',notes:'',addedAt:new Date().toISOString(),...reference});
        changed = true;
      }
    }
    return processedNew ? {...next,queuedInventoryIds:[...processed],orderList:entries,orderListRevision:(next.orderListRevision || 0) + (changed ? 1 : 0)} : next;
  }
  // Remove the old combined records from persisted storage on upgrade.
  const retained = state.inventories.filter(run => run.worksheet !== 'legacy' && new Set(run.items.map(item => item.sourceSheet)).size <= 1);
  const removed = state.inventories.length - retained.length;
  if (removed) {
    persist({ ...state, inventories: retained });
    console.log(`Removed ${removed} old combined inventories.`);
  }
  const queued = queueCompletedInventories(state);
  if (queued !== state) persist(queued);
  const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
  function metadata(body) {
    if (typeof body.operator !== 'string' || !body.operator.trim() || body.operator.trim().length > 100) fail(400, 'Enter an operator name (up to 100 characters).');
    if (typeof body.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.date) || !Number.isFinite(Date.parse(body.date)) || new Date(body.date).toISOString().slice(0, 10) !== body.date) fail(400, 'Choose a valid inventory date.');
  }
  function summary(run) {
    const counted = Object.keys(run.counts).length;
    const low = run.items.filter(i => typeof run.counts[i.id] === 'number' && i.par !== null && run.counts[i.id] <= i.par).length;
    return { id: run.id, worksheet: run.worksheet, date: run.date, operator: run.operator, status: run.status, updatedAt: run.updatedAt, counted, total: run.items.length, low };
  }
  async function bodyOf(req) {
    let body = ''; for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body) > 100000) fail(413, 'Request is too large.'); }
    let parsed;
    try { parsed = JSON.parse(body); } catch { fail(400, 'Invalid JSON.'); }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) fail(400, 'Provide a JSON object.');
    return parsed;
  }
  return http.createServer(async (req, res) => {
    const json = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Inventory-Version': release }); res.end(JSON.stringify(data)); };
    try {
      const url = new URL(req.url, 'http://localhost');
      const route = url.pathname;
      if (route === '/api/health' && req.method === 'GET') return json(200, { ok: true });
      if (route === '/api/email-config' && req.method === 'GET') return json(200, { enabled:mailer.enabled, defaultTo:mailer.defaultTo });
      if (route === '/api/catalog' && req.method === 'GET') return json(200, { ...currentCatalog(), worksheets, images:imageManifest.items });
      const settingsState=()=>{const today=new Date().toLocaleDateString('en-CA',{timeZone:'America/Denver'});return{revision:state.chemicalSettings?.revision||0,active:chemicalSettings.resolve(state.chemicalSettings?.versions,today),versions:[chemicalSettings.baseline,...(state.chemicalSettings?.versions||[])]};};
      if(route==='/api/chemical-settings'&&req.method==='GET')return json(200,settingsState());
      if(route==='/api/chemical-settings'&&req.method==='POST'){
        let origin;try{origin=new URL(req.headers.origin);}catch{fail(403,'Save settings from the inventory app.');}if(!['http:','https:'].includes(origin.protocol)||origin.host!==req.headers.host)fail(403,'Save settings from the inventory app.');
        const body=await bodyOf(req),current=state.chemicalSettings||{revision:0,versions:[]};
        if(body.revision!==current.revision)fail(409,'Chemical settings changed elsewhere. Reload settings before saving. Your changes have not been saved.');
        metadata({date:body.effectiveFrom,operator:body.operator});
        if(!/^\d{4}-\d{2}-\d{2}$/.test(body.effectiveFrom)||new Date(body.effectiveFrom).toISOString().slice(0,10)!==body.effectiveFrom)fail(400,'Choose a valid effective date.');
        if(body.effectiveFrom<new Date().toLocaleDateString('en-CA',{timeZone:'America/Denver'}))fail(400,'Settings must take effect today or later. Historical records keep their saved settings.');
        if(typeof body.reason!=='string'||!body.reason.trim()||body.reason.length>500)fail(400,'Enter a change summary (up to 500 characters).');
        let settings;try{settings=chemicalSettings.validate(body.chemicalKey,body.settings);}catch(error){fail(400,error.message);}
        const base=chemicalSettings.resolve(current.versions,body.effectiveFrom),version={id:randomUUID(),effectiveFrom:body.effectiveFrom,createdAt:new Date().toISOString(),operator:body.operator.trim(),reason:body.reason.trim(),chemicalKey:body.chemicalKey,chemicals:{...base.chemicals,[body.chemicalKey]:settings}};
        persist({...state,chemicalSettings:{revision:current.revision+1,versions:[...current.versions,version]}});return json(201,settingsState());
      }
      const chemicalState=()=>{
        const records=chemicals.calculate((state.chemicalInventory?.records||[]).map(record=>({...record,status:record.status||'complete',counted:chemicals.fields.filter(([id])=>typeof record.readings[id]==='number').length,total:chemicals.fields.length})));
        return{revision:state.chemicalInventory?.revision||0,formulaVersion:chemicals.formulaVersion,records:records.map(record=>{const advice=reportOrderAdvice(records,record),needed=advice.filter(item=>item.decision==='Order Now').length,review=advice.filter(item=>['Reading Missing','Trend Unavailable'].includes(item.decision)).length;return{...record,orderSummary:{needed,review}};})};
      };
      if(route==='/api/chemicals'&&req.method==='GET')return json(200,chemicalState());
      const chemicalMatch=route.match(/^\/api\/chemicals\/records\/(\d{4}-\d{2}-\d{2})$/);
      if(chemicalMatch&&['PUT','DELETE'].includes(req.method)){
        if(req.headers.origin){let origin;try{origin=new URL(req.headers.origin);}catch{fail(403,'Save chemical readings from the inventory app.');}if(!['http:','https:'].includes(origin.protocol)||origin.host!==req.headers.host)fail(403,'Save chemical readings from the inventory app.');}
        if(req.headers['content-type']?.split(';')[0].trim()!=='application/json')fail(415,'Send chemical readings as JSON.');
        const body=await bodyOf(req),date=chemicalMatch[1],current=state.chemicalInventory||{revision:0,records:[]};
        if(body.revision!==current.revision)fail(409,'Chemical inventory changed in another browser. Reload to review the latest readings before saving. Your entries have not been saved.');
        if(!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)fail(400,'Choose a valid reading date.');
        let records=current.records.filter(r=>r.date!==date);
        if(req.method==='DELETE'){
          if(records.length===current.records.length)fail(404,'This chemical inventory no longer exists.');
        }else{
          const previous=current.records.find(r=>r.date===date);
          if(previous&&(previous.status||'complete')==='complete'&&body.editCompleted!==true)fail(409,'Use Edit to correct a completed inventory.');
          if(previous?.source?.type==='workbook'){
            metadata({...body,date});
            const keys=chemicals.chemicals.map(c=>c.id),values=body.recordedGallons;
            if(!values||typeof values!=='object'||Array.isArray(values)||Object.keys(values).some(key=>!keys.includes(key))||keys.some(key=>values[key]!==null&&(typeof values[key]!=='number'||!Number.isFinite(values[key])||values[key]<0||values[key]>1000000000)))fail(400,'Provide recorded gallons for each chemical, or null for an unrecorded value.');
            if(typeof body.notes!=='string'||body.notes.length>2000)fail(400,'Notes must be up to 2,000 characters.');
            records.push({...previous,operator:body.operator.trim(),notes:body.notes.trim(),recordedGallons:Object.fromEntries(keys.map(key=>[key,values[key]])),updatedAt:new Date().toISOString()});
            persist({...state,chemicalInventory:{...current,revision:current.revision+1,records}});
            return json(200,chemicalState());
          }
          const unfinished=current.records.find(r=>r.status==='draft'&&r.date!==date);
          if(unfinished&&(!previous||(previous.status||'complete')!=='complete'))return json(409,{error:'Resume or delete the unfinished chemical inventory from '+unfinished.date+' before starting another.',resumeDate:unfinished.date});
          metadata({...body,date});
          const numericMap=(input,keys)=>{
            if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!keys.includes(k)))fail(400,'Invalid chemical readings.');
            return Object.fromEntries(keys.map(key=>{const value=input[key]??null;if(value!==null&&(typeof value!=='number'||!Number.isFinite(value)||value<0||value>1000000000))fail(400,'Enter a nonnegative number, up to 1,000,000,000, or leave the field blank.');return[key,value];}));
          };
          const readings=numericMap(body.readings,chemicals.fields.map(f=>f[0]));
          const status=previous&&(previous.status||'complete')==='complete'?'complete':body.status??'draft';
          if(!['draft','complete'].includes(status))fail(400,'Choose draft or complete status.');
          if(status==='complete'&&Object.values(readings).some(v=>v===null))fail(400,'Enter every reading before completing chemical inventory. Use 0 for an empty tank or no stored stock.');
          if(typeof body.notes!=='string'||body.notes.length>2000)fail(400,'Notes must be up to 2,000 characters.');
          const now=new Date().toISOString();
          const version=previous?null:chemicalSettings.resolve(state.chemicalSettings?.versions,date);
          records.push({date,operator:body.operator.trim(),readings,notes:body.notes.trim(),status,settingsVersion:previous?.settingsVersion||version?.id||chemicalSettings.baseline.id,settingsSnapshot:previous?.settingsSnapshot||version?.chemicals||chemicalSettings.clone(chemicalSettings.defaults),createdAt:previous?.createdAt||previous?.updatedAt||now,updatedAt:now,...(status==='complete'?{completedAt:previous?.completedAt||now}:{})});
        }
        persist({...state,chemicalInventory:{...current,revision:current.revision+1,records}});
        return json(200,chemicalState());
      }
      const orderList = () => {const next=chemicalOrders.reconcile(state);if(next!==state)persist(next);return {items:state.orderList || [],revision:state.orderListRevision || 0,orders:state.orderHistory || []};};
      if (route === '/api/order-list' && req.method === 'GET') return json(200, orderList());
      const appendOrderMatch = route.match(/^\/api\/order-history\/([a-f0-9-]+)\/items$/);
      if (req.method === 'POST' && (route === '/api/order-list/manual' || appendOrderMatch)) {
        let origin;
        try { origin = new URL(req.headers.origin); } catch { fail(403,'Add items from the inventory app.'); }
        if (!['http:','https:'].includes(origin.protocol) || origin.host !== req.headers.host) fail(403,'Add items from the inventory app.');
        const body = await bodyOf(req), current = orderList();
        if (body.revision !== current.revision) fail(409,'Orders changed in another browser. Cancel, refresh, and try again.');
        const order = appendOrderMatch && current.orders.find(order => order.id === appendOrderMatch[1]);
        if (appendOrderMatch && !order) fail(404,'This order is no longer in history.');
        const item = currentCatalog().items.find(item => item.id === body.itemId);
        if (!item) fail(404,'This item is no longer in the catalog.');
        const destination = order ? order.items : current.items;
        if (destination.some(entry => itemKey(entry.item) === itemKey(item))) fail(409,order ? 'This item is already on this order.' : 'This item is already on the order list. Edit its order details instead.');
        if ((order && body.quantity === null) || (body.quantity !== null && (typeof body.quantity !== 'number' || !Number.isFinite(body.quantity) || body.quantity <= 0 || body.quantity > 1000000))) fail(400,order ? 'Enter the quantity purchased (greater than zero).' : 'Enter a positive quantity or leave it blank.');
        if (typeof body.orderUnit !== 'string' || !body.orderUnit.trim() || body.orderUnit.trim().length > 80) fail(400,'Enter the purchasing unit (up to 80 characters).');
        if (typeof body.notes !== 'string' || body.notes.length > 1000) fail(400,'Notes must be up to 1,000 characters.');
        const entry = {id:randomUUID(),item:structuredClone(item),source:'manual',quantity:body.quantity,orderUnit:body.orderUnit.trim(),notes:body.notes.trim(),addedAt:new Date().toISOString(),inventoryId:null,inventoryDate:null,operator:null,worksheet:worksheets.find(worksheet => worksheet.sourceSheet === item.sourceSheet)?.id || null,onHand:null};
        if (order) {
          const updated = {...order,items:[...order.items,entry],updatedAt:new Date().toISOString()};
          persist({...state,orderHistory:current.orders.map(old => old.id === updated.id ? updated : old),orderListRevision:current.revision + 1});
        } else persist({...state,orderList:[...current.items,entry],orderListRevision:current.revision + 1});
        return json(201,orderList());
      }
      const orderHistoryMatch = route.match(/^\/api\/order-history\/([a-f0-9-]+)$/);
      if (orderHistoryMatch && req.method === 'DELETE') {
        let origin;
        try { origin = new URL(req.headers.origin); } catch { fail(403,'Delete orders from the inventory app.'); }
        if (!['http:','https:'].includes(origin.protocol) || origin.host !== req.headers.host) fail(403,'Delete orders from the inventory app.');
        const body = await bodyOf(req);
        if (body.revision !== (state.orderListRevision || 0)) fail(409,'Orders changed on another phone. Refresh Order History and try again.');
        if (!(state.orderHistory || []).some(order => order.id === orderHistoryMatch[1])) fail(404,'This order is no longer in history.');
        persist({...state,orderHistory:state.orderHistory.filter(order => order.id !== orderHistoryMatch[1]),orderListRevision:(state.orderListRevision || 0) + 1});
        return json(200,orderList());
      }
      const listMatch = route.match(/^\/api\/order-list\/([a-f0-9-]+)$/);
      if ((['/api/order-list','/api/order-list/ordered'].includes(route) && req.method === 'POST') || (listMatch && ['PATCH','DELETE'].includes(req.method))) {
        let origin;
        try { origin = new URL(req.headers.origin); } catch { fail(403,'Manage the order list from the inventory app.'); }
        if (!['http:','https:'].includes(origin.protocol) || origin.host !== req.headers.host) fail(403,'Manage the order list from the inventory app.');
        const body = await bodyOf(req), current = orderList();
        if (body.revision !== current.revision) fail(409,'The order list changed on another phone. Refresh it and try again.');
        if (route === '/api/order-list/ordered') {
          metadata(body);
          if (!Array.isArray(body.ids) || !body.ids.length || body.ids.length > 500 || new Set(body.ids).size !== body.ids.length || body.ids.some(id => typeof id !== 'string')) fail(400,'Select the items you ordered.');
          const selected = body.ids.map(id => current.items.find(entry => entry.id === id));
          if (selected.some(entry => !entry)) fail(409,'A selected item is no longer on the list. Refresh and review your selection.');
          if (selected.some(entry => typeof entry.quantity !== 'number' || !Number.isFinite(entry.quantity) || entry.quantity <= 0 || !entry.orderUnit?.trim())) fail(400,'Set a quantity and purchasing unit for every selected item first.');
          if(selected.some(entry=>entry.chemicalKey&&(!entry.item.company?.trim()||!entry.deliveryDate||entry.deliveryDate<body.date)))fail(400,'Set a supplier and a delivery date on or after the order date for each chemical.');
          if (typeof body.reference !== 'string' || body.reference.length > 200) fail(400,'Order reference must be up to 200 characters.');
          const order = {id:randomUUID(),date:body.date,operator:body.operator.trim(),reference:body.reference.trim(),recordedAt:new Date().toISOString(),items:selected};
          const resolutions={...state.chemicalOrderResolutions};for(const entry of selected.filter(e=>e.chemicalKey))resolutions[entry.chemicalKey]={readingKey:entry.readingKey,action:'placed',orderId:order.id};
          persist({...state,chemicalOrderResolutions:resolutions,orderList:current.items.filter(entry => !body.ids.includes(entry.id)),orderListRevision:current.revision + 1,orderHistory:[order,...(state.orderHistory || [])]});
          return json(201,orderList());
        }
        if (req.method === 'PATCH') {
          const existing = current.items.find(entry => entry.id === listMatch[1]);
          if (!existing) fail(404,'This item is no longer on the order list.');
          if (body.quantity !== null && (typeof body.quantity !== 'number' || !Number.isFinite(body.quantity) || body.quantity <= 0 || body.quantity > 1000000)) fail(400,'Enter a quantity greater than zero and no more than 1,000,000, or leave it blank.');
          if (typeof body.orderUnit !== 'string' || !body.orderUnit.trim() || body.orderUnit.trim().length > 80) fail(400,'Enter the purchasing unit (up to 80 characters).');
          if (typeof body.notes !== 'string' || body.notes.length > 1000) fail(400,'Order notes must be up to 1,000 characters.');
          const updated = {...existing,quantity:body.quantity,orderUnit:body.orderUnit.trim(),notes:body.notes.trim(),updatedAt:new Date().toISOString()};
          if(existing.chemicalKey){
            if(typeof body.supplier!=='string'||body.supplier.length>200)fail(400,'Enter a supplier name (up to 200 characters).');
            if(typeof body.deliveryDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(body.deliveryDate)||!Number.isFinite(Date.parse(body.deliveryDate))||new Date(body.deliveryDate).toISOString().slice(0,10)!==body.deliveryDate)fail(400,'Choose a valid chemical delivery date.');
            updated.item={...existing.item,company:body.supplier.trim()};updated.deliveryDate=body.deliveryDate;updated.deliveryDateEdited=true;
          }
          persist({...state,orderList:current.items.map(entry => entry.id === updated.id ? updated : entry),orderListRevision:current.revision + 1});
          return json(200,orderList());
        }
        if (req.method === 'DELETE') {
          if (!current.items.some(entry => entry.id === listMatch[1])) fail(404,'This item is no longer on the order list.');
          const removed=current.items.find(entry=>entry.id===listMatch[1]),resolutions={...state.chemicalOrderResolutions};if(removed.chemicalKey)resolutions[removed.chemicalKey]={readingKey:removed.readingKey,action:'removed'};
          persist({...state,chemicalOrderResolutions:resolutions,orderList:current.items.filter(entry => entry.id !== listMatch[1]),orderListRevision:current.revision + 1});
          return json(200,orderList());
        }
        const inventory = state.inventories.find(run => run.id === body.inventoryId);
        if (!inventory) fail(404,'Inventory was not found.');
        if (inventory.revision !== body.inventoryRevision) fail(409,'This inventory changed. Reopen Order Needed before adding items.');
        const original = inventory.items.find(item => item.id === body.itemId);
        if (!original) fail(404,'Item was not found in this inventory.');
        const count = inventory.counts[original.id];
        if (original.par !== null && !(typeof count === 'number' && count <= original.par)) fail(400,'Only items at or below PAR or marked for manual review can be added.');
        const item = packSizes.normalize(original);
        const sameItem = entry => entry.item.id === item.id && entry.item.description === item.description && entry.item.itemNumber === item.itemNumber && entry.item.company === item.company && entry.item.countSize === item.countSize;
        if ((state.orderHistory || []).some(order => order.items.some(entry => entry.inventoryId === inventory.id && sameItem(entry)))) fail(409,'This item was already recorded as ordered from this inventory.');
        if (current.items.some(sameItem)) return json(200,{...current,alreadyAdded:true});
        const entry = {id:randomUUID(),item,quantity:null,orderUnit:item.countSize || 'Each',notes:'',addedAt:new Date().toISOString(),inventoryId:inventory.id,inventoryDate:inventory.date,operator:inventory.operator,worksheet:inventory.worksheet,inventoryStatus:inventory.status,onHand:typeof count === 'number' ? count : null};
        persist({...state,orderList:[...current.items,entry],orderListRevision:current.revision + 1});
        return json(201,orderList());
      }
      const itemMatch = route.match(/^\/api\/catalog\/items\/([a-z0-9-]+)$/);
      if ((route === '/api/catalog/items' && req.method === 'POST') || (itemMatch && ['PATCH','DELETE'].includes(req.method))) {
        let origin;
        try { origin = new URL(req.headers.origin); } catch { fail(403,'Manage items from the inventory app.'); }
        if (!['http:','https:'].includes(origin.protocol) || origin.host !== req.headers.host) fail(403,'Manage items from the inventory app.');
        const body = await bodyOf(req), catalog = currentCatalog();
        if (body.revision !== catalog.revision) fail(409,'The item list changed in another browser. Reopen Manage items and try again.');
        const existing = itemMatch && catalog.items.find(item => item.id === itemMatch[1]);
        if (itemMatch && !existing) fail(404,'Item was not found.');
        let items;
        if (req.method === 'DELETE') items = catalog.items.filter(item => item.id !== existing.id);
        else {
          const worksheet = worksheets.find(w => w.id === body.worksheet);
          if (!worksheet) fail(400,'Choose a worksheet.');
          const field = (name, required = false, max = 200) => {
            if (body[name] !== undefined && body[name] !== null && typeof body[name] !== 'string') fail(400,`Invalid ${name}.`);
            const value = (body[name] || '').trim();
            if ((required && !value) || value.length > max) fail(400,`Enter ${name} (${required ? 'required, ' : ''}up to ${max} characters).`);
            return value;
          };
          const productUrl = field('productUrl',false,2000);
          if (productUrl) {
            let url; try { url = new URL(productUrl); } catch { fail(400,'Enter a valid product page URL.'); }
            if (!['http:','https:'].includes(url.protocol) || url.username || url.password) fail(400,'Use an HTTP or HTTPS product page URL without credentials.');
          }
          if (body.par !== null && (typeof body.par !== 'number' || !Number.isFinite(body.par) || body.par < 0 || body.par > 1000000000)) fail(400,'PAR must be a nonnegative number, or blank for manual review.');
          const item = {...existing,id:existing?.id || 'custom-' + randomUUID(),sourceSheet:worksheet.sourceSheet,sourceRow:existing?.sourceRow || null,category:worksheet.name,description:field('description',true),location:field('location',true),countSize:field('countSize',true),par:body.par,parNote:field('parNote'),company:field('company'),itemNumber:field('itemNumber'),caseSize:field('caseSize'),productUrl};
          items = existing ? catalog.items.map(old => old.id === item.id ? item : old) : [...catalog.items,item];
        }
        persist({...state,catalogItems:items,catalogRevision:catalog.revision + 1});
        return json(req.method === 'POST' ? 201 : 200,{...currentCatalog(),worksheets,images:imageManifest.items});
      }
      if (route === '/api/supply-trends' && req.method === 'GET') return json(200, state.inventories.filter(record=>record.worksheet==='operating'&&record.status==='complete').map(record=>({id:record.id,worksheet:record.worksheet,status:record.status,date:record.date,operator:record.operator,updatedAt:record.updatedAt,items:record.items.map(packSizes.normalize),counts:record.counts})));
      if (route === '/api/inventories' && req.method === 'GET') return json(200, state.inventories.map(summary).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)));
      if (route === '/api/inventories' && req.method === 'POST') {
        const body = await bodyOf(req); metadata(body);
        const worksheet = worksheets.find(w => w.id === body.worksheet);
        if (!worksheet) fail(400, 'Choose Operating Supplies, Janitorial Supplies, or Dewatering Supplies.');
        const unfinished=state.inventories.filter(record=>record.worksheet===worksheet.id&&record.status==='draft').sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0];
        if(unfinished)return json(200,{...unfinished,resumed:true});
        const items = structuredClone(currentCatalog().items.filter(i => i.sourceSheet === worksheet.sourceSheet));
        if (!items.length) fail(400,'This worksheet has no items. Add items before starting inventory.');
        const previous = state.inventories.filter(r => r.worksheet === worksheet.id && r.status === 'complete').sort((a,b) => b.date.localeCompare(a.date) || (b.completedAt || b.updatedAt).localeCompare(a.completedAt || a.updatedAt))[0];
        const previousCounts = {};
        for (const item of items) {
          // Row numbers can move on re-import. Only reuse matching names, units, and locations.
          const matches = previous?.items.filter(old => packSizes.normalize(old).description === item.description && packSizes.countSize(old) === item.countSize && old.location === item.location) || [];
          const old = matches.length === 1 ? matches[0] : matches.find(old => old.id === item.id);
          const value = old ? previous.counts[old.id] : undefined;
          if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1000000000) previousCounts[item.id] = value;
        }
        const run = { id: randomUUID(), worksheet: worksheet.id, date: body.date, operator: body.operator.trim(), status: 'draft', revision: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), counts: {}, items, previousCounts, sourceInventoryId: previous?.id || null, sourceInventoryDate: previous?.date || null };
        persist({ ...state, inventories: [...state.inventories, run] }); return json(201, run);
      }
      const emailMatch = route.match(/^\/api\/inventories\/([a-f0-9-]+)\/email$/);
      if (emailMatch && req.method === 'POST') {
        let origin;
        try { origin = new URL(req.headers.origin); } catch { fail(403, 'Send email from the inventory app.'); }
        if (!['http:','https:'].includes(origin.protocol) || origin.host !== req.headers.host) fail(403, 'Send email from the inventory app.');
        if (!mailer.enabled) fail(503, 'Email sending has not been configured on the server.');
        const body = await bodyOf(req);
        if (!validAddress(body.to)) fail(400, 'Enter one valid recipient email address.');
        const inventory = state.inventories.find(r => r.id === emailMatch[1]);
        if (!inventory) fail(404, 'Inventory was not found.');
        if (body.revision !== inventory.revision) fail(409, 'This inventory changed. Reopen the report before emailing it.');
        if (sendingEmail || Date.now() < nextEmailAt) fail(429, 'Please wait 30 seconds before sending another email.');
        sendingEmail = true;
        try {
          await mailer.send(body.to, buildReportEmail(inventory, worksheets.find(w => w.id === inventory.worksheet)?.name || 'Inventory'));
          nextEmailAt = Date.now() + 30000;
          return json(200, { accepted:true, to:body.to });
        } catch (error) {
          console.error('Report email failed:', error.code || 'SMTP_SEND_FAILED');
          nextEmailAt = Date.now() + 5000;
          fail(502, 'Could not confirm email acceptance. Check the recipient inbox before retrying, then check the server email settings.');
        } finally { sendingEmail = false; }
      }
      const match = route.match(/^\/api\/inventories\/([a-f0-9-]+)$/);
      if (match) {
        const run = state.inventories.find(r => r.id === match[1]);
        if (!run) fail(404, 'Inventory was not found.');
        if (req.method === 'GET') return json(200, run);
        if (req.method === 'DELETE') {
          const body = await bodyOf(req);
          const current = state.inventories.find(r => r.id === match[1]);
          if (!current) fail(404, 'Inventory was not found.');
          if (body.revision !== current.revision) fail(409, 'This inventory changed elsewhere. Open the delete confirmation again to review it.');
          persist({ ...state, inventories:state.inventories.filter(r => r.id !== current.id) });
          return json(200, { deleted:current.id });
        }
        if (req.method === 'PATCH') {
          const body = await bodyOf(req);
          // Re-read after awaiting the request: another request may have saved in the meantime.
          const current = state.inventories.find(r => r.id === match[1]);
          if (!current) fail(404, 'This inventory was deleted.');
          if (body.revision !== current.revision) fail(409, 'This inventory changed in another browser. Reload it before making more changes.');
          if (current.status === 'complete' && body.editCompleted !== true) fail(409, 'Use Edit to correct a completed inventory.');
          if (!body.counts || typeof body.counts !== 'object' || Array.isArray(body.counts)) fail(400, 'Provide item counts.');
          const counts = { ...current.counts };
          for (const [id, count] of Object.entries(body.counts)) {
            if (!current.items.some(i => i.id === id)) fail(400, 'Unknown inventory item.');
            if (count === null) { if(current.status==='complete')fail(400,'Completed inventory counts cannot be cleared. Enter 0 for no stock.');delete counts[id]; continue; }
            if (typeof count !== 'number' || !Number.isFinite(count) || count < 0 || count > 1000000000) fail(400, 'Counts must be numbers from 0 to 1,000,000,000.');
            counts[id] = count;
          }
          if (body.status !== undefined && !['draft', 'complete'].includes(body.status)) fail(400, 'Invalid inventory status.');
          if (body.status === 'complete' && current.items.some(i => counts[i.id] === undefined)) fail(400, 'Count every item before completing inventory. Use 0 for items with no stock.');
          const updated = { ...current, counts, status: current.status==='complete'?'complete':body.status || current.status, revision: current.revision + 1, updatedAt: new Date().toISOString() };
          if (updated.status === 'complete') updated.completedAt = current.completedAt || updated.updatedAt;
          persist(queueCompletedInventories({ ...state, inventories: state.inventories.map(r => r.id === updated.id ? updated : r) })); return json(200, updated);
        }
      }
      if (route.startsWith('/api/')) return json(404, { error: 'Endpoint not found.' });
      if (!['GET', 'HEAD'].includes(req.method)) return json(405, { error: 'Method not allowed.' });
      const assets = { '/': 'index.html', '/index.html': 'index.html', '/app.js': 'app.js', '/pack-sizes.js':'pack-sizes.js', '/styles.css': 'styles.css', '/branding/northglenn-logo.png':'branding/northglenn-logo.png' };
      for(const name of ['trends.html','trends.js','trends.css','supply-trends.html','supply-trends.js','supply-trend-math.js','supply-trends.css'])assets['/'+name]=name;
      for(const name of ['chemical-settings.js','chemical-settings-manager.js','chemical-settings-manager.css','chemical-math.js','chemical-trends.js','chemical-inventory.html','chemical-inventory.js','chemical-inventory.css'])assets['/'+name]=name;
      for (const asset of ['product-images.js','bin-cards.html','bin-cards.js','bin-cards.css','bin-card-print.js','vendor/qrcode.js','licenses/qrcode-MIT.txt']) assets['/' + asset] = asset;
      for (const asset of ["operations-theme.css","shared/operations/theme.css","shared/operations/navigation.css","shared/operations/header.css","shared/operations/navigation.js","shared/operations/users.js","shared/operations/Inter-VariableFont_opsz,wght.ttf","shared/operations/Inter-LICENSE.txt"]) assets['/' + asset] = asset;
      // Only filenames in the imported manifest are exposed, never arbitrary paths.
      for (const photo of Object.values(imageManifest.items)) {
        if (/^\/images\/s[123]-r\d+\.(jpg|png|webp|gif)$/.test(photo.src)) assets[photo.src] = photo.src.slice(1);
      }
      if (!assets[route]) return json(404, { error: 'Page not found.' });
      const asset = assets[route];
      const imageType = { '.jpg':'image/jpeg', '.png':'image/png', '.webp':'image/webp', '.gif':'image/gif', '.ttf':'font/ttf', '.txt':'text/plain; charset=utf-8' }[path.extname(asset)];
      res.writeHead(200, { 'Content-Type': imageType || (asset.endsWith('.css') ? 'text/css; charset=utf-8' : asset.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8'), 'Cache-Control': 'no-store', 'X-Inventory-Version': release, 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' https://water.gibbhub.io; frame-ancestors 'self'" });
      let content = fs.readFileSync(path.join(__dirname, 'public', asset));
      if (asset.endsWith('.html')) content = content.toString('utf8').replace(/(href|src)="\.\/([\w/-]+\.(?:css|js))(?:\?[^\"]*)?"/g, (_, attr, name) => `${attr}="./${name}?v=${release}"`);
      res.end(req.method === 'HEAD' ? undefined : content);
    } catch (error) {
      if (!error.status) console.error(error);
      json(error.status || 500, { error: error.status ? error.message : 'Could not save or load inventory. Check server storage and try again.' });
    }
  });
}
if (require.main === module) {
  const server = createApp();
  server.listen(Number(process.env.PORT || 3080), '0.0.0.0', () => console.log(`Operator Inventory listening on port ${process.env.PORT || 3080}`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
}
module.exports = { createApp };
