(function(root){
  'use strict';
  const model=typeof module!=='undefined'&&module.exports?require('./model'):root.SOPModel;
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const paragraphs=text=>text.split(/\n\s*\n/).filter(s=>s.trim()).map(s=>'<p>'+escape(s).replaceAll('\n','<br>')+'</p>').join('');
  function revisionTable(doc){
    const rows=doc.revisionHistory.filter(row=>[row.date,row.summary,row.revisedBy,row.approvedBy].some(value=>value.trim()));
    if(!rows.length)return '';
    return '<section class="document-section document-revisions" data-preview-section="revisions"><h2>Revision History</h2><table><colgroup><col class="revision-date"><col><col class="revision-summary"><col><col></colgroup><thead><tr><th>Date</th><th>Type</th><th>Summary</th><th>Revised / Reviewed By</th><th>Approved By</th></tr></thead><tbody>'+rows.map(row=>'<tr>'+[row.date,row.type==='review'?'Review':'Revision',row.summary||(row.type==='review'?'Reviewed - No Changes':''),row.revisedBy,row.approvedBy].map(value=>'<td>'+escape(value)+'</td>').join('')+'</tr>').join('')+'</tbody></table></section>';
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
  function render(doc){
    let count=0;
    const metadata=[['Team',doc.team],['Effective',doc.effectiveDate],['Revised Date',model.revisedDate(doc)||'Not Recorded'],['Reviewed Date',model.reviewedDate(doc)],['Prepared By',doc.preparedBy],['Approved By',doc.approvedBy]].filter(([,value])=>value.trim());
    return '<header class="document-header"><img src="../../assets/logos/northglenn-horizontal.png" alt="City of Northglenn"><p class="document-kind">Standard Operating Procedure (SOP)</p><h1>'+escape(doc.title||'Untitled Procedure')+'</h1><dl>'+metadata.map(([label,value])=>'<div><dt>'+label+'</dt><dd>'+escape(value)+'</dd></div>').join('')+'</dl></header>'+model.sections.filter(([key])=>doc[key].trim()).map(([key,label])=>'<section class="document-section" data-preview-section="'+key+'"><h2>'+label+'</h2>'+(['notes','safety','security','equipment'].includes(key)?'<ul>'+doc[key].split('\n').filter(s=>s.trim()).map(s=>'<li>'+escape(s)+'</li>').join('')+'</ul>':paragraphs(doc[key]))+'</section>').join('')+'<section class="document-section"><h2>Procedure</h2>'+doc.groups.map(group=>(group.title.trim()?'<h3 class="procedure-section-title">'+escape(group.title)+'</h3>':'')+'<ol class="document-steps" start="'+(count+1)+'">'+group.steps.map(step=>{count++;return '<li class="document-step" data-preview-step="'+step.id+'">'+paragraphs(step.instruction)+(step.substeps.length?'<ol class="document-substeps" type="a">'+step.substeps.map(sub=>'<li>'+escape(sub.text).replaceAll('\n','<br>')+'</li>').join('')+'</ol>':'')+previewTables(step.tables)+renderPhotos(step.photos)+'</li>';}).join('')+'</ol>').join('')+(count?'':'<p class="preview-placeholder">Add your first step to begin the procedure.</p>')+'</section>'+revisionTable(doc);
  }
  const api={render};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SOPDocument=api;
})(typeof globalThis!=='undefined'?globalThis:this);
