(() => {
  'use strict';
  const $=id=>document.getElementById(id),model=SOPModel;
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
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
    $('save-status').textContent=saving?'Saving SOP…':dirty?'Unsaved Changes'+(localSaved?' · Draft Kept In This Browser':''):doc.revision?'Saved · Version '+doc.version:'New SOP';
    $('save-button').disabled=saving;
    for(const id of ['new-button','library-button','files-button'])$(id).disabled=saving;
  }
  function fitWorkspace(){const workspace=document.querySelector('.sop-workspace');workspace.style.setProperty('--workspace-height',Math.max(360,innerHeight-workspace.getBoundingClientRect().top-24)+'px');}
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
    renderSteps();renderPreview();status();
  }
  function renderSteps(){
    let number=0;
    $('procedure-groups').innerHTML=doc.groups.map((group,gi)=>'<section class="procedure-group" data-group="'+group.id+'"><div class="group-heading"><strong>Section '+(gi+1)+'</strong>'+controls('section',group.id,gi,doc.groups.length)+'</div>'+field('Section Heading (Optional)','data-group-title="'+group.id+'"',group.title)+'<div class="steps">'+group.steps.map((step,si)=>'<article class="step-editor" data-step="'+step.id+'"><div class="step-heading"><h3>Step '+(++number)+'</h3>'+controls('step',step.id,si,group.steps.length)+'</div>'+field('Instructions','data-step-instruction="'+step.id+'"',step.instruction,true)+'<div class="substeps">'+step.substeps.map((sub,i)=>'<div class="substep-editor">'+field('Substep '+String.fromCharCode(97+i),'data-substep="'+sub.id+'"',sub.text,true)+controls('substep',sub.id,i,step.substeps.length)+'</div>').join('')+'</div><div class="photos">'+step.photos.map((photo,i)=>'<figure class="photo-editor"><img src="'+photo.data+'" alt="Step photo '+(i+1)+'">'+field('Photo Caption','data-caption="'+photo.id+'"',photo.caption)+controls('photo',photo.id,i,step.photos.length)+'</figure>').join('')+'</div><div class="step-actions"><button type="button" data-action="add-substep" data-id="'+step.id+'">+ Add Substep</button><label class="photo-upload">+ Add Photo<input type="file" data-photo="'+step.id+'" accept="image/png,image/jpeg,image/webp" aria-label="Add Photo To Step '+number+'"></label></div></article>').join('')+'</div><button class="add-step" type="button" data-action="add-step" data-id="'+group.id+'">+ Add Step</button></section>').join('');
  }
  const paragraphs=text=>text.split(/\n\s*\n/).filter(s=>s.trim()).map(s=>'<p>'+escape(s).replaceAll('\n','<br>')+'</p>').join('');
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
    document.title=(doc.title.trim()||'SOP Creator')+' | Northglenn Operations';
    let count=0;
    const metadata=[['Document',doc.documentNumber],['Team',doc.team],['Effective',doc.effectiveDate],['Version',doc.version],['Prepared By',doc.preparedBy],['Approved By',doc.approvedBy]].filter(([,value])=>value.trim());
    $('sop-document').innerHTML='<header class="document-header"><img src="../../assets/logos/northglenn-horizontal.png" alt="City of Northglenn"><p class="document-kind">'+escape(doc.subtitle)+'</p><h1>'+escape(doc.title||'Untitled Procedure')+'</h1><dl>'+metadata.map(([label,value])=>'<div><dt>'+label+'</dt><dd>'+escape(value)+'</dd></div>').join('')+'</dl></header>'+model.sections.filter(([key])=>doc[key].trim()).map(([key,label])=>'<section class="document-section" data-preview-section="'+key+'"><h2>'+label+'</h2>'+(['notes','security','equipment'].includes(key)?'<ul>'+doc[key].split('\n').filter(s=>s.trim()).map(s=>'<li>'+escape(s)+'</li>').join('')+'</ul>':paragraphs(doc[key]))+'</section>').join('')+'<section class="document-section"><h2>Procedure</h2>'+doc.groups.map(group=>(group.title.trim()?'<h3 class="procedure-section-title">'+escape(group.title)+'</h3>':'')+'<ol class="document-steps" start="'+(count+1)+'">'+group.steps.map(step=>{count++;return '<li class="document-step" data-preview-step="'+step.id+'">'+paragraphs(step.instruction)+(step.substeps.length?'<ol class="document-substeps" type="a">'+step.substeps.map(sub=>'<li>'+escape(sub.text).replaceAll('\n','<br>')+'</li>').join('')+'</ol>':'')+renderPhotos(step.photos)+'</li>';}).join('')+'</ol>').join('')+(count?'':'<p class="preview-placeholder">Add your first step to begin the procedure.</p>')+'</section>';
  }
  const allSteps=()=>doc.groups.flatMap(group=>group.steps);
  $('editor').addEventListener('focusin',event=>{
    if(innerWidth<1100)return;
    const step=event.target.closest('[data-step]'),key=event.target.dataset.meta;
    const target=step?document.querySelector('[data-preview-step="'+step.dataset.step+'"]'):key?document.querySelector('[data-preview-section="'+key+'"]')||document.querySelector('.document-header'):null;
    if(target){const preview=$('preview');preview.scrollTop+=target.getBoundingClientRect().top-preview.getBoundingClientRect().top-76;}
  });
  $('editor').addEventListener('input',event=>{
    const input=event.target,d=input.dataset;
    if(d.meta)doc[d.meta]=input.value;
    else if(d.groupTitle)doc.groups.find(g=>g.id===d.groupTitle).title=input.value;
    else if(d.stepInstruction)allSteps().find(s=>s.id===d.stepInstruction).instruction=input.value;
    else if(d.substep)allSteps().flatMap(s=>s.substeps).find(s=>s.id===d.substep).text=input.value;
    else if(d.caption)allSteps().flatMap(s=>s.photos).find(p=>p.id===d.caption).caption=input.value;
    else return;
    changed();
  });
  function move(list,id,action){const index=list.findIndex(item=>item.id===id);if(action==='remove')list.splice(index,1);else{const destination=index+(action==='up'?-1:1);if(destination>=0&&destination<list.length)[list[index],list[destination]]=[list[destination],list[index]];}}
  $('procedure-groups').addEventListener('click',event=>{
    const button=event.target.closest('[data-action]');if(!button)return;
    const {action,id}=button.dataset;let focus;
    if(action==='add-step'){
      if(allSteps().length>=200)return message('Use up to 200 steps per SOP.',true);
      const step=model.step();doc.groups.find(g=>g.id===id).steps.push(step);focus='[data-step-instruction="'+step.id+'"]';
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
  function renderLibrary(){
    const query=$('library-search').value.toLowerCase();
    const matches=library.filter(item=>[item.title,item.team,item.documentNumber].some(value=>String(value||'').toLowerCase().includes(query)));
    $('library-list').innerHTML=matches.length?matches.map(item=>'<article class="library-card"><div><h3>'+escape(item.title)+'</h3><p>'+escape([item.documentNumber,item.team,'Version '+item.version].filter(Boolean).join(' · '))+'</p><small>Saved '+escape(new Date(item.updatedAt).toLocaleString())+'</small></div><button type="button" data-open="'+item.id+'">Open SOP</button></article>').join(''):'<p class="empty">'+(library.length?'No matching SOPs.':'No saved SOPs yet. Create a procedure and choose Save SOP.')+'</p>';
  }
  $('library-button').onclick=async()=>{
    $('library-dialog').showModal();$('library-status').textContent='Loading SOPs…';
    try{library=await request('/api/sops');renderLibrary();$('library-status').textContent='';}catch(error){$('library-status').textContent=error.message;}
  };
  $('library-search').oninput=renderLibrary;
  $('library-list').onclick=async event=>{
    const button=event.target.closest('[data-open]');if(!button)return;
    $('library-dialog').close();if(!await askToLeave())return;
    try{const next=model.validate(await request('/api/sops/'+button.dataset.open));doc=next;dirty=false;sequence++;renderEditor();await persist();message('Opened saved SOP.');}catch(error){message(error.message,true);}
  };
  $('files-button').onclick=()=>$('files-dialog').showModal();
  for(const button of document.querySelectorAll('[data-close]'))button.onclick=()=>$(button.dataset.close).close();
  $('download-button').onclick=()=>{
    const blob=new Blob([JSON.stringify({format:'northglenn-sop',version:1,document:doc},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=(doc.documentNumber||doc.title||'SOP').replace(/[^a-zA-Z0-9-]/g,'-').slice(0,80)+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
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
  for(const view of ['edit','preview'])$(view+'-view').onclick=()=>{document.querySelector('.sop-workspace').dataset.view=view;$('edit-view').setAttribute('aria-pressed',String(view==='edit'));$('preview-view').setAttribute('aria-pressed',String(view==='preview'));};
  document.addEventListener('operations:before-navigate',event=>event.detail.waitUntil((async()=>{if(saving)return false;const allowed=await askToLeave();if(allowed){dirty=false;await draftQueue;await local('delete').catch(()=>{});}return allowed;})()));
  window.addEventListener('beforeunload',event=>{if(dirty||saving){event.preventDefault();event.returnValue='';}});
  $('editor').inert=true;
  (async()=>{try{const recovery=await local('get');if(recovery){doc=model.validate(recovery.doc);dirty=Boolean(recovery.dirty);localSaved=true;if(dirty)message('Restored your unfinished draft from this browser.');}}catch{message('Browser draft recovery is unavailable. Save your SOP to the library before leaving.',true);}finally{renderEditor();$('editor').inert=false;document.querySelector('main').inert=false;}})();
})();
