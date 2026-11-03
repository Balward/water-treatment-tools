(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const node=(tag,className,text)=>{const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el;};
  const readLocal=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)) ?? fallback;}catch{return fallback;}};
  const store=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}};
  const today=()=>{const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Denver',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());return ['year','month','day'].map(type=>parts.find(p=>p.type===type).value).join('-');};
  const dateLabel=value=>new Date(value+'T12:00:00').toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric',year:'numeric'});
  const time=value=>new Date(value).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'});
  let template,day=null,session=null,locationId='',loadId=0,savePromise=null,saveTimer,failed=false,noteContext=null,noteId=null,noteSaving=false,starting=false;
  const pending=new Map(),conflicts=new Map();
  let noteEditing=null;
  let completing=false;
  const invalidEdits=new Set();
  // The location bar wraps on phones; measure its actual height for sticky titles.
  new ResizeObserver(entries=>{
    const height=entries[0].target.getBoundingClientRect().height;
    if(height)document.documentElement.style.setProperty('--rounds-toolbar-height',`${height}px`);
  }).observe(document.querySelector('.location-toolbar'));
  const selectedShift=()=>document.querySelector('input[name=shift]:checked').value;
  const draftKey=()=>`plant-rounds-draft:${session.date}:${session.shift}`;
  const noteKey=ctx=>`plant-rounds-note:${ctx.date}:${ctx.shift}`;
  function persistDraft(){if(session && !store(draftKey(),Object.fromEntries(pending)) && pending.size)error('This browser cannot retain a local draft. Keep this page open until all entries are saved.');}
  function error(message){$('errorText').textContent=message;$('errorBanner').hidden=false;}
  function clearError(){if(!pending.size && !conflicts.size){$('errorBanner').hidden=true;failed=false;}}
  async function api(url,options={}) {
    let response;
    try {response=await fetch('/api/plant-rounds'+url,{...options,cache:'no-store',headers:{'Content-Type':'application/json',...options.headers},signal:AbortSignal.timeout(12000)});}catch{throw new Error('Cannot reach the rounds server. Unsaved entries remain on this device; keep the page open or return to the same date and rounds to retry.');}
    const body=await response.json().catch(()=>({error:'The rounds server returned an invalid response.'}));
    if(!response.ok){const error=new Error(body.error || 'The request failed.');error.status=response.status;error.current=body.current;throw error;}
    return body;
  }
  const post=(url,body)=>api(url,{method:'POST',body:JSON.stringify(body)});
  const activeDate=() => session?.date || $('roundsDate').value;
  function entry(field,shift=session.shift) {
    if(session && shift===session.shift && pending.has(field.id))return {value:pending.get(field.id).value,updatedBy:session.operator,pending:true};
    return day?.shifts[shift].entries[field.id];
  }
  const numericValue=(field,value)=>field.type!=='number' || value==='na' || (typeof value==='number' && Number.isFinite(value));
  const complete=(field,value)=>value!==undefined && value!==null && value!=='' && numericValue(field,value) && (field.type!=='check' || value===true || value==='na');
  function count(shift,loc) {
    const fields=template.fields.filter(f=>f.required && f.shifts.includes(shift) && (!loc || f.location===loc));
    return {done:fields.filter(f=>complete(f,entry(f,shift)?.value)).length,total:fields.length};
  }
  function describe(field,value) {
    if(value===undefined || value===null || value==='' || !numericValue(field,value))return 'Not Recorded';
    if(value==='na')return 'N/A';
    if(typeof value==='boolean')return field.type==='check' ? value?'Completed':'Not Completed' : value?'Yes':'No';
    return String(value);
  }
  function paintNotes(target,notes) {
    target.replaceChildren();
    if(!notes.length){target.append(node('p','empty','No notes for this date yet. Use Notes to add an observation.'));return;}
    [...notes].reverse().forEach(note=>{
      const item=node('article','note-item');item.append(node('p','',note.text));
      const meta=node('div','note-meta');meta.append(node('strong','',note.shift+' · '+(template.locations.find(l=>l.id===note.location)?.label || 'General')));
      meta.append(document.createTextNode(' · '+note.operator+' · '+time(note.createdAt)));item.append(meta);target.append(item);
      if(note.updatedAt)meta.append(document.createTextNode(' · Edited by '+note.updatedBy+' at '+time(note.updatedAt)));
      if(target.id==='notesList'){
        const actions=node('div','note-actions');
        const edit=node('button','small-button','Edit');edit.type='button';edit.dataset.noteEdit=note.id;edit.setAttribute('aria-label','Edit Note By '+note.operator);edit.onclick=()=>beginNoteEdit(note);
        const remove=node('button','small-button note-delete','Delete');remove.type='button';remove.dataset.noteDelete=note.id;remove.setAttribute('aria-label','Delete Note By '+note.operator);remove.onclick=()=>void deleteNote(note);
        edit.disabled=remove.disabled=noteSaving;actions.append(edit,remove);item.append(actions);
      }
    });
  }
  function resetNoteForm(){
    noteEditing=null;noteId=null;$('noteFormTitle').textContent='Add A Note';$('saveNote').textContent='Save Note';$('cancelNoteEdit').hidden=true;
    const draft=readLocal(noteKey(noteContext),{});$('noteText').value=draft.text || '';$('noteLocation').value=draft.location || (session?locationId:'general');
    $('notesDate').textContent=dateLabel(noteContext.date)+' · '+noteContext.shift;$('noteError').hidden=true;
  }
  function beginNoteEdit(note){
    if(noteSaving)return;
    if(noteEditing && $('noteText').value!==noteEditing.text && !confirm('Discard the unsaved changes to this note?'))return;
    noteEditing={...note};$('noteText').value=note.text;$('noteLocation').value=note.location;
    $('noteFormTitle').textContent='Edit '+note.shift+' Note';$('saveNote').textContent='Save Changes';$('cancelNoteEdit').hidden=false;$('noteError').hidden=true;
    $('notesDate').textContent=dateLabel(noteContext.date)+' · '+note.shift+' Note';
    $('noteForm').scrollIntoView({block:'nearest'});$('noteText').focus({preventScroll:true});
  }
  function noteBusy(busy){
    noteSaving=busy;
    for(const id of ['saveNote','cancelNoteEdit','noteOperator','noteLocation','noteText'])$(id).disabled=busy;
    document.querySelectorAll('#notesList button').forEach(button=>button.disabled=busy);
  }
  function noteFailure(err){
    if(err.current && day?.date===noteContext.date){day.notes=day.notes.map(note=>note.id===err.current.id?err.current:note);paintNotes($('notesList'),day.notes);paintHome();}
    $('noteError').textContent=err.message;$('noteError').hidden=false;$('noteError').scrollIntoView({block:'nearest'});
  }
  async function deleteNote(note){
    if(noteSaving || !$('noteOperator').reportValidity())return;
    if(!confirm('Delete this '+note.shift+' note? This removes it from the shared daily notes.'))return;
    noteBusy(true);$('noteError').hidden=true;
    try{
      const result=await api(`/${noteContext.date}/${note.shift}/notes/${note.id}`,{method:'DELETE',body:JSON.stringify({operator:$('noteOperator').value.trim(),revision:note.revision || 0})});
      if(activeDate()===result.date)day=result;
      if(noteEditing?.id===note.id)resetNoteForm();paintNotes($('notesList'),result.notes);paintHome();progressUI();
    }catch(err){noteFailure(err);}finally{noteBusy(false);}
  }
  function paintHome() {
    if(!day)return;
    $('dayTitle').textContent=day.date===today()?'Today’s Rounds':dateLabel(day.date);
    $('shiftSummaries').replaceChildren();
    for(const shift of ['AM','PM']) {
      const state=day.shifts[shift],progress=day.progress[shift];
      const card=node('article','summary-card'+(state.completedAt?' completed':'')),top=node('div','summary-top');
      top.append(node('h3','',shift+' Rounds'),node('span','subtle-tag',state.completedAt?'Completed':state.startedAt?'In Progress':'Not Started'));
      const summary=node('p');summary.append(node('strong','count',String(progress.done)),document.createTextNode(' / '+progress.total+' Items Recorded'));
      card.append(top,summary,node('p','',state.startedAt?state.operator+' · Started '+time(state.startedAt):'Ready For An Operator'));$('shiftSummaries').append(card);
    }
    $('homeNoteCount').textContent=day.notes.length+' Notes';paintNotes($('homeNotes'),day.notes);$('noteCount').textContent=day.notes.length;
    const state=day.shifts[selectedShift()];$('startButton').textContent=state.startedAt?'Resume Rounds →':'Start Rounds →';
  }
  function progressUI() {
    if(!session || !day)return;
    const all=count(session.shift),loc=count(session.shift,locationId);
    $('overallProgress').textContent=all.done+' / '+all.total+' Items Recorded';$('progressBar').value=all.total?100*all.done/all.total:0;
    $('locationProgress').textContent=loc.done+' / '+loc.total+' Recorded';
    $('saveStatus').textContent=conflicts.size?'Review Conflicting Entry':failed?'Not Saved · Retry':pending.size?'Saving…':day.shifts[session.shift].completedAt?'Rounds Completed':'All Changes Saved';
    $('saveStatus').classList.toggle('pending',pending.size>0 || failed);
    $('completeRounds').hidden=false;
    $('completeRounds').disabled=completing || all.done!==all.total || pending.size>0 || conflicts.size>0 || failed || invalidEdits.size>0;
    $('completeRounds').textContent=completing?'Completing…':'Complete Rounds';
    $('fieldList').inert=completing;$('locationSelect').disabled=completing;
    $('previousLocation').disabled=completing || template.locations[0].id===locationId;$('nextLocation').disabled=completing;
    for(const id of ['homeNav','roundsNav','historyNav','manageNav','usersNav','notesButton'])$(id).disabled=completing;
    for(const option of $('locationSelect').options){const c=count(session.shift,option.value);option.textContent=template.locations.find(l=>l.id===option.value).label+' · '+c.done+'/'+c.total;}
    const am=day.shifts.AM;
    $('amContext').hidden=session.shift!=='PM';
    $('amContext').textContent=am.startedAt?'AM Rounds: '+am.operator+' · '+day.progress.AM.done+'/'+day.progress.AM.total+' recorded'+(am.completedAt?' · Completed':' · Still In Progress')+'. AM values below are read-only.':'No AM rounds have been recorded for this date yet. AM entries will appear here as they are saved.';
    $('noteCount').textContent=day.notes.length;
  }
  function renderConflicts() {
    const box=$('conflicts');box.replaceChildren();box.hidden=!conflicts.size;
    if(!conflicts.size)return;
    box.append(node('strong','','Another Operator Updated These Entries'));
    for(const [id,current] of conflicts){
      const field=template.fields.find(f=>f.id===id),line=node('div','conflict-item');
      line.append(node('p','',field.label+': saved '+describe(field,current.value)+'; your entry '+describe(field,pending.get(id)?.value)+'.'));
      for(const [label,keep] of [['Use Saved Value',false],['Save My Entry',true]]){
        const button=node('button','',label);button.type='button';button.onclick=()=>{
          if(keep)pending.get(id).revision=current.revision;else pending.delete(id);
          conflicts.delete(id);if(!conflicts.size)failed=false;renderConflicts();persistDraft();paintFields();clearError();if(!conflicts.size)void flush();
        };line.append(button);
      }box.append(line);
    }
  }
  function stage(field,value) {
    invalidEdits.delete(field.id);
    const old=pending.get(field.id);
    pending.set(field.id,{value,revision:old?.revision ?? day.shifts[session.shift].entries[field.id]?.revision ?? 0});
    persistDraft();progressUI();clearTimeout(saveTimer);saveTimer=setTimeout(()=>void flush(),450);
  }
  async function flush() {
    clearTimeout(saveTimer);
    if(invalidEdits.size){error('Correct the highlighted number before continuing.');return false;}
    if(savePromise)return savePromise;
    if(!session || !pending.size)return !failed;
    if(conflicts.size)return false;
    savePromise=(async()=>{
      while(pending.size){
        const [id,change]=pending.entries().next().value;
        try {
          day=await api(`/${session.date}/${session.shift}/entries/${id}`,{method:'PUT',body:JSON.stringify({...change,operator:session.operator})});
          if(pending.get(id)===change)pending.delete(id);
          else pending.get(id).revision=day.shifts[session.shift].entries[id].revision;
          failed=false;persistDraft();paintHome();progressUI();
        } catch(err){
          failed=true;
          if(err.status===409){day.shifts[session.shift].entries[id]=err.current;conflicts.set(id,err.current);renderConflicts();}
          error(err.message);progressUI();return false;
        }
      }
      clearError();progressUI();return true;
    })();
    try{return await savePromise;}finally{savePromise=null;}
  }
  function paintFields() {
    if(!session)return;
    const list=$('fieldList');list.replaceChildren();$('roundsView').classList.toggle('pm-view',session.shift==='PM');
    const fields=template.fields.filter(f=>f.location===locationId && (f.shifts.includes(session.shift) || session.shift==='PM' && f.shifts.includes('AM')));
    if(session.shift==='PM'){const heads=node('div','column-heads');for(const title of ['Item','AM · Saved Reference','PM · Enter Values'])heads.append(node('span','',title));list.append(heads);}
    let section='',sectionNode;
    for(const field of fields){
      if(field.section!==section){
        section=field.section;sectionNode=node('section','checklist-section');
        const heading=node('h3','field-section',section);heading.id='section-'+field.id;
        sectionNode.setAttribute('aria-labelledby',heading.id);sectionNode.append(heading);list.append(sectionNode);
      }
      const label=field.unit && !field.label.endsWith('('+field.unit+')')?field.label+' ('+field.unit+')':field.label;
      const row=node('div','entry-row'),title=node('div','entry-title',label);title.id='label-'+field.id;
      if(field.shifts.length===1)title.append(node('span','entry-subtitle',field.shifts[0]+' Only'));
      row.append(title);
      if(session.shift==='PM'){
        const am=day.shifts.AM.entries[field.id],previous=node('div','am-value');
        previous.title=am?.updatedAt?'Saved by '+am.updatedBy+' · '+time(am.updatedAt):'AM reading is not recorded';
        previous.dataset.amField=field.id;previous.append(document.createTextNode(field.shifts.includes('AM')?describe(field,am?.value):'Not Scheduled'));
        previous.append(node('span','',am?am.updatedBy+' · '+time(am.updatedAt):'AM'));row.append(previous);
      }
      if(!field.shifts.includes(session.shift)){row.append(node('div','am-only','AM Only · No PM Entry Needed'));sectionNode.append(row);continue;}
      const saved=entry(field),value=saved?.value,controls=node('div','entry-controls');
      if(session.shift==='PM'){
        controls.append(node('span','pm-entry-label','PM Entry'));
        controls.setAttribute('role','group');controls.setAttribute('aria-label','PM Entry: '+label);
      }
      if(field.type==='check'){
        const label=node('label','task-check'),input=node('input');input.type='checkbox';input.id='entry-'+field.id;input.checked=value===true;input.setAttribute('aria-labelledby',title.id);
        input.onchange=()=>stage(field,input.checked?true:null);label.append(input,document.createTextNode('Completed'));controls.append(label);
      }else if(field.type==='yesno'){
        const options=node('div','answer-options');options.setAttribute('role','group');options.setAttribute('aria-labelledby',title.id);
        for(const [text,answer] of [['Yes',true],['No',false]]){const label=node('label'),input=node('input');input.type='radio';input.name='entry-'+field.id;input.id='entry-'+field.id+'-'+text;input.checked=value===answer;input.onchange=()=>stage(field,answer);label.append(input,document.createTextNode(text));options.append(label);}controls.append(options);
      }else{
        const input=node(field.type==='text'?'textarea':'input');input.id='entry-'+field.id;input.setAttribute('aria-labelledby',title.id);
        if(field.type==='number'){input.type='number';input.step=field.label.startsWith('Clarity')?'1':'any';input.inputMode='decimal';if(field.label.startsWith('Clarity')){input.min='1';input.max='5';}}
        else{input.rows=2;input.maxLength=2000;}
        input.value=value===undefined || value===null || value==='na' || !numericValue(field,value)?'':String(value);input.placeholder=value==='na'?'N/A':'Not Recorded';
        input.oninput=()=>{if(!input.validity.valid){invalidEdits.add(field.id);input.reportValidity();progressUI();return;}stage(field,field.type==='number'?(input.value===''?null:Number(input.value)):input.value);};controls.append(input);
      }
      const na=node('button','small-button','N/A');na.type='button';na.setAttribute('aria-label','Mark '+field.label+' Not Applicable');na.setAttribute('aria-pressed',String(value==='na'));na.onclick=()=>{stage(field,value==='na'?null:'na');paintFields();};controls.append(na);
      const reset=node('button','small-button','Clear');reset.type='button';reset.setAttribute('aria-label','Clear '+field.label);reset.onclick=()=>{stage(field,null);paintFields();};controls.append(reset);
      const audit=node('span','entry-audit',saved?.pending?'Waiting To Save':saved?.updatedAt?saved.updatedBy+' · '+time(saved.updatedAt):field.required?'Not Recorded':'Optional');controls.append(audit);row.append(controls);sectionNode.append(row);
    }
    $('locationTitle').textContent=template.locations.find(l=>l.id===locationId).label;
    const index=template.locations.findIndex(l=>l.id===locationId);$('previousLocation').disabled=index===0;$('nextLocation').hidden=index===template.locations.length-1;
    progressUI();
  }
  function showRounds(){
    $('homeView').hidden=true;$('roundsView').hidden=false;$('roundsNav').disabled=false;$('roundsNav').setAttribute('aria-current','page');$('homeNav').removeAttribute('aria-current');
    $('sessionTitle').textContent=session.shift+' Rounds';$('sessionDate').textContent=dateLabel(session.date);$('sessionOperator').textContent='Operator: '+session.operator;
    paintFields();window.scrollTo({top:0});
  }
  async function loadDay() {
    if(session || starting)return;
    const id=++loadId,date=$('roundsDate').value;
    $('startButton').disabled=true;day=null;$('noteCount').textContent='0';$('homeNotes').replaceChildren(node('p','empty','Loading daily notes…'));
    try{const result=await api('/'+date);if(id!==loadId || session)return;day=result;template=result.template;clearError();paintHome();$('startButton').disabled=false;}
    catch(err){if(id===loadId){$('shiftSummaries').replaceChildren(node('p','empty','Daily record unavailable. Use Refresh to try again.'));error(err.message);}}
  }
  $('startForm').onsubmit=async event=>{
    event.preventDefault();if(!day || starting)return;starting=true;++loadId;$('startButton').disabled=true;$('roundsDate').disabled=true;
    $('completionNotice').hidden=true;
    const context={date:$('roundsDate').value,shift:selectedShift(),operator:$('operatorName').value.trim()};
    try{
      day=await post(`/${context.date}/${context.shift}/start`,{operator:context.operator});session=context;template=day.template;store('plant-rounds-operator',context.operator);
      pending.clear();conflicts.clear();const draft=readLocal(draftKey(),{});
      for(const [id,change] of Object.entries(draft))if(template.fields.some(f=>f.id===id && f.shifts.includes(session.shift)) && change && Number.isSafeInteger(change.revision))pending.set(id,change);
      locationId=template.locations[0].id;$('locationSelect').value=locationId;showRounds();if(pending.size)void flush();
    }catch(err){error(err.message);}finally{starting=false;$('startButton').disabled=false;$('roundsDate').disabled=false;}
  };
  function showHome(){
    session=null;$('roundsView').hidden=true;$('homeView').hidden=false;$('homeNav').setAttribute('aria-current','page');$('roundsNav').removeAttribute('aria-current');$('roundsNav').disabled=true;window.scrollTo({top:0});
  }
  $('homeNav').onclick=async()=>{
    if(completing || session && !await flush())return;
    showHome();await loadDay();
  };
  $('roundsNav').onclick=()=>{if(session)showRounds();};
  for(const [id,url] of [['historyNav','history.html'],['manageNav','manage.html'],['usersNav','/operations-management/']])$(id).onclick=async()=>{if(starting)return;if(session && !await flush())return;location.assign(url);};
  document.querySelectorAll('[data-view-pdf]').forEach(button=>button.addEventListener('click',async()=>{
    if(!session && !$('roundsDate').reportValidity())return;
    const date=activeDate();
    // Open synchronously so a save request cannot cause a mobile popup block.
    const preview=window.open('about:blank','_blank');
    if(preview){preview.opener=null;preview.document.title='Preparing Plant Rounds PDF';preview.document.body.textContent='Saving entries and preparing your PDF…';}
    document.querySelectorAll('[data-view-pdf]').forEach(button=>button.disabled=true);
    try{
      if(session && !await flush()){preview?.close();return;}
      const url='report.html?date='+encodeURIComponent(date);
      if(preview){if(!preview.closed)preview.location.replace(url);}else location.assign(url);
    }catch(err){preview?.close();error('The PDF preview could not be opened. '+err.message);}
    finally{document.querySelectorAll('[data-view-pdf]').forEach(button=>button.disabled=false);}
  }));
  $('roundsDate').onchange=()=>{$('completionNotice').hidden=true;void loadDay();};$('refreshDay').onclick=()=>void loadDay();
  $('dismissCompletion').onclick=()=>{$('completionNotice').hidden=true;};
  document.querySelectorAll('[name=shift]').forEach(input=>input.onchange=paintHome);
  $('retrySave').onclick=()=>{if(session){failed=false;void flush().then(()=>{if(!pending.size)void refreshSession();});}else void loadDay();};
  function switchLocation(id){if(invalidEdits.size){$('locationSelect').value=locationId;error('Correct the highlighted number before changing locations.');return;}locationId=id;$('locationSelect').value=id;paintFields();$('locationSelect').focus();window.scrollTo({top:0});}
  $('locationSelect').onchange=()=>switchLocation($('locationSelect').value);
  $('previousLocation').onclick=()=>switchLocation(template.locations[template.locations.findIndex(l=>l.id===locationId)-1].id);
  $('nextLocation').onclick=()=>switchLocation(template.locations[template.locations.findIndex(l=>l.id===locationId)+1].id);
  $('completeRounds').onclick=async()=>{
    if(completing || !session)return;
    completing=true;progressUI();const context=session;
    try{
      if(!await flush())return;
      day=await post(`/${context.date}/${context.shift}/complete`,{operator:context.operator});
      completing=false;progressUI();showHome();paintHome();
      $('completionText').textContent=context.shift+' rounds for '+dateLabel(context.date)+' have been completed.';
      $('completionNotice').hidden=false;$('completionNotice').focus({preventScroll:true});
    }catch(err){error(err.message);}
    finally{completing=false;if(session)progressUI();}
  };
  async function refreshSession(){
    if(!session || savePromise || pending.size || invalidEdits.size)return;
    const ctx=session;
    try{const result=await api('/'+ctx.date);if(session!==ctx || savePromise || pending.size)return;day=result;clearError();progressUI();if(!$('fieldList').contains(document.activeElement))paintFields();else{
      document.querySelectorAll('[data-am-field]').forEach(el=>{const field=template.fields.find(f=>f.id===el.dataset.amField),am=day.shifts.AM.entries[field.id];el.title=am?.updatedAt?'Saved by '+am.updatedBy+' · '+time(am.updatedAt):'AM reading is not recorded';el.replaceChildren(document.createTextNode(field.shifts.includes('AM')?describe(field,am?.value):'Not Scheduled'),node('span','',am?am.updatedBy+' · '+time(am.updatedAt):'AM'));});
    }if($('notesDialog').open)paintNotes($('notesList'),day.notes);}
    catch(err){error('Could not refresh shared rounds. Displayed entries may be out of date. '+err.message);}
  }
  $('fieldList').addEventListener('focusout',()=>setTimeout(()=>{if(!$('fieldList').contains(document.activeElement))paintFields();},100));
  $('notesButton').onclick=()=>{
    if(!template || !session && !$('roundsDate').reportValidity())return;
    noteContext={date:activeDate(),shift:session?.shift || selectedShift()};noteId=null;
    $('notesDate').textContent=dateLabel(noteContext.date)+' · '+noteContext.shift;$('noteOperator').value=session?.operator || $('operatorName').value;
    resetNoteForm();
    paintNotes($('notesList'),day?.date===noteContext.date?day.notes:[]);$('noteError').hidden=true;$('notesDialog').showModal();
  };
  $('referenceButton').onclick=()=>{
    if(!session && !$('roundsDate').reportValidity())return;
    window.DrawdownReference.open({date:activeDate(),shift:session?.shift || selectedShift(),operator:session?.operator || $('operatorName').value});
  };
  window.addEventListener('rounds:reference-saved',()=>{if(session)void refreshSession();else void loadDay();});
  $('closeNotes').onclick=()=>{if(!noteSaving)$('notesDialog').close();};
  $('notesDialog').addEventListener('cancel',event=>{if(noteSaving)event.preventDefault();});
  $('cancelNoteEdit').onclick=()=>{if(!noteSaving)resetNoteForm();};
  for(const id of ['noteText','noteLocation'])$(id).addEventListener('input',()=>{noteId=null;if(noteContext && !noteEditing)store(noteKey(noteContext),{text:$('noteText').value,location:$('noteLocation').value});});
  $('noteForm').onsubmit=async event=>{
    event.preventDefault();if(noteSaving)return;noteBusy(true);$('noteError').hidden=true;noteId ||= crypto.randomUUID();
    try{
      const body={id:noteId,operator:$('noteOperator').value.trim(),text:$('noteText').value,location:$('noteLocation').value};
      const result=noteEditing
        ? await api(`/${noteContext.date}/${noteEditing.shift}/notes/${noteEditing.id}`,{method:'PUT',body:JSON.stringify({...body,revision:noteEditing.revision || 0})})
        : await post(`/${noteContext.date}/${noteContext.shift}/notes`,body);
      if(activeDate()===result.date)day=result;if(!noteEditing)store(noteKey(noteContext),{});$('noteText').value='';noteId=null;noteEditing=null;paintNotes($('notesList'),result.notes);paintHome();progressUI();
      $('notesDialog').close();
    }catch(err){noteFailure(err);}
    finally{noteBusy(false);}
  };
  window.addEventListener('beforeunload',event=>{if(pending.size || noteSaving || invalidEdits.size){event.preventDefault();event.returnValue='';}});
  document.addEventListener('operations:before-navigate',event=>{event.detail.waitUntil(flush());});
  window.addEventListener('online',()=>{if(pending.size)void flush();else if(session)void refreshSession();else void loadDay();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){if(session)void refreshSession();else void loadDay();}});
  setInterval(()=>{if(document.hidden)return;if(session){if(pending.size && !conflicts.size)void flush();else void refreshSession();}else if(!noteSaving)void loadDay();},15000);
  $('roundsDate').value=today();$('operatorName').value=readLocal('plant-rounds-operator','');
  const requestedDate=new URLSearchParams(location.search).get('date');
  if(requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)){
    $('roundsDate').value=requestedDate;
    if(!$('roundsDate').value)$('roundsDate').value=today();
  }
  (async()=>{
    try{
      await window.RoundsUsers.ready;
      const response=await fetch('/api/plant-rounds/template',{cache:'no-store'});if(!response.ok)throw new Error('The rounds checklist could not be loaded. Reload this page.');template=await response.json();
      for(const location of template.locations){$('locationSelect').append(new Option(location.label,location.id));$('noteLocation').append(new Option(location.label,location.id));}
      $('noteLocation').prepend(new Option('General / Handoff','general'));await loadDay();
    }catch(err){error(err.message);}
  })();
})();
