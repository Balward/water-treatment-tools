'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const {randomUUID} = require('node:crypto');
const template = require('./apps/plant-rounds/template.json');
const shifts = ['AM','PM'];
const initialUsers=[['Blaine','Alward'],['Carson','Conlin'],['Kyle','Heckman'],['John','Colmey'],['Zak','Brennnecke'],['Ted','Strickler'],['Gene','Hutson']].map(([firstName,lastName])=>({id:'user-'+firstName.toLowerCase()+'-'+lastName.toLowerCase(),firstName,lastName,active:true}));
const blankShift = () => ({operator:'',startedAt:null,completedAt:null,entries:{}});
const blankDay = date => ({version:1,date,updatedAt:null,shifts:{AM:blankShift(),PM:blankShift()},notes:[],history:[]});
function normalizeField(field){
  const next={...field};
  const units={'in':'in','gpm':'gpm','psi':'psi','ntu':'NTU','mg/l':'mg/L','ft':'ft','mgd':'MGD','l/min':'L/Min','k gallons':'k gallons'};
  if(next.type==='number'){
    if(/\bpsi\b/i.test(next.label) || /^psi$/i.test(next.unit || '')){
      next.label=next.label.replace(/\s*\(?\bpsi\b\)?/gi,'').trim();
      if(!/\bpressure\b/i.test(next.label))next.label+=' Pressure';
      next.unit='psi';
    }
    next.label=next.label.replace(/\s*\(([^()]+)\)/g,(match,content)=>{
      const unit=units[content.trim().toLowerCase()];
      if(!unit)return match;
      next.unit ||= unit;return '';
    }).trim();
    if(next.unit)next.unit=units[next.unit.toLowerCase()] || next.unit;
  }
  if(next.type==='yesno')next.label=next.label.replace(/\s*\(\s*y(?:es)?\s*(?:\/|,|-|\bor\b)\s*n(?:o)?\s*\)/gi,'').trim();
  return next;
}
function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value+'T12:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === value && Number(value.slice(0,4)) >= 2000;
}
function answered(field,entry) {
  if (!entry || entry.value === null || entry.value === '') return false;
  if (field.type === 'number') return entry.value === 'na' || (typeof entry.value === 'number' && Number.isFinite(entry.value));
  return field.type !== 'check' || entry.value === true || entry.value === 'na';
}
function progress(day,shift) {
  const required = (day.template || template).fields.filter(field => field.required && field.shifts.includes(shift));
  return {total:required.length,done:required.filter(field => answered(field,day.shifts[shift].entries[field.id])).length};
}
module.exports = function registerPlantRounds(app,options = {}) {
  const directory = options.directory || process.env.PLANT_ROUNDS_DATA_DIR || path.join(__dirname,'data','plant-rounds');
  let queue = Promise.resolve();
  function fail(status,message,extra = {}) { const error = new Error(message);error.status=status;Object.assign(error,extra);throw error; }
  async function catalog(){
    try{
      const saved=JSON.parse(await fs.readFile(path.join(directory,'checklist.json'),'utf8'));
      if(!Number.isSafeInteger(saved.revision) || !Array.isArray(saved.fields) || !Array.isArray(saved.locations) || !Array.isArray(saved.history))throw new Error('Invalid rounds checklist');
      saved.fields=saved.fields.map(normalizeField);
      return saved;
    }catch(error){if(error.code==='ENOENT')return {...template,revision:0,history:[]};throw error;}
  }
  const snapshot=catalog=>{const {history,...checklist}=catalog;return checklist;};
  async function read(date) {
    try {
      const day = JSON.parse(await fs.readFile(path.join(directory,date+'.json'),'utf8'));
      if(day.version!==1 || day.date!==date || !day.shifts?.AM?.entries || !day.shifts?.PM?.entries || !Array.isArray(day.notes) || !Array.isArray(day.history)) throw new Error('Invalid rounds record');
      if(day.template && (!Array.isArray(day.template.fields) || !Array.isArray(day.template.locations)))throw new Error('Invalid saved rounds checklist');
      day.template ||= snapshot(await catalog());
      return day;
    } catch(error) { if(error.code==='ENOENT')return {...blankDay(date),template:snapshot(await catalog())};throw error; }
  }
  async function writeFile(filename,value) {
    await fs.mkdir(directory,{recursive:true});
    const file=path.join(directory,filename),temporary=file+'.'+randomUUID()+'.tmp';
    try { await fs.writeFile(temporary,JSON.stringify(value,null,2));await fs.rename(temporary,file); }
    finally { await fs.unlink(temporary).catch(()=>{}); }
  }
  const write=day=>writeFile(day.date+'.json',day);
  async function users(){
    try{
      const saved=JSON.parse(await fs.readFile(path.join(directory,'users.json'),'utf8'));
      if(!Number.isSafeInteger(saved.revision) || !Array.isArray(saved.users) || !Array.isArray(saved.history) || saved.users.some(user=>!user.id || !user.firstName || !user.lastName || typeof user.active!=='boolean'))throw new Error('Invalid rounds user list');
      return saved;
    }catch(error){if(error.code==='ENOENT')return {revision:0,users:structuredClone(initialUsers),history:[]};throw error;}
  }
  const userResponse=directory=>({revision:directory.revision,users:directory.users.map(user=>({...user,name:user.firstName+' '+user.lastName}))});
  const response = day => ({...day,progress:{AM:progress(day,'AM'),PM:progress(day,'PM')}});
  function route(handler) {
    return async(req,res) => {
      res.set('Cache-Control','no-store');
      try {
        if(req.params.date && !validDate(req.params.date))fail(400,'Choose a valid calendar date.');
        if(req.params.shift && !shifts.includes(req.params.shift))fail(400,'Choose AM or PM.');
        await handler(req,res);
      } catch(error) {
        if(!error.status)console.error('Plant rounds storage error:',error.message);
        res.status(error.status || 503).json({error:error.status ? error.message : 'Rounds could not be saved or loaded. Your existing records have not been replaced.',...(error.current ? {current:error.current} : {})});
      }
    };
  }
  async function operator(req) {
    const name=req.body?.operator;
    if(typeof name!=='string' || !name.trim() || name.trim().length>80)fail(400,'Enter an operator name (up to 80 characters).');
    const user=(await users()).users.find(user=>user.active && user.firstName+' '+user.lastName===name.trim());
    if(!user)fail(400,'Select an active operator. Refresh the user list if it has changed.');
    req.operatorId=user.id;return user.firstName+' '+user.lastName;
  }
  async function change(req,res,mutate,project=result=>result) {
    const operation = queue.then(async()=>{
      const name=await operator(req);
      const day=await read(req.params.date),now=new Date().toISOString();
      const historyLength=day.history.length;
      await mutate(day,name,now);
      for(const event of day.history.slice(historyLength))event.operatorId=req.operatorId;
      day.updatedAt=now;
      await write(day);
      return response(day);
    });
    queue=operation.catch(()=>{});
    res.json(project(await operation));
  }
  app.get('/api/plant-rounds/template',route(async(req,res)=>res.json(snapshot(await catalog()))));
  app.get(['/api/plant-rounds/users','/api/operations/users'],route(async(req,res)=>res.json(userResponse(await users()))));
  const referenceKeys=['influentFlow','filterFlow','alum','polymer','naoh','hypochlorite','permanganate'];
  function reference(day,shift){
    const saved=day.shifts[shift].drawdownReference;
    if(saved && (!Number.isSafeInteger(saved.revision) || !saved.values || referenceKeys.some(key=>saved.values[key]!==null && (typeof saved.values[key]!=='number' || !Number.isFinite(saved.values[key]) || saved.values[key]<0))))throw new Error('Invalid drawdown reference record');
    return {date:day.date,shift,...(saved || {revision:0,values:Object.fromEntries(referenceKeys.map(key=>[key,null])),updatedAt:null,updatedBy:null,updatedById:null})};
  }
  app.all('/api/plant-rounds/drawdown-reference',route(async()=>fail(410,'Drawdown values now require a rounds date and AM/PM shift. Reload Plant Rounds.')));
  app.get('/api/plant-rounds/:date/:shift/drawdown-reference',route(async(req,res)=>res.json(reference(await read(req.params.date),req.params.shift))));
  app.put('/api/plant-rounds/:date/:shift/drawdown-reference',route((req,res)=>change(req,res,(day,name,now)=>{
      const current=reference(day,req.params.shift),{revision,values}=req.body || {};
      if(revision!==current.revision)fail(409,'Another operator updated this shift’s reference values. Reload saved values before making your changes.',{current});
      if(!values || typeof values!=='object' || Array.isArray(values) || Object.keys(values).length!==referenceKeys.length || referenceKeys.some(key=>values[key]!==null && (typeof values[key]!=='number' || !Number.isFinite(values[key]) || values[key]<0)))fail(400,'Enter nonnegative numbers, or leave a reference value blank.');
      const shift=day.shifts[req.params.shift];
      shift.drawdownReference={revision:revision+1,values:Object.fromEntries(referenceKeys.map(key=>[key,values[key]])),updatedAt:now,updatedBy:name,updatedById:req.operatorId};
      shift.startedAt ||= now;shift.operator ||= name;shift.operatorId ||= req.operatorId;shift.completedAt=null;
      day.history.push({at:now,operator:name,shift:req.params.shift,action:'drawdown-reference',previous:current.values,values:shift.drawdownReference.values});
  },day=>reference(day,req.params.shift))));
  async function manageUser(req,res,action){
    const operation=queue.then(async()=>{
      const directory=await users();
      if(req.body?.revision!==directory.revision)fail(409,'The user list changed. Refresh before saving.');
      const previous=directory.users.find(user=>user.id===req.params.id);
      if(action!=='add' && !previous)fail(404,'This user could not be found.');
      const {firstName,lastName,active}=req.body || {};
      if(action!=='deactivate'){
        if(typeof firstName!=='string' || !firstName.trim() || firstName.trim().length>40 || typeof lastName!=='string' || !lastName.trim() || lastName.trim().length>40 || firstName.trim().length+lastName.trim().length>79)fail(400,'Enter both first and last name (up to 80 characters combined).');
        if(typeof active!=='boolean')fail(400,'Choose active or inactive status.');
      }
      const next=action==='deactivate'?{...previous,active:false}:{...(previous || {id:'user-'+randomUUID()}),firstName:firstName.trim(),lastName:lastName.trim(),active};
      const name=(next.firstName+' '+next.lastName).toLowerCase();
      if(directory.users.some(user=>user.id!==next.id && (user.firstName+' '+user.lastName).toLowerCase()===name))fail(400,'This user already exists. Edit or reactivate their existing record.');
      directory.users=previous?directory.users.map(user=>user.id===next.id?next:user):[...directory.users,next];
      directory.revision++;directory.history.push({at:new Date().toISOString(),action,previous:previous || null,user:next});
      await writeFile('users.json',directory);return userResponse(directory);
    });queue=operation.catch(()=>{});res.json(await operation);
  }
  app.post(['/api/plant-rounds/users','/api/operations/users'],route((req,res)=>manageUser(req,res,'add')));
  app.put(['/api/plant-rounds/users/:id','/api/operations/users/:id'],route((req,res)=>manageUser(req,res,'edit')));
  app.delete(['/api/plant-rounds/users/:id','/api/operations/users/:id'],route((req,res)=>manageUser(req,res,'deactivate')));
  function item(body,current){
    const {label,location,section,type,unit,required,shifts:scheduled}=body || {};
    for(const [name,value,max] of [['Item Name',label,120],['Section',section,80],['Unit',unit ?? '',24]])if(typeof value!=='string' || value.length>max || name!=='Unit' && !value.trim())fail(400,'Enter a valid '+name+' (up to '+max+' characters).');
    if(!current.locations.some(entry=>entry.id===location))fail(400,'Choose a valid location.');
    if(!['number','check','yesno','text'].includes(type))fail(400,'Choose a valid entry type.');
    if(typeof required!=='boolean')fail(400,'Choose whether the item is required.');
    if(!Array.isArray(scheduled) || !scheduled.length || scheduled.length>2 || new Set(scheduled).size!==scheduled.length || scheduled.some(shift=>!shifts.includes(shift)))fail(400,'Select AM, PM, or both.');
    return {label:label.trim(),location,section:section.trim(),type,required,shifts:shifts.filter(shift=>scheduled.includes(shift)),...(type==='number' && unit?.trim()?{unit:unit.trim()}:{})};
  }
  async function manage(req,res,action){
    const operation=queue.then(async()=>{
      const name=await operator(req);
      const current=await catalog();
      if(req.body?.revision!==current.revision)fail(409,'The checklist changed. Refresh before saving your changes.');
      const previous=current.fields.find(field=>field.id===req.params.id);
      if(action!=='add' && !previous)fail(404,'This rounds item has already been removed.');
      if(action==='add' && current.fields.length>=300)fail(400,'The checklist can contain up to 300 items.');
      let next=action==='remove'?null:{...(previous || {id:'custom-'+randomUUID()}),...item(req.body.item,current)};
      if(next && (next.type!=='number' || !req.body.item.unit?.trim()))delete next.unit;
      if(next)next=normalizeField(next);
      // Freeze legacy dates before changing the shared checklist. Interrupted
      // migrations can safely retry; the catalog is committed only after all succeed.
      let files=[];try{files=await fs.readdir(directory);}catch(error){if(error.code!=='ENOENT')throw error;}
      for(const file of files.filter(file=>file.endsWith('.json') && validDate(file.slice(0,-5)))){
        const stored=JSON.parse(await fs.readFile(path.join(directory,file),'utf8'));
        if(!stored.template){const day=await read(file.slice(0,-5));await write(day);}
      }
      current.fields=action==='add'?[...current.fields,next]:action==='remove'?current.fields.filter(field=>field.id!==previous.id):current.fields.map(field=>field.id===previous.id?next:field);
      current.revision++;current.history.push({at:new Date().toISOString(),operator:name,operatorId:req.operatorId,action,previous:previous || null,item:next});
      await writeFile('checklist.json',current);return snapshot(current);
    });
    queue=operation.catch(()=>{});res.json(await operation);
  }
  app.post('/api/plant-rounds/items',route((req,res)=>manage(req,res,'add')));
  app.put('/api/plant-rounds/items/:id',route((req,res)=>manage(req,res,'edit')));
  app.delete('/api/plant-rounds/items/:id',route((req,res)=>manage(req,res,'remove')));
  app.get('/api/plant-rounds/history',route(async(req,res)=>{
    const month=req.query.month;
    if(typeof month!=='string' || !validDate(month+'-01'))fail(400,'Choose a valid month (YYYY-MM).');
    let files;
    try{files=await fs.readdir(directory);}catch(error){if(error.code!=='ENOENT')throw error;files=[];}
    const dates=files.filter(file=>file.startsWith(month+'-') && file.endsWith('.json') && validDate(file.slice(0,-5))).map(file=>file.slice(0,-5)).sort().reverse();
    const days=[];
    for(const date of dates){
      const day=await read(date);
      days.push({date,notes:day.notes.length,shifts:Object.fromEntries(shifts.map(shift=>[shift,{operator:day.shifts[shift].operator,startedAt:day.shifts[shift].startedAt,completedAt:day.shifts[shift].completedAt,...progress(day,shift)}]))});
    }
    res.json({month,days});
  }));
  app.get('/api/plant-rounds/:date/report.pdf',route(async(req,res)=>{
    const day=response(await read(req.params.date));
    const pdf=await require('./plant-rounds-pdf')(day,day.template);
    res.type('application/pdf');
    res.set('Content-Disposition',`${req.query.download==='1'?'attachment':'inline'}; filename="plant-rounds-${req.params.date}.pdf"`);
    res.send(pdf);
  }));
  app.get('/api/plant-rounds/:date',route(async(req,res)=>res.json(response(await read(req.params.date)))));
  app.post('/api/plant-rounds/:date/:shift/start',route((req,res)=>change(req,res,(day,name,now)=>{
    const shift=day.shifts[req.params.shift];
    shift.operator=name;shift.startedAt ||= now;
    shift.operatorId=req.operatorId;
    day.history.push({at:now,operator:name,shift:req.params.shift,action:'start'});
  })));
  app.put('/api/plant-rounds/:date/:shift/entries/:id',route((req,res)=>change(req,res,(day,name,now)=>{
    const field=day.template.fields.find(field=>field.id===req.params.id),shift=day.shifts[req.params.shift];
    if(!field || !field.shifts.includes(req.params.shift))fail(400,'That item is not part of these rounds.');
    const {value,revision}=req.body || {},current=shift.entries[field.id];
    if(!Number.isSafeInteger(revision) || revision<0)fail(400,'An entry revision is required.');
    if(revision !== (current?.revision || 0))fail(409,'Another operator changed this entry. Review the saved value before replacing it.',{current:current || {value:null,revision:0}});
    let valid=value===null || value==='na';
    if(field.type==='number')valid ||= typeof value==='number' && Number.isFinite(value) && (!field.label.startsWith('Clarity') || Number.isInteger(value) && value>=1 && value<=5);
    else if(field.type==='text')valid ||= typeof value==='string' && value.length<=2000;
    else valid ||= typeof value==='boolean';
    if(!valid)fail(400,'Enter a valid '+(field.label.startsWith('Clarity') ? 'clarity score from 1 to 5.' : field.type==='number' ? 'number.' : field.type==='text' ? 'note (up to 2,000 characters).' : 'answer.'));
    shift.entries[field.id]={value,revision:revision+1,updatedAt:now,updatedBy:name,updatedById:req.operatorId};
    shift.startedAt ||= now;shift.operator=name;shift.operatorId=req.operatorId;shift.completedAt=null;
    day.history.push({at:now,operator:name,shift:req.params.shift,action:'entry',id:field.id,previous:current?.value ?? null,value});
  })));
  app.post('/api/plant-rounds/:date/:shift/complete',route((req,res)=>change(req,res,(day,name,now)=>{
    const count=progress(day,req.params.shift);
    if(count.done!==count.total)fail(400,'Complete each required item or mark it N/A before finishing rounds.');
    day.shifts[req.params.shift].completedAt=now;
    day.history.push({at:now,operator:name,shift:req.params.shift,action:'complete'});
  })));
  app.post('/api/plant-rounds/:date/:shift/notes',route((req,res)=>change(req,res,(day,name,now)=>{
    const {text,location,id}=req.body || {};
    if(typeof text!=='string' || !text.trim() || text.length>4000)fail(400,'Write a note (up to 4,000 characters).');
    if(location!=='general' && !day.template.locations.some(item=>item.id===location))fail(400,'Choose a valid location.');
    if(typeof id!=='string' || !/^[a-zA-Z0-9-]{10,80}$/.test(id))fail(400,'A valid note identifier is required.');
    if(day.notes.some(note=>note.id===id))return;
    day.notes.push({id,text:text.trim(),location,shift:req.params.shift,operator:name,operatorId:req.operatorId,createdAt:now,revision:1});
    day.history.push({at:now,operator:name,shift:req.params.shift,action:'note',id});
  })));
  function existingNote(req,day) {
    const note=day.notes.find(note=>note.id===req.params.id);
    if(!note)fail(404,'This note has already been deleted or is no longer available.');
    if(note.shift!==req.params.shift)fail(400,'The note must retain its original AM/PM rounds.');
    const revision=req.body?.revision;
    if(!Number.isSafeInteger(revision) || revision<0)fail(400,'A note revision is required.');
    if(revision!==(note.revision || 0))fail(409,'Another operator changed this note. Review the latest note and reopen Edit before saving or deleting it.',{current:note});
    return note;
  }
  app.put('/api/plant-rounds/:date/:shift/notes/:id',route((req,res)=>change(req,res,(day,name,now)=>{
    const note=existingNote(req,day),{text,location}=req.body || {};
    if(typeof text!=='string' || !text.trim() || text.length>4000)fail(400,'Write a note (up to 4,000 characters).');
    if(location!=='general' && !day.template.locations.some(item=>item.id===location))fail(400,'Choose a valid location.');
    day.history.push({at:now,operator:name,shift:note.shift,action:'note-edit',id:note.id,previous:{...note},text:text.trim(),location});
    Object.assign(note,{text:text.trim(),location,revision:(note.revision || 0)+1,updatedAt:now,updatedBy:name,updatedById:req.operatorId});
  })));
  app.delete('/api/plant-rounds/:date/:shift/notes/:id',route((req,res)=>change(req,res,(day,name,now)=>{
    const note=existingNote(req,day);
    day.history.push({at:now,operator:name,shift:note.shift,action:'note-delete',id:note.id,previous:{...note}});
    day.notes=day.notes.filter(item=>item.id!==note.id);
  })));
};
module.exports.validDate=validDate;
module.exports.progress=progress;
module.exports.normalizeField=normalizeField;
