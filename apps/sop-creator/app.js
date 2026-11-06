(() => {
  'use strict';
  const $=id=>document.getElementById(id),model=SOPModel;
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let previewWindow,previewWindowTimer;
  const previewWindowName='sop-preview-'+crypto.randomUUID();
  function updatePreviewWindow(){
    if(previewWindow&&!previewWindow.closed)previewWindow.postMessage({type:'sop-preview-update',title:doc.title||'Untitled Procedure',html:$('sop-document').innerHTML},location.origin);
  }
  window.addEventListener('message',event=>{
    if(event.origin===location.origin&&event.source===previewWindow&&event.data?.type==='sop-preview-ready')updatePreviewWindow();
  });
  $('open-preview-window').onclick=()=>{
    if(previewWindow&&!previewWindow.closed){updatePreviewWindow();previewWindow.focus();return;}
    previewWindow=window.open('./preview.html?v=20261106-datehistory1',previewWindowName,'popup,width=1000,height=900,resizable=yes,scrollbars=yes');
    if(!previewWindow)message('Allow pop-ups for this site to open the preview window.',true);
  };
  let doc=model.blank(),dirty=false,saving=false,sequence=0,localSaved=false,library=[],draftQueue=Promise.resolve(),confirmResolve;
  const database=new Promise((resolve,reject)=>{
    const request=indexedDB.open('operations-sop-creator',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('drafts');
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  });
  database.catch(()=>{});
  async function local(operation,value){
    const db=await database;
    return new Promise((resolve,reject)=>{
      const transaction=db.transaction('drafts',operation==='get'?'readonly':'readwrite');
      const store=transaction.objectStore('drafts');
      const request=operation==='get'?store.get('current'):operation==='delete'?store.delete('current'):store.put(value,'current');
      transaction.oncomplete=()=>resolve(request.result);transaction.onerror=()=>reject(transaction.error);transaction.onabort=()=>reject(transaction.error);
    });
  }
  function status(){
    $('save-status').textContent=saving?'Saving SOP…':dirty?'Unsaved Changes'+(localSaved?' · Draft Kept In This Browser':''):doc.revision?'Saved':'New SOP';
    $('save-button').disabled=saving;
    for(const id of ['new-button','library-button','files-button'])$(id).disabled=saving;
  }
  function fitWorkspace(){const workspace=document.querySelector('.sop-workspace');workspace.style.setProperty('--workspace-height',Math.max(360,innerHeight-workspace.getBoundingClientRect().top-24)+'px');if($('editor').getClientRects().length)for(const input of $('procedure-groups').querySelectorAll('[data-step-instruction],[data-substep]'))sizeWritingField(input);}
  window.addEventListener('resize',fitWorkspace);
  new ResizeObserver(fitWorkspace).observe(document.querySelector('.toolbar'));
  let previewVisible=true,previewWidth=55;
  try{const settings=JSON.parse(localStorage.getItem('sop-preview-layout')||'null');if(settings){previewVisible=settings.visible!==false;if(Number.isFinite(settings.width))previewWidth=Math.max(35,Math.min(65,settings.width));}}catch{}
  function previewLayout(){
    const workspace=document.querySelector('.sop-workspace');
    workspace.classList.toggle('preview-closed',!previewVisible);
    workspace.style.setProperty('--editor-share',(100-previewWidth)+'fr');
    workspace.style.setProperty('--preview-share',previewWidth+'fr');
    $('toggle-preview').textContent=previewVisible?'Hide Preview':'Show Preview';
    $('toggle-preview').setAttribute('aria-expanded',String(previewVisible));
    $('preview-size').value=previewWidth;$('preview-size').disabled=!previewVisible;
    $('preview-size-value').textContent=previewWidth+'%';
    try{localStorage.setItem('sop-preview-layout',JSON.stringify({visible:previewVisible,width:previewWidth}));}catch{}
    requestAnimationFrame(fitWorkspace);
  }
  $('toggle-preview').onclick=()=>{previewVisible=!previewVisible;previewLayout();};
  $('preview-size').oninput=event=>{previewWidth=Number(event.target.value);previewLayout();};
  $('close-preview').onclick=()=>{if(innerWidth<1100){$('edit-view').click();$('preview-view').focus();}else{previewVisible=false;previewLayout();$('toggle-preview').focus();}};
  previewLayout();
  let messageTimer;
  function message(text,error=false){
    clearTimeout(messageTimer);
    $('message').hidden=!text;$('message').textContent=text;$('message').className=error?'error':'success';
    requestAnimationFrame(fitWorkspace);
    if(text)messageTimer=setTimeout(()=>{$('message').hidden=true;requestAnimationFrame(fitWorkspace);},error?7000:4000);
  }
  function persist(){
    const snapshot={doc:structuredClone(doc),dirty};localSaved=false;
    draftQueue=draftQueue.catch(()=>{}).then(()=>local('put',snapshot)).then(()=>{localSaved=true;status();}).catch(()=>{localSaved=false;status();message('This browser could not keep a recovery draft. Save your SOP or download a backup before leaving.',true);});
    return draftQueue;
  }
  function changed(){dirty=true;sequence++;status();renderPreview();persist();}
  async function request(url,options){
    const response=await fetch(url,{cache:'no-store',...options});
    let data;try{data=await response.json();}catch{throw Error('The SOP service is unavailable. Your draft is still here.');}
    if(!response.ok)throw Error(data.error||'Unable to complete that request.');return data;
  }
  async function save(){
    if(saving)return false;
    if(!doc.title.trim()){message('Enter a title before saving.',true);document.querySelector('[data-meta="title"]').focus();return false;}
    const savedSequence=sequence,snapshot=structuredClone(doc);saving=true;status();
    try{
      const saved=await request('/api/sops/'+doc.id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(snapshot)});
      doc.revision=saved.revision;dirty=sequence!==savedSequence;
      await persist();message(dirty?'SOP saved. Your newer edits still need saving.':'SOP saved to the library.');return !dirty;
    }catch(error){message(error.message,true);return false;}finally{saving=false;status();}
  }
  function askToLeave(){
    if(!dirty)return Promise.resolve(true);
    return new Promise(resolve=>{confirmResolve=resolve;$('confirm-dialog').showModal();});
  }
  function finishConfirm(result){$('confirm-dialog').close();const resolve=confirmResolve;confirmResolve=null;resolve?.(result);}
  $('confirm-cancel').onclick=()=>finishConfirm(false);
  $('confirm-discard').onclick=()=>finishConfirm(true);
  $('confirm-save').onclick=async()=>{const button=$('confirm-save');button.disabled=true;try{if(await save())finishConfirm(true);}finally{button.disabled=false;}};
  $('confirm-dialog').addEventListener('cancel',event=>{event.preventDefault();finishConfirm(false);});
  function field(label,attributes,value,multiline=false){return '<label>'+escape(label)+(multiline?'<textarea '+attributes+' rows="3" maxlength="20000">'+escape(value)+'</textarea>':'<input '+attributes+' maxlength="300" value="'+escape(value)+'">')+'</label>';}
  function controls(kind,id,index,total){return '<div class="item-controls"><button type="button" data-action="'+kind+'-up" data-id="'+id+'" aria-label="Move '+kind+' Up"'+(index===0?' disabled':'')+'>↑</button><button type="button" data-action="'+kind+'-down" data-id="'+id+'" aria-label="Move '+kind+' Down"'+(index===total-1?' disabled':'')+'>↓</button><button type="button" data-action="'+kind+'-remove" data-id="'+id+'" class="remove" aria-label="Remove '+kind+'">Remove</button></div>';}
  function renderEditor(){
    for(const element of document.querySelectorAll('[data-meta]'))element.value=doc[element.dataset.meta];
    $('context-fields').innerHTML=model.sections.map(([key,label])=>field(label,'data-meta="'+key+'"',doc[key],true)).join('');
    renderTags();renderSteps();renderRevisions();renderPreview();status();
  }
  function renderTags(){
    $('tag-options').innerHTML=model.tagGroups.map(group=>'<fieldset><legend>'+escape(group.label)+'</legend><div class="tag-group-options">'+group.tags.map(tag=>'<label class="tag-option"><input type="checkbox" data-sop-tag="'+escape(tag)+'"><span>'+escape(tag)+'</span></label>').join('')+'</div></fieldset>').join('');
    renderTagSelection();filterTags();
  }
  function renderTagSelection(){
    $('tag-count').textContent=doc.tags.length+' Selected';
    $('selected-sop-tags').innerHTML=doc.tags.map(tag=>'<button type="button" data-remove-tag="'+escape(tag)+'" aria-label="Remove '+escape(tag)+' Tag">'+escape(tag)+' <span aria-hidden="true">×</span></button>').join('');
    for(const checkbox of $('tag-options').querySelectorAll('[data-sop-tag]'))checkbox.checked=doc.tags.includes(checkbox.dataset.sopTag);
  }
  function filterTags(){
    const query=$('tag-search').value.trim().toLowerCase();let matches=0;
    for(const group of $('tag-options').querySelectorAll('fieldset')){
      let visible=0;for(const label of group.querySelectorAll('.tag-option')){label.hidden=!label.textContent.toLowerCase().includes(query);if(!label.hidden)visible++;}
      group.hidden=!visible;matches+=visible;
    }
    $('tag-empty').hidden=matches>0;
  }
  $('tag-search').oninput=filterTags;
  $('tag-options').addEventListener('change',event=>{
    const input=event.target;if(!input.matches('[data-sop-tag]'))return;
    if(input.checked&&doc.tags.length>=20){input.checked=false;return message('Choose up to 20 tags for an SOP.',true);}
    doc.tags=input.checked?[...doc.tags,input.dataset.sopTag]:doc.tags.filter(tag=>tag!==input.dataset.sopTag);
    renderTagSelection();changed();
  });
  $('selected-sop-tags').onclick=event=>{const button=event.target.closest('[data-remove-tag]');if(button){doc.tags=doc.tags.filter(tag=>tag!==button.dataset.removeTag);renderTagSelection();changed();}};
  function renderRevisions(){
    $('revision-entries').innerHTML=doc.revisionHistory.length?doc.revisionHistory.map((row,index)=>'<section class="revision-entry"><div class="group-heading"><strong>Revision Entry</strong>'+controls('revision',row.id,index,doc.revisionHistory.length)+'</div><div class="fields">'+[['date','Revision Date'],['revisedBy','Revised By'],['approvedBy','Approved By'],['summary','Change Summary']].map(([key,label])=>'<div class="'+(key==='summary'?'wide':'')+'">'+field(label,'data-revision="'+row.id+'" data-revision-field="'+key+'"'+(key==='date'?' type="date"':''),row[key],key==='summary')+'</div>').join('')+'</div></section>').join(''):'<p class="help">No revision entries yet.</p>';
    for(const input of $('revision-entries').querySelectorAll('[data-revision-field="summary"]'))input.maxLength=2000;
  }
  function revisionTable(){
    const rows=doc.revisionHistory.filter(row=>[row.date,row.summary,row.revisedBy,row.approvedBy].some(value=>value.trim()));
    if(!rows.length)return '';
    return '<section class="document-section document-revisions" data-preview-section="revisions"><h2>Revision History</h2><table><colgroup><col class="revision-date"><col class="revision-summary"><col><col></colgroup><thead><tr><th>Revision Date</th><th>Change Summary</th><th>Revised By</th><th>Approved By</th></tr></thead><tbody>'+rows.map(row=>'<tr>'+[row.date,row.summary,row.revisedBy,row.approvedBy].map(value=>'<td>'+escape(value)+'</td>').join('')+'</tr>').join('')+'</tbody></table></section>';
  }
  $('add-revision').onclick=()=>{
    if(doc.revisionHistory.length>=100)return message('Use up to 100 revision entries per SOP.',true);
    const row={id:crypto.randomUUID(),date:doc.effectiveDate,summary:'',revisedBy:doc.preparedBy,approvedBy:''};
    doc.revisionHistory.push(row);changed();renderRevisions();$('revision-entries').querySelector('[data-revision="'+row.id+'"]').focus();
  };
  $('revision-entries').addEventListener('click',event=>{
    const button=event.target.closest('[data-action]');if(!button)return;
    const action=button.dataset.action.slice('revision-'.length);
    if(action==='remove'&&!window.confirm('Remove this revision entry?'))return;
    move(doc.revisionHistory,button.dataset.id,action);changed();renderRevisions();
  });
  function renderSteps(){
    let number=0;
    $('procedure-groups').innerHTML=doc.groups.map((group,gi)=>'<section class="procedure-group" data-group="'+group.id+'"><div class="group-heading"><strong>Section '+(gi+1)+'</strong>'+controls('section',group.id,gi,doc.groups.length)+'</div>'+field('Section Heading (Optional)','data-group-title="'+group.id+'"',group.title)+'<div class="steps">'+group.steps.map((step,si)=>'<article class="step-editor" data-step="'+step.id+'"><div class="step-heading"><h3>Step '+(++number)+'</h3>'+controls('step',step.id,si,group.steps.length)+'</div>'+field('Instructions','data-step-instruction="'+step.id+'"',step.instruction,true)+'<div class="substeps">'+step.substeps.map((sub,i)=>'<div class="substep-editor">'+field('Substep '+String.fromCharCode(97+i),'data-substep="'+sub.id+'"',sub.text,true)+controls('substep',sub.id,i,step.substeps.length)+'</div>').join('')+'</div>'+editTables(step.tables)+'<div class="photos">'+step.photos.map((photo,i)=>'<figure class="photo-editor"><img src="'+photo.data+'" alt="Step photo '+(i+1)+'">'+field('Photo Caption','data-caption="'+photo.id+'"',photo.caption)+controls('photo',photo.id,i,step.photos.length)+'</figure>').join('')+'</div><div class="step-actions"><button type="button" data-action="add-substep" data-id="'+step.id+'">+ Add Substep</button><button type="button" data-action="add-table" data-id="'+step.id+'">+ Add Table</button><label class="photo-upload">+ Add Photo<input type="file" data-photo="'+step.id+'" accept="image/png,image/jpeg,image/webp" aria-label="Add Photo To Step '+number+'"></label></div></article>').join('')+'</div><button class="add-step" type="button" data-action="add-step" data-id="'+group.id+'">+ Add Step</button></section>').join('');
    for(const input of $('procedure-groups').querySelectorAll('[data-step-instruction],[data-substep]')){
      input.rows=1;input.placeholder=input.dataset.stepInstruction?'Type step instructions...':'Type substep instructions...';input.setAttribute('aria-describedby','procedure-shortcuts');sizeWritingField(input);
    }
  }
  function sizeWritingField(input){input.style.height='auto';input.style.height=Math.max(52,input.scrollHeight+2)+'px';}
  const paragraphs=text=>text.split(/\n\s*\n/).filter(s=>s.trim()).map(s=>'<p>'+escape(s).replaceAll('\n','<br>')+'</p>').join('');
  function editTables(tables){
    return tables.map((table,index)=>'<section class="table-editor" data-table-editor="'+table.id+'"><div class="group-heading"><strong>Table '+(index+1)+'</strong>'+controls('table',table.id,index,tables.length)+'</div>'+field('Table Caption (Optional)','data-table-caption="'+table.id+'"',table.caption)+'<div class="table-editor-scroll"><table><thead><tr>'+table.headers.map((header,column)=>'<th><input data-table="'+table.id+'" data-table-row="-1" data-table-column="'+column+'" value="'+escape(header)+'" maxlength="2000" aria-label="Column '+(column+1)+' Header"><button type="button" data-action="table-column-remove" data-id="'+table.id+'" data-index="'+column+'"'+(table.headers.length===1?' disabled':'')+' aria-label="Remove Column '+(column+1)+'">Remove Column</button></th>').join('')+'<th class="table-row-actions"><span class="sr-only">Row Actions</span></th></tr></thead><tbody>'+table.rows.map((row,rowIndex)=>'<tr>'+row.map((cell,column)=>'<td><textarea rows="2" maxlength="2000" data-table="'+table.id+'" data-table-row="'+rowIndex+'" data-table-column="'+column+'" aria-label="Row '+(rowIndex+1)+', Column '+(column+1)+'">'+escape(cell)+'</textarea></td>').join('')+'<td class="table-row-actions"><button type="button" data-action="table-row-remove" data-id="'+table.id+'" data-index="'+rowIndex+'"'+(table.rows.length===1?' disabled':'')+' aria-label="Remove Row '+(rowIndex+1)+'">Remove Row</button></td></tr>').join('')+'</tbody></table></div><div class="step-actions"><button type="button" data-action="table-row-add" data-id="'+table.id+'">+ Add Row</button><button type="button" data-action="table-column-add" data-id="'+table.id+'">+ Add Column</button></div></section>').join('');
  }
  function previewTables(tables){
    return tables.length?'<div class="document-tables">'+tables.map(table=>'<table class="document-data-table">'+(table.caption.trim()?'<caption>'+escape(table.caption)+'</caption>':'')+'<thead><tr>'+table.headers.map(header=>'<th scope="col">'+escape(header)+'</th>').join('')+'</tr></thead><tbody>'+table.rows.map(row=>'<tr>'+row.map(cell=>'<td>'+escape(cell)+'</td>').join('')+'</tr>').join('')+'</tbody></table>').join('')+'</div>':'';
  }
  function renderPhotos(photos){
    if(!photos.length)return '';
    const rows=[];
    for(let index=0;index<photos.length;index+=2)rows.push('<div class="document-photo-row">'+photos.slice(index,index+2).map(photo=>'<figure><img src="'+photo.data+'" alt="'+escape(photo.caption||'Procedure illustration')+'">'+(photo.caption.trim()?'<figcaption>'+escape(photo.caption)+'</figcaption>':'')+'</figure>').join('')+'</div>');
    return '<div class="document-photos">'+rows.join('')+'</div>';
  }
  $('sop-document').addEventListener('load',event=>{
    const image=event.target;
    if(image.matches('.document-photos img')&&image.naturalHeight)image.closest('figure').style.width=(180*image.naturalWidth/image.naturalHeight)+'px';
  },true);
  function renderPreview(){
    clearTimeout(previewWindowTimer);previewWindowTimer=setTimeout(updatePreviewWindow,100);
    $('revised-date').value=model.revisedDate(doc)||'Not Recorded';
    document.title=(doc.title.trim()||'SOP Creator')+' | Northglenn Operations';
    let count=0;
    const metadata=[['Team',doc.team],['Effective',doc.effectiveDate],['Revised Date',model.revisedDate(doc)||'Not Recorded'],['Prepared By',doc.preparedBy],['Approved By',doc.approvedBy]].filter(([,value])=>value.trim());
    $('sop-document').innerHTML='<header class="document-header"><img src="../../assets/logos/northglenn-horizontal.png" alt="City of Northglenn"><p class="document-kind">Standard Operating Procedure (SOP)</p><h1>'+escape(doc.title||'Untitled Procedure')+'</h1><dl>'+metadata.map(([label,value])=>'<div><dt>'+label+'</dt><dd>'+escape(value)+'</dd></div>').join('')+'</dl></header>'+model.sections.filter(([key])=>doc[key].trim()).map(([key,label])=>'<section class="document-section" data-preview-section="'+key+'"><h2>'+label+'</h2>'+(['notes','security','equipment'].includes(key)?'<ul>'+doc[key].split('\n').filter(s=>s.trim()).map(s=>'<li>'+escape(s)+'</li>').join('')+'</ul>':paragraphs(doc[key]))+'</section>').join('')+'<section class="document-section"><h2>Procedure</h2>'+doc.groups.map(group=>(group.title.trim()?'<h3 class="procedure-section-title">'+escape(group.title)+'</h3>':'')+'<ol class="document-steps" start="'+(count+1)+'">'+group.steps.map(step=>{count++;return '<li class="document-step" data-preview-step="'+step.id+'">'+paragraphs(step.instruction)+(step.substeps.length?'<ol class="document-substeps" type="a">'+step.substeps.map(sub=>'<li>'+escape(sub.text).replaceAll('\n','<br>')+'</li>').join('')+'</ol>':'')+previewTables(step.tables)+renderPhotos(step.photos)+'</li>';}).join('')+'</ol>').join('')+(count?'':'<p class="preview-placeholder">Add your first step to begin the procedure.</p>')+'</section>'+revisionTable();
  }
  const allSteps=()=>doc.groups.flatMap(group=>group.steps);
  const allTables=()=>allSteps().flatMap(step=>step.tables);
  $('editor').addEventListener('focusin',event=>{
    if(event.target.matches('[data-step-instruction],[data-substep]'))sizeWritingField(event.target);
    if(innerWidth<1100)return;
    const step=event.target.closest('[data-step]'),key=event.target.dataset.meta;
    const target=step?document.querySelector('[data-preview-step="'+step.dataset.step+'"]'):event.target.dataset.revisionField?document.querySelector('.document-revisions'):key?document.querySelector('[data-preview-section="'+key+'"]')||document.querySelector('.document-header'):null;
    if(target){const preview=$('preview');preview.scrollTop+=target.getBoundingClientRect().top-preview.getBoundingClientRect().top-76;}
  });
  $('editor').addEventListener('input',event=>{
    const input=event.target,d=input.dataset;
    if(d.table){const table=allTables().find(table=>table.id===d.table),row=Number(d.tableRow),column=Number(d.tableColumn);if(row===-1)table.headers[column]=input.value;else table.rows[row][column]=input.value;}
    else if(d.tableCaption)allTables().find(table=>table.id===d.tableCaption).caption=input.value;
    else if(d.revisionField)doc.revisionHistory.find(row=>row.id===d.revision)[d.revisionField]=input.value;
    else if(d.meta)doc[d.meta]=input.value;
    else if(d.groupTitle)doc.groups.find(g=>g.id===d.groupTitle).title=input.value;
    else if(d.stepInstruction)allSteps().find(s=>s.id===d.stepInstruction).instruction=input.value;
    else if(d.substep)allSteps().flatMap(s=>s.substeps).find(s=>s.id===d.substep).text=input.value;
    else if(d.caption)allSteps().flatMap(s=>s.photos).find(p=>p.id===d.caption).caption=input.value;
    else return;
    if(d.stepInstruction||d.substep)sizeWritingField(input);
    changed();
  });
  function focusWriting(id,substep=false,position=0){
    const input=$('procedure-groups').querySelector('['+(substep?'data-substep':'data-step-instruction')+'="'+id+'"]');
    input?.focus();input?.setSelectionRange(position,position);
  }
  function finishWriting(id,substep=false,position=0){changed();renderSteps();focusWriting(id,substep,position);}
  $('procedure-groups').addEventListener('keydown',event=>{
    const input=event.target;
    if(!input.matches('[data-step-instruction],[data-substep]')||event.isComposing||event.keyCode===229)return;
    const subId=input.dataset.substep,step=allSteps().find(item=>subId?item.substeps.some(sub=>sub.id===subId):item.id===input.dataset.stepInstruction);
    if(!step)return;
    const group=doc.groups.find(item=>item.steps.includes(step)),stepIndex=group.steps.indexOf(step),subIndex=subId?step.substeps.findIndex(sub=>sub.id===subId):-1;
    const start=input.selectionStart,end=input.selectionEnd;
    if(event.altKey&&!event.ctrlKey&&!event.metaKey&&['ArrowUp','ArrowDown'].includes(event.key)){
      event.preventDefault();
      const fields=[...$('procedure-groups').querySelectorAll('[data-step-instruction],[data-substep]')],index=fields.indexOf(input),next=fields[index+(event.key==='ArrowUp'?-1:1)];
      if(next){next.focus();next.setSelectionRange(next.value.length,next.value.length);}return;
    }
    if(event.altKey)return;
    if(event.key==='Tab'&&!event.ctrlKey&&!event.metaKey&&start===0&&end===0){
      if(!event.shiftKey&&!subId&&stepIndex>0&&!step.substeps.length&&!step.photos.length&&!step.tables.length){
        const parent=group.steps[stepIndex-1];
        if(parent.substeps.length>=26)return;
        event.preventDefault();const sub={id:crypto.randomUUID(),text:input.value};parent.substeps.push(sub);group.steps.splice(stepIndex,1);finishWriting(sub.id,true);
      }else if(event.shiftKey&&subId){
        event.preventDefault();
        if(allSteps().length>=200)return message('Use up to 200 steps per SOP.',true);
        const next=model.step();next.instruction=input.value;next.substeps=step.substeps.splice(subIndex+1);step.substeps.splice(subIndex,1);group.steps.splice(stepIndex+1,0,next);finishWriting(next.id);
      }
      return;
    }
    if(event.key!=='Enter'||event.shiftKey)return;
    event.preventDefault();
    if(event.ctrlKey||event.metaKey){
      const next=allSteps()[allSteps().indexOf(step)+1];
      if(next)return focusWriting(next.id,false,next.instruction.length);
      if(allSteps().length>=200)return message('Use up to 200 steps per SOP.',true);
      const created=model.step();group.steps.splice(stepIndex+1,0,created);return finishWriting(created.id);
    }
    if(subId){
      if(!input.value.trim()){
        if(allSteps().length>=200)return message('Use up to 200 steps per SOP.',true);
        const next=model.step();next.substeps=step.substeps.splice(subIndex+1);step.substeps.splice(subIndex,1);group.steps.splice(stepIndex+1,0,next);return finishWriting(next.id);
      }
      if(step.substeps.length>=26)return message('Use up to 26 substeps per step.',true);
      const sub={id:crypto.randomUUID(),text:input.value.slice(end)};step.substeps[subIndex].text=input.value.slice(0,start);step.substeps.splice(subIndex+1,0,sub);return finishWriting(sub.id,true);
    }
    if(!input.value.trim()){
      const next=group.steps[stepIndex+1];
      if(next)focusWriting(next.id);else input.closest('.procedure-group').querySelector('.add-step').focus();
      return;
    }
    if(allSteps().length>=200)return message('Use up to 200 steps per SOP.',true);
    const next=model.step();next.instruction=input.value.slice(end);step.instruction=input.value.slice(0,start);
    // When splitting text, its following substeps and photos follow the trailing text.
    if(next.instruction){next.substeps=step.substeps;next.photos=step.photos;next.tables=step.tables;step.substeps=[];step.photos=[];step.tables=[];}
    group.steps.splice(stepIndex+1,0,next);finishWriting(next.id);
  });
  function move(list,id,action){const index=list.findIndex(item=>item.id===id);if(action==='remove')list.splice(index,1);else{const destination=index+(action==='up'?-1:1);if(destination>=0&&destination<list.length)[list[index],list[destination]]=[list[destination],list[index]];}}
  $('procedure-groups').addEventListener('click',event=>{
    const button=event.target.closest('[data-action]');if(!button)return;
    const {action,id}=button.dataset;let focus;
    if(action==='add-step'){
      if(allSteps().length>=200)return message('Use up to 200 steps per SOP.',true);
      const step=model.step();doc.groups.find(g=>g.id===id).steps.push(step);focus='[data-step-instruction="'+step.id+'"]';
    }else if(action==='add-table'){
      const step=allSteps().find(step=>step.id===id);if(step.tables.length>=6)return message('Use up to 6 tables per step.',true);
      const table=model.table();step.tables.push(table);focus='[data-table-caption="'+table.id+'"]';
    }else if(action.startsWith('table-')){
      const step=allSteps().find(step=>step.tables.some(table=>table.id===id)),table=step?.tables.find(table=>table.id===id);if(!table)return;
      focus='[data-table-caption="'+id+'"]';
      const index=Number(button.dataset.index);
      if(action==='table-row-add'){
        if(table.rows.length>=50)return message('Use up to 50 rows per table.',true);
        table.rows.push(table.headers.map(()=>''));focus='[data-table="'+id+'"][data-table-row="'+(table.rows.length-1)+'"][data-table-column="0"]';
      }else if(action==='table-column-add'){
        if(table.headers.length>=8)return message('Use up to 8 columns per table.',true);
        table.headers.push('Column '+(table.headers.length+1));table.rows.forEach(row=>row.push(''));focus='[data-table="'+id+'"][data-table-row="-1"][data-table-column="'+(table.headers.length-1)+'"]';
      }else if(action==='table-row-remove'){
        if(table.rows.length===1||!Number.isInteger(index)||index<0||index>=table.rows.length||!window.confirm('Remove this table row and its contents?'))return;
        table.rows.splice(index,1);
      }else if(action==='table-column-remove'){
        if(table.headers.length===1||!Number.isInteger(index)||index<0||index>=table.headers.length||!window.confirm('Remove this table column and its contents?'))return;
        table.headers.splice(index,1);table.rows.forEach(row=>row.splice(index,1));
      }else if(['table-up','table-down','table-remove'].includes(action)){
        if(action==='table-remove'&&!window.confirm('Remove this table and its contents?'))return;
        move(step.tables,id,action.slice('table-'.length));
        if(action==='table-remove')focus='[data-step-instruction="'+step.id+'"]';
      }else return;
    }else if(action==='add-substep'){
      const step=allSteps().find(s=>s.id===id);if(step.substeps.length>=26)return message('Use up to 26 substeps per step.',true);
      const sub={id:crypto.randomUUID(),text:''};step.substeps.push(sub);focus='[data-substep="'+sub.id+'"]';
    }else{
      const [kind,direction]=action.split('-');
      let list=kind==='section'?doc.groups:kind==='step'?doc.groups.find(g=>g.steps.some(s=>s.id===id))?.steps:kind==='substep'?allSteps().find(s=>s.substeps.some(sub=>sub.id===id))?.substeps:allSteps().find(s=>s.photos.some(p=>p.id===id))?.photos;
      if(!list)return;
      if(direction==='remove'&&!window.confirm('Remove this '+kind+' from the SOP?'))return;
      move(list,id,direction);
    }
    changed();renderSteps();if(focus)document.querySelector(focus)?.focus();
  });
  $('add-section').onclick=()=>{
    if(doc.groups.length>=30)return message('Use up to 30 procedure sections.',true);
    const group={id:crypto.randomUUID(),title:'',steps:[]};doc.groups.push(group);changed();renderSteps();document.querySelector('[data-group-title="'+group.id+'"]').focus();
  };
  $('editor').addEventListener('change',async event=>{
    const input=event.target;if(!input.dataset.photo||!input.files[0])return;
    const step=allSteps().find(s=>s.id===input.dataset.photo),file=input.files[0],documentId=doc.id;
    try{
      if(step.photos.length>=8)throw Error('Use up to 8 photos per step.');
      if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>20000000)throw Error('Choose a PNG, JPEG, or WebP photo under 20 MB.');
      const bitmap=await createImageBitmap(file);
      const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
      const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
      if(doc.id!==documentId||!allSteps().includes(step))return;
      const photo={id:crypto.randomUUID(),data:canvas.toDataURL('image/jpeg',.9),caption:''};
      const candidate=structuredClone(doc);candidate.groups.flatMap(g=>g.steps).find(s=>s.id===step.id).photos.push(photo);model.validate(candidate);
      step.photos.push(photo);changed();renderSteps();document.querySelector('[data-caption="'+photo.id+'"]').focus();
    }catch(error){message(error.message,true);}finally{input.value='';}
  });
  $('save-button').onclick=save;
  $('new-button').onclick=async()=>{if(!await askToLeave())return;doc=model.blank();dirty=false;sequence++;message('');renderEditor();await persist();document.querySelector('[data-meta="title"]').focus();};
  $('print-button').onclick=async()=>{await Promise.all([...$('sop-document').querySelectorAll('img')].map(image=>image.decode().catch(()=>{})));await document.fonts.ready;window.print();};
  function libraryTagOptions(){
    const selected=$('library-tag').value;
    $('library-tag').innerHTML='<option value="">All Tags</option><option value="__untagged">Untagged</option>'+model.tagGroups.map(group=>'<optgroup label="'+escape(group.label)+'">'+group.tags.map(tag=>'<option value="'+escape(tag)+'">'+escape(tag)+'</option>').join('')+'</optgroup>').join('');
    $('library-tag').value=selected;
  }
  function renderLibrary(){
    const query=$('library-search').value.trim().toLowerCase(),tag=$('library-tag').value,sort=$('library-sort').value;
    const matches=library.filter(item=>[item.title,item.team,...(item.tags||[])].some(value=>String(value||'').toLowerCase().includes(query))&&(!tag||(tag==='__untagged'?!(item.tags||[]).length:(item.tags||[]).includes(tag))));
    const title=(a,b)=>a.title.localeCompare(b.title);
    matches.sort((a,b)=>sort==='title'?title(a,b):sort==='tags'?(a.tags||[]).slice().sort().join(', ').localeCompare((b.tags||[]).slice().sort().join(', '))||title(a,b):sort==='revised'?(b.revisedDate||'').localeCompare(a.revisedDate||'')||title(a,b):b.updatedAt.localeCompare(a.updatedAt)||title(a,b));
    $('library-count').textContent=matches.length+' of '+library.length+' SOPs';
    $('library-list').innerHTML=matches.length?matches.map(item=>'<article class="library-card"><div><h3>'+escape(item.title)+'</h3><p>'+escape([item.team,item.revisedDate?'Revised '+item.revisedDate:''].filter(Boolean).join(' / '))+'</p><div class="sop-tags">'+(item.tags||[]).map(tag=>'<button type="button" data-filter-tag="'+escape(tag)+'" aria-label="Filter SOPs By '+escape(tag)+'">'+escape(tag)+'</button>').join('')+'</div><small>Saved '+escape(new Date(item.updatedAt).toLocaleString())+'</small></div><button type="button" data-open="'+item.id+'">Open SOP</button></article>').join(''):'<p class="empty">'+(library.length?'No matching SOPs. Clear filters to see all documents.':'No saved SOPs yet. Create a procedure and choose Save SOP.')+'</p>';
  }
  $('library-button').onclick=async()=>{
    $('library-dialog').showModal();$('library-status').textContent='Loading SOPs…';
    try{library=await request('/api/sops');libraryTagOptions();renderLibrary();$('library-status').textContent='';}catch(error){$('library-status').textContent=error.message;}
  };
  $('library-search').oninput=renderLibrary;
  $('library-tag').onchange=renderLibrary;
  $('library-sort').onchange=renderLibrary;
  $('clear-library-filters').onclick=()=>{$('library-search').value='';$('library-tag').value='';renderLibrary();};
  $('library-list').onclick=async event=>{
    const tag=event.target.closest('[data-filter-tag]');if(tag){$('library-tag').value=tag.dataset.filterTag;renderLibrary();return;}
    const button=event.target.closest('[data-open]');if(!button)return;
    $('library-dialog').close();if(!await askToLeave())return;
    try{const next=model.validate(await request('/api/sops/'+button.dataset.open));doc=next;dirty=false;sequence++;renderEditor();await persist();message('Opened saved SOP.');}catch(error){message(error.message,true);}
  };
  $('files-button').onclick=()=>$('files-dialog').showModal();
  for(const button of document.querySelectorAll('[data-close]'))button.onclick=()=>$(button.dataset.close).close();
  $('download-button').onclick=()=>{
    const blob=new Blob([JSON.stringify({format:'northglenn-sop',version:1,document:doc},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=(doc.title||'SOP').replace(/[^a-zA-Z0-9-]/g,'-').slice(0,80)+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  $('import-file').onchange=async event=>{
    const file=event.target.files[0];if(!file)return;
    try{
      if(file.size>16000000)throw Error('Choose an SOP backup under 16 MB.');
      const backup=JSON.parse(await file.text());if(backup.format!=='northglenn-sop'||backup.version!==1)throw Error('Choose an SOP Creator backup.');
      const next=model.validate(backup.document);$('files-dialog').close();if(!await askToLeave())return;
      doc={...next,id:crypto.randomUUID(),revision:0};renderEditor();changed();message('Backup imported as a new SOP. Save it to add it to the library.');
    }catch(error){message('Import failed: '+error.message,true);}finally{event.target.value='';}
  };
  for(const view of ['edit','preview'])$(view+'-view').onclick=()=>{document.querySelector('.sop-workspace').dataset.view=view;$('edit-view').setAttribute('aria-pressed',String(view==='edit'));$('preview-view').setAttribute('aria-pressed',String(view==='preview'));requestAnimationFrame(fitWorkspace);};
  document.addEventListener('operations:before-navigate',event=>event.detail.waitUntil((async()=>{if(saving)return false;const allowed=await askToLeave();if(allowed){dirty=false;await draftQueue;await local('delete').catch(()=>{});}return allowed;})()));
  window.addEventListener('beforeunload',event=>{if(dirty||saving){event.preventDefault();event.returnValue='';}});
  $('editor').inert=true;
  (async()=>{try{const recovery=await local('get');if(recovery){doc=model.validate(recovery.doc);dirty=Boolean(recovery.dirty);localSaved=true;if(dirty)message('Restored your unfinished draft from this browser.');}}catch{message('Browser draft recovery is unavailable. Save your SOP to the library before leaving.',true);}finally{renderEditor();$('editor').inert=false;document.querySelector('main').inert=false;}})();
})();
