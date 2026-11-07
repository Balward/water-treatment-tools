(() => {
  'use strict';
  const preview=document.getElementById('sop-document');
  const selector=(attribute,value)=>'['+attribute+'="'+CSS.escape(value)+'"]';
  function link(element,target){
    if(!element||!document.querySelector(target))return;
    element.dataset.editTarget=target;element.tabIndex=0;element.setAttribute('role','button');
    element.title='Edit This Element';element.setAttribute('aria-label','Edit: '+element.textContent.trim().slice(0,100));
  }
  function bind(doc){
    link(preview.querySelector('h1'),'[data-meta="title"]');
    const metadata={'Responsible Team':'team'};
    for(const item of preview.querySelectorAll('.document-header dl>div')){
      const label=item.querySelector('dt').textContent,key=metadata[label];
      if(key)link(item,selector('data-meta',key));
      else if(label==='Revised Date'||label==='Reviewed Date')link(item,'#add-revision');
    }
    for(const section of preview.querySelectorAll('[data-preview-section]')){
      if(section.dataset.previewSection==='revisions')continue;
      for(const part of section.querySelectorAll('h2,p,li'))link(part,selector('data-meta',section.dataset.previewSection));
    }
    const headings=[...preview.querySelectorAll('.procedure-section-title')];
    doc.groups.filter(group=>group.title.trim()).forEach((group,index)=>link(headings[index],selector('data-group-title',group.id)));
    for(const step of doc.groups.flatMap(group=>group.steps)){
      const element=preview.querySelector(selector('data-preview-step',step.id));if(!element)continue;
      for(const paragraph of element.querySelectorAll(':scope>p'))link(paragraph,selector('data-step-instruction',step.id));
      [...element.querySelectorAll('.document-substeps>li')].forEach((item,index)=>link(item,selector('data-substep',step.substeps[index].id)));
      [...element.querySelectorAll('.document-photos figure')].forEach((item,index)=>link(item,selector('data-caption',step.photos[index].id)));
      [...element.querySelectorAll('.document-data-table')].forEach((table,index)=>{
        const id=step.tables[index].id;
        link(table.querySelector('caption'),selector('data-table-caption',id));
        [...table.querySelectorAll('thead th')].forEach((cell,column)=>link(cell,selector('data-table',id)+'[data-table-row="-1"][data-table-column="'+column+'"]'));
        [...table.querySelectorAll('tbody tr')].forEach((row,rowIndex)=>[...row.children].forEach((cell,column)=>link(cell,selector('data-table',id)+'[data-table-row="'+rowIndex+'"][data-table-column="'+column+'"]')));
      });
    }
    const rows=doc.revisionHistory.filter(row=>[row.date,row.summary,row.revisedBy,row.approvedBy].some(value=>value.trim()));
    [...preview.querySelectorAll('.document-revisions tbody tr')].forEach((row,index)=>[...row.children].forEach((cell,column)=>link(cell,selector('data-revision',rows[index].id)+'[data-revision-field="'+['date','type','summary','revisedBy','approvedBy'][column]+'"]')));
  }
  function activate(event){
    if(event.type==='keydown'&&!['Enter',' '].includes(event.key))return;
    const element=event.target.closest('[data-edit-target]');if(!element)return;
    if(event.type==='click'&&window.getSelection()?.toString())return;
    const field=document.querySelector(element.dataset.editTarget);if(!field)return;
    event.preventDefault();document.getElementById('edit-view').click();
    for(let parent=field.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;
    field.focus({preventScroll:true});field.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});
    field.classList.remove('preview-edit-focus');void field.offsetWidth;field.classList.add('preview-edit-focus');
    setTimeout(()=>field.classList.remove('preview-edit-focus'),1600);
  }
  preview.addEventListener('click',activate);preview.addEventListener('keydown',activate);
  window.SOPPreviewEditor={bind};
})();
