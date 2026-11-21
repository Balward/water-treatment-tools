'use strict';
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const api='/api/work-orders';
let db, users=[], sops=[], tab='orders', currentUser=localStorage.getItem('wo-user') || '';
let editAction, editId, draftRevision, selected=new Set();
const titles={orders:'Work queue',equipment:'Equipment',tasks:'Tasks',schedules:'Schedules',locations:'Locations',groups:'Work groups'};
const singular={equipment:'equipment',tasks:'task',locations:'location',groups:'work group'};
const now=WorkSchedule.plantDate;
const filters={span:'14',from:'',through:'',status:'Open',owner:'',place:'',priority:'',search:''};
const lookup=(list,id)=>list.find(item=>item.id===id);
const button=(label,action,id='',cls='')=>'<button type="button" class="'+cls+'" data-action="'+action+'" data-id="'+esc(id)+'">'+esc(label)+'</button>';
const option=(value,label,sel=false)=>'<option value="'+esc(value)+'"'+(sel?' selected':'')+'>'+esc(label)+'</option>';
const field=(label,control)=>'<label>'+label+control+'</label>';
const input=(name,value='',required=false,type='text')=>'<input name="'+name+'" type="'+type+'" value="'+esc(value)+'"'+(required?' required':'')+'>';
const select=(name,options,multi=false,required=false)=>'<select name="'+name+'"'+(multi?' multiple':'')+(required?' required':'')+'>'+options+'</select>';
const area=(name,value)=>'<textarea name="'+name+'" rows="3" maxlength="10000">'+esc(value)+'</textarea>';
const table=(headers,rows)=>'<div class="table-wrap"><table><thead><tr>'+headers.map(h=>'<th>'+h+'</th>').join('')+'</tr></thead><tbody>'+rows.map(cells=>'<tr>'+cells.map(c=>'<td>'+c+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
function place(id) {
  const chain=[];
  while(id){const p=lookup(db.locations,id);if(!p)break;chain.unshift(p.name);id=p.parent;}
  return chain.join(' › ');
}
function inLocation(id,parent){while(id){if(id===parent)return true;id=lookup(db.locations,id)?.parent;}return false;}
const personName=id=>lookup(users,id)?.name || 'Inactive user';
function owner(key){if(!key)return 'Unassigned';const [type,id]=key.split('/');return type==='group'?lookup(db.groups,id)?.name:personName(id);}
const choices=(list,value,format=item=>item.name)=>list.map(item=>option(item.id,format(item),Array.isArray(value)?value.includes(item.id):item.id===value)).join('');
const people=(value,multi=false)=>select(multi?'workers':'user',(!multi?option('','Choose a person'):'')+choices(users.filter(u=>u.active),value),multi,true);
function ownerOptions(value,filter=false){
  return option('',filter?'All assignments':'Unassigned',!value)+(filter?option('mine','My work and groups',value==='mine')+option('none','Unassigned',value==='none'):'')+
    '<optgroup label="Work groups">'+db.groups.map(g=>option('group/'+g.id,g.name,value==='group/'+g.id)).join('')+'</optgroup><optgroup label="People">'+users.filter(u=>filter||u.active).map(u=>option('user/'+u.id,u.name,value==='user/'+u.id)).join('')+'</optgroup>';
}
async function request(url,options){
  const response=await fetch(url,{cache:'no-store',...options});
  if(!response.ok){const error=await response.json().catch(()=>({}));throw Error(error.error || 'Request failed ('+response.status+').');}
  return response.json();
}
const post=(url,data)=>request(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
async function load(){
  try{
    [db,{users}]=await Promise.all([request(api),request('/api/operations/users')]);
    $('notice').textContent='';
    render();
  }catch(e){$('notice').textContent=e.message;$('view').innerHTML=button('Reload','reload');}
}
function bounds(){
  const start=filters.span==='custom'?filters.from:now();
  const end=filters.span==='custom'?filters.through:filters.span==='month'||filters.span==='year'?WorkSchedule.days(WorkSchedule.months(start,filters.span==='year'?12:1,Number(start.slice(-2))),-1):WorkSchedule.days(start,Number(filters.span)-1);
  return {start,end};
}
function queue(){
  const {start,end}=bounds();
  const items=[...db.orders];
  if(end && ['Planning','All'].includes(filters.status)){
    for(const rule of db.schedules){
      const asset=lookup(db.equipment,rule.equipment), task=lookup(db.tasks,rule.task);
      for(const due of WorkSchedule.occurrences(rule,end))items.push({...rule,id:'',due,title:task.name+' · '+asset.name,location:place(asset.location),projected:true});
    }
  }
  return items.filter(o=>{
    const asset=lookup(db.equipment,o.equipment);
    const overdue=!o.completion&&!o.projected&&o.due<now();
    if(filters.status==='Open'&&(o.completion||o.projected) || filters.status==='Completed'&&!o.completion || filters.status==='Planning'&&!o.projected)return false;
    if(end && o.due>end || start && o.due<start && !(overdue && filters.span!=='custom'))return false;
    if(filters.owner==='mine'){
      if(!currentUser)return false;
      const group=db.groups.find(g=>'group/'+g.id===o.assigned);
      if(o.claimed?.id!==currentUser && o.assigned!=='user/'+currentUser && !group?.members.includes(currentUser))return false;
    }else if(filters.owner==='none'?o.assigned:filters.owner && o.assigned!==filters.owner)return false;
    return (!filters.place || inLocation(asset.location,filters.place)) && (!filters.priority || o.priority===filters.priority) && [o.id,o.title,o.location,asset.tag].join(' ').toLowerCase().includes(filters.search.toLowerCase());
  }).sort((a,b)=>a.due.localeCompare(b.due)||a.title.localeCompare(b.title));
}
const status=o=>o.projected?'Projected':o.completion?'Completed':o.due<now()?'Overdue':o.claimed?'Claimed':'Open';
function queueRows(){
  const rows=queue();
  const visible=new Set(rows.map(o=>o.id));selected=new Set([...selected].filter(id=>visible.has(id)));
  return rows.length?table(['Select','Due','Work order','Assignment','Status'],rows.map(o=>[
    o.projected?'—':'<input type="checkbox" data-pick="'+esc(o.id)+'" aria-label="Select '+esc(o.id)+'" '+(selected.has(o.id)?'checked':'')+'>',
    esc(o.due), (o.projected?esc(o.title):button(o.title,'detail',o.id,'link'))+'<small>'+esc([o.id,o.location].filter(Boolean).join(' · '))+'</small>',
    esc(owner(o.assigned))+(o.claimed?'<small>Claimed by '+esc(o.claimed.name)+'</small>':''),
    '<span class="'+(status(o)==='Overdue'?'overdue':'')+'">'+status(o)+'</span><small>'+esc(o.priority)+'</small>'
  ])):'<p>No work orders match this view.</p>';
}
function filterSelect(key,pairs){return select(key,pairs.map(([v,l])=>option(v,l,filters[key]===v)).join(''));}
function showQueue(){
  const toolbar=field('Due within',filterSelect('span',[['7','1 week'],['14','2 weeks'],['month','1 month'],['year','1 year'],['custom','Custom range']]))+
    (filters.span==='custom'?field('From',input('from',filters.from,false,'date'))+field('Through',input('through',filters.through,false,'date')):'')+
    field('Status',filterSelect('status',['Open','Completed','Planning','All'].map(v=>[v,v])))+
    field('Assignment',select('owner',ownerOptions(filters.owner,true)))+
    field('Location',select('place',option('','All locations')+choices(db.locations,filters.place,p=>place(p.id))))+
    field('Priority',filterSelect('priority',[['','All priorities'],...['Routine','High','Urgent'].map(v=>[v,v])]))+field('Find equipment, task, or order',input('search',filters.search));
  return '<div class="panel"><div class="heading"><h2>Work queue</h2><div class="actions">'+button('Create work','plan','','primary')+button('Issue through date','issue')+'</div></div>'+
    '<div class="filters" id="filters">'+toolbar+'</div><div class="actions">'+button('Print list','print-list')+button('Print selected sheets','packet')+button('Reload','reload')+
    field('My work name',select('profile',option('','Choose your name')+choices(users.filter(u=>u.active),currentUser)))+'</div></div><div class="panel" id="rows">'+queueRows()+'</div>';
}
function locationRows(locations){
  const children=new Map();
  const byName=new Intl.Collator('en',{numeric:true,sensitivity:'base'});
  for(const location of [...locations].sort((a,b)=>byName.compare(a.name,b.name))){
    const parent=location.parent || '';
    if(!children.has(parent))children.set(parent,[]);
    children.get(parent).push(location);
  }
  const rows=[];
  function appendChildren(parent,depth){
    for(const location of children.get(parent) || []){
      const label='<span class="location-name" style="--depth:'+depth+'">'+esc(location.name)+'</span>';
      rows.push([label,depth?'Sublocation':'Top level',button('Edit','edit',location.id)]);
      appendChildren(location.id,depth+1);
    }
  }
  appendChildren('',0);
  return rows;
}
function library(){
  const rows=db[tab];
  if(tab==='schedules')return '<section class="panel"><div class="heading"><h2>Recurring schedules</h2>'+button('Create schedule','plan','','primary')+'</div>'+(!rows.length?'<p>No recurring schedules yet.</p>':table(['Task and equipment','Recurrence','Assignment','Next to issue',''],rows.map(r=>[
    esc(lookup(db.tasks,r.task).name+' · '+lookup(db.equipment,r.equipment).name),
    esc('Every '+r.interval+' '+r.unit+(r.mode==='completion'?' after completion':' on calendar')+(r.months.length?' · months '+r.months.join(', '):'')),
    esc(owner(r.assigned)),esc(r.paused?'Paused':r.next||'After open order is completed'),button(r.paused?'Resume':'Pause','pause',r.id)
  ])))+'</section>';
  const hints={locations:'Use one local name per level. Example: Filter Building › Filter Gallery.',equipment:'Use service + equipment type + unit identifier. Example: Backwash Pump 02. Keep the physical tag in its own field.',tasks:'Start with an action verb, such as Calibrate, Inspect, or Replace Electrode. Set the frequency on the schedule.',groups:'Shift groups accept assignments across rotations. Named groups appear in each member’s My Work queue.'};
  return '<section class="panel"><div class="heading"><h2>'+titles[tab]+'</h2>'+button('Add '+singular[tab],'edit','','primary')+'</div><p class="hint">'+hints[tab]+'</p>'+
    (rows.length?table(['Name','Details',''],tab==='locations'?locationRows(rows):rows.map(r=>[tab==='equipment'?button(r.name,'asset',r.id,'link'):esc(r.name),
    esc(tab==='equipment'?[r.tag,place(r.location)].filter(Boolean).join(' · '):tab==='groups'?r.kind==='shift'?'Shift group · open roster':r.members.map(personName).join(', '):r.instructions),button('Edit','edit',r.id)])):'<p>No records yet.</p>')+'</section>';
}
function render(){
  $('tabs').innerHTML=Object.entries(titles).map(([key,label])=>'<button data-tab="'+key+'" '+(tab===key?'aria-current="page"':'')+'>'+label+'</button>').join('');
  $('view').innerHTML=tab==='orders'?showQueue():library();
}
function filesHTML(ids){
  return ids.map(id=>{const f=lookup(db.files,id);return f.type==='application/json'?button(f.name,'sop-view',id,'link'):'<a href="'+api+'/files/'+id+'" target="_blank" rel="noopener">'+esc(f.name)+'</a>';}).join(' · ');
}
function photosHTML(ids){return '<div class="photos">'+ids.map(id=>'<a href="'+api+'/files/'+id+'" target="_blank" rel="noopener"><img src="'+api+'/files/'+id+'" alt="'+esc(lookup(db.files,id).name)+'"></a>').join('')+'</div>';}
function sheet(o,paper=false){
  const c=o.completion;
  return '<article class="sheet"><small>'+esc(o.id)+' · '+status(o)+'</small><h2>'+esc(o.title)+'</h2><p>'+esc([o.tag,o.location].filter(Boolean).join(' · '))+'</p><p>Due '+esc(o.due)+' · '+esc(o.priority)+' · Assigned to '+esc(owner(o.assigned))+(o.claimed?' · Claimed by '+esc(o.claimed.name):'')+'</p>'+photosHTML(o.photos)+
    '<h3>Instructions</h3><p>'+esc(o.instructions||'No additional instructions.')+'</p>'+(o.files.length?'<h3>Documents</h3><p>'+(paper?o.files.map(id=>esc(lookup(db.files,id).name)).join(' · '):filesHTML(o.files))+'</p>':'')+
    (c?'<h3>Completion</h3><p>'+esc(c.date)+' · '+esc(c.workers.map(u=>u.name).join(', '))+'</p><p>'+esc(c.notes)+'</p><small>Entered by '+esc(c.enteredBy.name)+'</small>':paper?'<div class="line">Date completed</div><div class="line">Completed by</div><div class="line notes">Completion notes</div>':'')+'</article>';
}
function modal(title,html,action,id=''){
  editAction=action;editId=id;draftRevision=db.revision;
  $('dialog-title').textContent=title;$('fields').innerHTML=html;$('entry').querySelector('.error').textContent='';
  $('entry').querySelector('footer').hidden=!action;
  $('entry').querySelector('[type=submit]').hidden=!action;
  if(!$('editor').open)$('editor').showModal();
}
function orderDetail(id){
  const o=lookup(db.orders,id);
  modal(o.id,sheet(o)+'<div class="actions">'+button('Print sheet','print-one',id)+(!o.completion?button('Record completion','complete',id,'primary')+button('Claim work','claim',id)+button('Reassign','assign',id)+button('Attach documents','attach',id):'')+'</div>',null,id);
}
function assetDetail(id){
  const a=lookup(db.equipment,id), orders=db.orders.filter(o=>o.equipment===id).sort((a,b)=>b.due.localeCompare(a.due));
  modal(a.name,'<p>'+esc([a.tag,place(a.location),a.model,a.serial].filter(Boolean).join(' · '))+'</p>'+photosHTML(a.photos)+filesHTML(a.files)+'<h3>Work history and issued orders</h3>'+orders.map(o=>button(o.due+' · '+o.title+' · '+status(o),'detail',o.id,'link')).join('<br>')+(orders.length?'':'No issued orders.')+'<h3>Recurring tasks</h3>'+db.schedules.filter(r=>r.equipment===id).map(r=>esc(lookup(db.tasks,r.task).name)+' · '+esc(r.paused?'Paused':r.next||'Awaiting completion')).join('<br>'),null,id);
}
function attachments(key,ids=[],photos=false){

  return (ids.length?'<fieldset><legend>Keep existing '+key+'</legend>'+ids.map(id=>'<label><span><input style="width:auto" type="checkbox" name="keep-'+key+'" value="'+id+'" checked> '+esc(lookup(db.files,id).name)+'</span></label>').join('')+'</fieldset>':'')+
    field(photos?'Equipment photos':'Attach files', '<input type="file" multiple name="'+key+'" accept="'+(photos?'image/png,image/jpeg,image/webp':'.pdf,.docx,.png,.jpg,.jpeg,.webp')+'">')+
    (photos?'':field('Attach saved SOP revision',select('sop',option('','Choose an SOP (optional)')+choices(sops,'',s=>s.title))));
}
function editLibrary(id){
  const r=id?lookup(db[tab],id):{};
  let html=field('Name',input('name',r.name,true));
  if(tab==='locations')html+=field('Parent location',select('parent',option('','Top level')+choices(db.locations.filter(p=>!inLocation(p.id,id||'--')),r.parent,p=>place(p.id))));
  if(tab==='groups')html+=field('Group type',select('kind',option('shift','Shift group · open roster',r.kind!=='members')+option('members','Named members',r.kind==='members')))+'<div id="member-field">'+field('Members',select('members',choices(users.filter(u=>u.active),r.members||[]),true))+'</div>';
  if(tab==='equipment')html+=field('Location',select('location',option('','Choose location')+choices(db.locations,r.location,p=>place(p.id)),false,true))+field('Plant tag',input('tag',r.tag))+field('Manufacturer / model',input('model',r.model))+field('Serial number',input('serial',r.serial))+attachments('photos',r.photos,true)+attachments('files',r.files);
  if(tab==='tasks')html+=field('Standard instructions',area('instructions',r.instructions))+attachments('files',r.files);
  modal((id?'Edit ':'Add ')+singular[tab],html,tab,id);conditional();
}
function plan(){
  if(!db.locations.length || !db.equipment.length || !db.tasks.length){
    const next=!db.locations.length?'locations':!db.equipment.length?'equipment':'tasks';
    modal('Set up work','<p>Add a location, a piece of equipment, and a reusable task before issuing work.</p>'+button('Open '+titles[next],'section',next),null);return;
  }
  modal('Create work',field('Task',select('task',choices(db.tasks)))+field('Apply to equipment (select one or more)',select('assets',choices(db.equipment,[],a=>a.name+' · '+place(a.location)),true,true))+
    field('Assign to',select('assigned',ownerOptions('')))+field('Priority',select('priority',['Routine','High','Urgent'].map(v=>option(v,v)).join('')))+
    field('Schedule',select('mode',option('once','One time')+option('fixed','Fixed calendar interval')+option('completion','Interval after completion')))+field('First due date',input('start',now(),true,'date'))+
    '<div id="recurring">'+field('Repeat every','<input name="interval" type="number" value="1" min="1" max="365">')+field('Unit',select('unit',['days','weeks','months','years'].map(v=>option(v,v)).join('')))+field('Monthly pattern',select('pattern',option('date','Same date')+option('ordinal','Same numbered weekday (first through fourth)')+option('first-weekday','First Monday–Friday day')))+'<div id="season">'+field('Seasonal months (leave empty for all months)',select('months',Array.from({length:12},(_,i)=>option(i+1,new Date(2000,i,1).toLocaleString('en',{month:'long'}))).join(''),true))+'</div><p id="forecast"></p></div>'+
    field('Additional instructions',area('instructions',''))+attachments('files'), 'plan');conditional();
}
function conditional(){
  const f=$('entry').elements;
  if($('member-field'))$('member-field').hidden=f.kind.value!=='members';
  if($('recurring')){
    $('recurring').hidden=f.mode.value==='once';$('season').hidden=f.mode.value!=='fixed';
    f.pattern.parentElement.hidden=f.mode.value!=='fixed'||f.unit.value!=='months';
    if(f.pattern.parentElement.hidden)f.pattern.value='date';
    const data=new FormData($('entry'));
    const rule={pattern:f.pattern.value,next:f.start.value,start:f.start.value,unit:f.unit.value,interval:Number(f.interval.value),mode:f.mode.value,months:f.mode.value==='fixed'?data.getAll('months').map(Number):[]};
    $('forecast').textContent='';
    if(rule.next && rule.interval>=1 && rule.interval<=365 && f.mode.value!=='once'){
      const dates=WorkSchedule.occurrences(rule,WorkSchedule.days(rule.start,366)).slice(0,3);
      $('forecast').textContent='Upcoming due dates: '+(dates.join(', ')||'None within one year')+(rule.mode==='completion'?' · later dates follow completion.':'');
    }
  }
}
async function upload(data,key){
  const ids=data.getAll('keep-'+key);
  for(const file of data.getAll(key)){
    if(!file.size)continue;
    if(file.size>20*1024*1024)throw Error('Each file must be 20 MB or smaller.');
    const result=await request(api+'/files?name='+encodeURIComponent(file.name),{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:file});
    ids.push(result.id);
  }
  if(key==='files' && data.get('sop'))ids.push((await post(api+'/sop',{id:data.get('sop')})).id);
  return ids;
}
$('entry').onsubmit=async e=>{
  e.preventDefault();if(!editAction)return;
  const f=e.currentTarget,submit=f.querySelector('[type=submit]'), data=new FormData(f);
  const payload={...Object.fromEntries(data),revision:draftRevision,action:editAction,id:editId};
  for(const key of ['workers','members','assets'])payload[key]=data.getAll(key);
  payload.months=payload.mode==='fixed'?data.getAll('months').map(Number):[];
  submit.disabled=true;$('close').disabled=true;f.querySelector('.error').textContent='';
  try{
    for(const key of ['files','photos'])if(data.has(key))payload[key]=await upload(data,key);
    db=await post(api,payload);$('editor').close();render();$('notice').textContent='Saved.';
  }catch(error){f.querySelector('.error').textContent=error.message;}finally{submit.disabled=false;$('close').disabled=false;}
};
async function printSheets(html){
  $('print').innerHTML=html;
  await Promise.all([...$('print').querySelectorAll('img')].map(img=>img.decode().catch(()=>{})));
  window.print();
}
async function action(name,id){
  if(name==='reload')return load();
  if(name==='section'){$('editor').close();tab=id;render();return;}
  if(name==='edit'||name==='plan'||name==='attach'){
    try{sops=await request('/api/sops');}catch{sops=[];$('notice').textContent='SOP library is unavailable. File uploads are available.';}
  }
  if(name==='edit')return editLibrary(id);
  if(name==='plan')return plan();
  if(name==='detail')return orderDetail(id);
  if(name==='asset')return assetDetail(id);
  if(name==='sop-view'){
    const doc=await request(api+'/files/'+id);
    modal(doc.title,button('Print SOP','print-sop')+'<div class="sop">'+SOPDocument.render(SOPModel.validate(doc))+'</div>',null);return;
  }
  if(name==='pause'){db=await post(api,{action:'pause',id,revision:db.revision});render();return;}
  if(name==='issue')return modal('Issue scheduled work',field('Issue through',input('through',WorkSchedule.days(now(),13),true,'date'))+'<p>Creates orders across active schedules through this date. Already-issued dates are skipped.</p>','issue');
  if(name==='assign')return modal('Reassign '+id,field('Assign to',select('assigned',ownerOptions(lookup(db.orders,id).assigned))),'assign',id);
  if(name==='claim')return modal('Claim '+id,field('Claimed by',people(currentUser)),'claim',id);
  if(name==='attach')return modal('Attach documents to '+id,attachments('files'),'attach',id);
  if(name==='complete')return modal('Complete '+id,field('Actual completion date',input('date',now(),true,'date'))+field('Completed by (select one or more)',people(currentUser?[currentUser]:[],true))+field('Entered by',select('enteredBy',option('','Choose a person')+choices(users.filter(u=>u.active),currentUser),false,true))+field('Completion notes',area('notes','')),'complete',id);
  if(name==='print-one')return printSheets(sheet(lookup(db.orders,id),true));
  if(name==='print-sop')return printSheets('<article class="sop">'+$('fields').querySelector('.sop').innerHTML+'</article>');
  if(name==='packet'){
    if(!selected.size){$('notice').textContent='Select at least one issued work order to print.';return;}
    return printSheets(queue().filter(o=>selected.has(o.id)).map(o=>sheet(o,true)).join(''));
  }
  if(name==='print-list'){
    const {start,end}=bounds();
    return printSheets('<h1>Work order list</h1><p>'+esc([start,end].filter(Boolean).join(' to '))+' · '+esc(filters.status)+' · '+esc(filters.owner==='mine'?'My work':filters.owner==='none'?'Unassigned':filters.owner?owner(filters.owner):'All assignments')+'</p>'+table(['Done','Due','Order / task','Location','Assignment'],queue().map(o=>[o.completion?'☑':'□',o.due,esc(o.id||'Projected')+'<br>'+esc(o.title),esc(o.location),esc(owner(o.assigned))])));
  }
}
document.addEventListener('click',e=>{
  const b=e.target.closest('button');
  if(b?.dataset.tab){tab=b.dataset.tab;render();}
  if(b?.dataset.action)action(b.dataset.action,b.dataset.id).catch(error=>{($('editor').open?$('entry').querySelector('.error'):$('notice')).textContent=error.message;});
});
document.addEventListener('input',e=>{
  if(e.target.name==='search' && e.target.closest('#filters')){
    filters.search=e.target.value;
    $('rows').innerHTML=queueRows();
  }
});
document.addEventListener('change',e=>{
  const el=e.target;
  if(el.name==='search')return;
  if(el.closest('#filters')){filters[el.name]=el.value;if(el.name==='span' && el.value==='custom'){filters.from=now();filters.through=WorkSchedule.days(now(),13);}render();}
  if(el.dataset.pick){if(el.checked)selected.add(el.dataset.pick);else selected.delete(el.dataset.pick);}
  if(el.name==='profile'){currentUser=el.value;localStorage.setItem('wo-user',currentUser);render();}
  if(el.closest('#entry'))conditional();
});
$('close').onclick=()=>$('editor').close();
load();
