'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const {randomUUID, createHash} = require('node:crypto');
const express = require('express');
const schedule = require('./apps/work-orders/schedule');
const {validDate} = require('./plant-rounds-api');
const today = schedule.plantDate;
const initial = () => ({revision:0, locations:[], equipment:[], groups:[{id:'day-shift', name:'Day Shift', kind:'shift', members:[]}], tasks:[], schedules:[], orders:[], files:[]});
function requireValue(test, message, status=400) {
  if (!test) throw Object.assign(new Error(message), {status});
}
function string(value, max=160) {
  requireValue(value == null || typeof value === 'string', 'Enter text.');
  const result = (value || '').trim();
  requireValue(result.length <= max, 'Text exceeds the field limit.');
  return result;
}
function lookup(list, id) {
  const item = list.find(row => row.id === id);
  requireValue(item, 'The selected record is unavailable. Refresh and try again.');
  return item;
}
function uniqueName(list, name, id) {
  requireValue(name && !list.some(item => item.id !== id && item.name.toLowerCase() === name.toLowerCase()), 'Enter a unique name.');
}
function selections(value) {
  requireValue(Array.isArray(value) && value.length <= 500, 'Invalid selection.');
  return [...new Set(value)];
}
function dateValue(value) {
  requireValue(validDate(value) && value < '2200', 'Choose a valid date before 2200.');
  return value;
}
function assignment(value,users,groups){
  const key=string(value);
  if(key) requireValue(users.some(u=>'user/'+u.id===key)||groups.some(g=>'group/'+g.id===key),'Choose a current assignment.');
  return key;
}
function issue(state, plan, due) {
  const asset = lookup(state.equipment, plan.equipment);
  const task = lookup(state.tasks, plan.task);
  let location = asset.location;
  const names = [];
  while (location) {
    const place = lookup(state.locations, location);
    names.unshift(place.name);
    location = place.parent;
  }
  state.orders.push({
    id:'WO-' + String(state.orders.length + 1).padStart(6,'0'), due, schedule:plan.id || '',
    task:task.id, equipment:asset.id, title:task.name + ' · ' + asset.name, location:names.join(' › '),
    instructions:[task.instructions, plan.instructions].filter(Boolean).join('\n\n'),
    tag:asset.tag, photos:[...asset.photos], files:[...new Set([...asset.files,...task.files,...plan.files])],
    assigned:plan.assigned, priority:plan.priority, claimed:null, completion:null
  });
}
function generate(state, through) {
  let changed = false;
  for (const rule of state.schedules) {
    if (rule.paused) continue;
    while (rule.next && rule.next <= through) {
      if (!rule.months.length || rule.months.includes(Number(rule.next.slice(5,7)))) issue(state, rule, rule.next);
      rule.next = rule.mode === 'completion' ? null : schedule.advance(rule, rule.next);
      changed = true;
    }
  }
  return changed;
}
module.exports = function register(app, {operationsDirectory, directory=path.join(__dirname,'data','work-orders'), sopDirectory=process.env.SOP_DATA_DIR || path.join(__dirname,'data','sops'), runTimer=true}) {
  const base = '/api/work-orders';
  const target = path.join(directory,'records.json');
  let pending = Promise.resolve();
  const serial = action => { const result = pending.then(action); pending = result.catch(()=>{}); return result; };
  async function read() {
    try { return JSON.parse(await fs.readFile(target,'utf8')); }
    catch (e) { if (e.code === 'ENOENT') return initial(); throw e; }
  }
  async function save(state, bump=true) {
    await fs.mkdir(directory,{recursive:true});
    if (bump) state.revision++;
    await fs.writeFile(target+'.tmp',JSON.stringify(state));
    await fs.rename(target+'.tmp',target);
  }
  const route = fn => (req,res) => Promise.resolve().then(()=>fn(req,res)).catch(e=>{
    if (!e.status) console.error('Work orders:', e.message);
    res.status(e.status || 500).json({error:e.status ? e.message : 'Work order storage is unavailable.'});
  });
  app.use(base,(req,res,next)=>{
    res.set('Cache-Control','no-store');
    if (req.method === 'POST') {
      let origin;
      try { origin = new URL(req.headers.origin); } catch {}
      if (!origin || origin.host !== req.headers.host) return res.status(403).json({error:'Save from the Work Orders page.'});
    }
    next();
  });
  const refresh = () => serial(async()=>{
    const state = await read();
    if (generate(state,schedule.days(today(),13))) await save(state);
    return state;
  });
  app.get(base,route(async(req,res)=>res.json(await refresh())));
  if (runTimer) setInterval(()=>refresh().catch(error=>console.error('Work order scheduler:',error.message)),60000).unref();

  async function storeFile(buffer, name, type) {
    const id = createHash('sha256').update(type).update(name).update(buffer).digest('hex');
    await fs.mkdir(path.join(directory,'files'),{recursive:true});
    return serial(async()=>{
      const state = await read();
      if (!state.files.some(file=>file.id===id)) {
        await fs.writeFile(path.join(directory,'files',id),buffer);
        state.files.push({id,name,type});
        await save(state,false);
      }
      return {id, revision:state.revision};
    });
  }
  app.post(base+'/files',express.raw({type:'application/octet-stream',limit:'20mb'}),route(async(req,res)=>{
    const name = string(req.query.name);
    const ext = path.extname(name).slice(1).toLowerCase();
    const types = {pdf:'application/pdf',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp'};
    requireValue(Object.hasOwn(types,ext) && Buffer.isBuffer(req.body) && req.body.length,'Choose a PDF, DOCX, JPG, PNG, or WebP file.');
    res.json(await storeFile(req.body,name,types[ext]));
  }));
  app.post(base+'/sop',route(async(req,res)=>{
    const id = req.body.id;
    requireValue(typeof id==='string' && /^[a-zA-Z0-9-]{1,80}$/.test(id),'Choose a saved SOP.');
    const bytes = await fs.readFile(path.join(sopDirectory,id+'.json'));
    const doc = JSON.parse(bytes);
    res.json(await storeFile(bytes,doc.title+' · revision '+doc.revision,'application/json'));
  }));
  app.get(base+'/files/:id',route(async(req,res)=>{
    const file = lookup((await read()).files,req.params.id);
    res.set('X-Content-Type-Options','nosniff');
    res.set('Content-Security-Policy',"default-src 'none'; sandbox");
    if (!file.type.startsWith('image/') && file.type!=='application/json') res.attachment(file.name);
    res.type(file.type).send(await fs.readFile(path.join(directory,'files',file.id)));
  }));
  app.post(base,route(async(req,res)=>res.json(await serial(async()=>{
    const state = await read();
    const b = req.body || {};
    requireValue(b.revision===state.revision,'Records changed. Reload the work queue before saving again.',409);
    const users = (await operationsDirectory()).filter(user=>user.active);
    const person = id => { const {name}=lookup(users,id); return {id,name}; };
    const refs = (value, photo=false) => selections(value || []).map(id=>{
      const file = lookup(state.files,id);
      requireValue(!photo || file.type.startsWith('image/'),'Choose an equipment photo.');
      return id;
    });
    const name = string(b.name);
    const id = b.id || randomUUID();
    if (['groups','locations','equipment','tasks'].includes(b.action)) {
      const list = state[b.action];
      const item = b.id ? lookup(list,b.id) : {id};
      const siblings = b.action==='locations' ? list.filter(place=>place.parent===(b.parent||'')) : list;
      uniqueName(siblings,name,id);
      if (b.action==='locations') {
        let ancestor = b.parent;
        while (ancestor) {
          requireValue(ancestor!==id,'Choose a parent outside this location.');
          ancestor=lookup(list,ancestor).parent;
        }
        item.parent=b.parent||'';
      } else if (b.action==='groups') {
        requireValue(['shift','members'].includes(b.kind),'Choose a group type.');
        item.kind=b.kind;
        item.members=b.kind==='shift' ? [] : selections(b.members).map(userId=>person(userId).id);
        requireValue(item.kind==='shift'||item.members.length,'Choose one or more group members.');
      } else if (b.action==='equipment') {
        item.location=lookup(state.locations,b.location).id;
        Object.assign(item,{tag:string(b.tag),model:string(b.model),serial:string(b.serial),photos:refs(b.photos,true),files:refs(b.files)});
      } else Object.assign(item,{instructions:string(b.instructions,10000),files:refs(b.files)});
      item.name=name;
      if (!b.id) list.push(item);
    } else if (b.action==='plan') {
      const assigned = assignment(b.assigned,users,state.groups);
      requireValue(['Routine','High','Urgent'].includes(b.priority),'Choose a priority.');
      const task=lookup(state.tasks,b.task).id, start=dateValue(b.start);
      const assets=selections(b.assets);
      requireValue(assets.length,'Choose equipment.');
      requireValue(['once','fixed','completion'].includes(b.mode),'Choose a schedule.');
      const interval=Number(b.interval || 1);
      requireValue(Number.isInteger(interval)&&interval>=1&&interval<=365 && ['days','weeks','months','years'].includes(b.unit),'Choose a valid interval.');
      const months=selections(b.months || []);
      const pattern=b.pattern || 'date';
      requireValue(['date','first-weekday','ordinal'].includes(pattern),'Choose a calendar pattern.');
      if(pattern!=='date'){
        requireValue(b.mode==='fixed' && b.unit==='months','Weekday patterns use monthly calendar schedules.');
        const day=Number(start.slice(-2));
        if(pattern==='ordinal') requireValue(day<=28,'Choose a first, second, third, or fourth weekday.');
        else {
          const first=start.slice(0,8)+'01', weekday=new Date(first+'T12:00Z').getUTCDay();
          requireValue(start===schedule.days(first,weekday===6?2:weekday===0?1:0),'Choose the first working weekday of the month as the first due date.');
        }
      }
      requireValue(months.every(m=>Number.isInteger(m)&&m>=1&&m<=12) && (b.mode==='fixed'||!months.length),'Choose valid seasonal months.');
      for (const equipment of assets) {
        lookup(state.equipment,equipment);
        const plan={equipment,task,start,next:start,assigned,priority:b.priority,instructions:string(b.instructions,10000),files:refs(b.files),interval,unit:b.unit,mode:b.mode,months,paused:false};
        if (b.mode==='once') issue(state,plan,start);
        else {plan.id=randomUUID(); plan.pattern=pattern; state.schedules.push(plan);}
      }
    } else if (b.action==='issue') {
      const through=dateValue(b.through);
      requireValue(through<=schedule.months(today(),12,Number(today().slice(-2))),'Issue up to one year ahead.');
      generate(state,through);
    } else if (b.action==='pause') {
      const rule=lookup(state.schedules,b.id);
      rule.paused=!rule.paused;
      if (!rule.paused && rule.next && rule.next<today() && rule.mode==='fixed') {
        while (rule.next<today()) rule.next=schedule.advance(rule,rule.next);
      }
    } else {
      const order=lookup(state.orders,b.id);
      requireValue(!order.completion,'This work order is already completed.');
      if (b.action==='claim') order.claimed=person(b.user);
      else if (b.action==='assign') {order.assigned=assignment(b.assigned,users,state.groups);order.claimed=null;}
      else if (b.action==='attach') order.files=[...new Set([...order.files,...refs(b.files)])];
      else if (b.action==='complete') {
        const workers=selections(b.workers).map(person);
        requireValue(workers.length,'Select who completed the work.');
        const date=dateValue(b.date);
        requireValue(date<=today(),'Completion cannot be in the future.');
        order.completion={date,workers,notes:string(b.notes,10000),enteredBy:person(b.enteredBy),recordedAt:new Date().toISOString()};
        const rule=state.schedules.find(s=>s.id===order.schedule);
        if (rule?.mode==='completion') rule.next=rule.unit==='months'||rule.unit==='years' ? schedule.months(date,rule.interval*(rule.unit==='years'?12:1),Number(date.slice(-2))) : schedule.advance(rule,date);
      } else requireValue(false,'Unknown work order action.');
    }
    generate(state,schedule.days(today(),13));
    await save(state);
    return state;
  }))));
};
