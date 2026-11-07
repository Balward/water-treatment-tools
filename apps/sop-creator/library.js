(() => {
  'use strict';
  const $=id=>document.getElementById(id),model=SOPModel;
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let library=[],loading=false,deleteTarget=null,deleting=false,layout='list';
  try{layout=localStorage.getItem('sop-library-layout')==='grid'?'grid':'list';}catch{}
  const svg=paths=>'<svg aria-hidden="true" viewBox="0 0 24 24">'+paths+'</svg>',icons={document:svg('<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8zM14 3v5h5M8 12h8M8 16h6"/>'),edit:svg('<path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15z"/>'),trash:svg('<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>'),warning:svg('<path d="m12 3 10 18H2zM12 9v5M12 17h.01"/>'),check:svg('<path d="m5 12 4 4L19 6"/>')};
  const date=value=>value?new Date(value+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'Not Recorded';
  $('library-tag').innerHTML='<option value="">All Tags</option><option value="__untagged">Untagged</option>'+model.tagGroups.map(group=>'<optgroup label="'+escape(group.label)+'">'+group.tags.map(tag=>'<option value="'+escape(tag)+'">'+escape(tag)+'</option>').join('')+'</optgroup>').join('');
  const query=new URLSearchParams(location.search);
  $('library-search').value=query.get('q')||'';
  if(model.tags.includes(query.get('tag'))||query.get('tag')==='__untagged')$('library-tag').value=query.get('tag');
  if(['saved','title','title-desc','review','revised'].includes(query.get('sort')))$('library-sort').value=query.get('sort');
  if(['review','current'].includes(query.get('review')))$('library-review').value=query.get('review');
  function render(){
    const search=$('library-search').value.trim().toLowerCase(),tag=$('library-tag').value,sort=$('library-sort').value,review=$('library-review').value;
    const matches=library.filter(item=>[item.title,item.team,...(item.tags||[])].some(value=>String(value||'').toLowerCase().includes(search))&&(!tag||(tag==='__untagged'?!(item.tags||[]).length:(item.tags||[]).includes(tag)))&&(!review||model.reviewStatus(item).needsReview===(review==='review')));
    const title=(a,b)=>a.title.localeCompare(b.title);
    matches.sort((a,b)=>sort==='title'?title(a,b):sort==='title-desc'?title(b,a):sort==='review'?Number(model.reviewStatus(b).needsReview)-Number(model.reviewStatus(a).needsReview)||title(a,b):sort==='revised'?(b.revisedDate||'').localeCompare(a.revisedDate||'')||title(a,b):b.updatedAt.localeCompare(a.updatedAt)||title(a,b));
    $('library-count').textContent=matches.length+(matches.length===library.length?' SOPs':' of '+library.length+' SOPs');
    $('review-shortcut').innerHTML=icons.warning+library.filter(item=>model.reviewStatus(item).needsReview).length+' Need Review';
    $('library-list').dataset.layout=layout;document.querySelectorAll('[data-layout-choice]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.layoutChoice===layout)));
    $('library-list').innerHTML='<div class="column-head" aria-hidden="true"><span>SOP</span><span class="tags-heading">Tags</span><span>Last Revised</span><span>Review Status</span><span></span></div>'+(matches.length?matches.map(item=>{
      const [subject,...task]=item.title.split(' — '),needs=model.reviewStatus(item).needsReview,href='./preview.html?'+new URLSearchParams({v:'20261106-listgrid1',sop:item.id});
      return '<article class="entry library-card"><div class="entry-title"><span class="doc-icon">'+icons.document+'</span><div class="title-copy"><a data-preview-link="'+escape(item.id)+'" href="'+escape(href)+'" target="_blank" rel="noopener" aria-label="View SOP: '+escape(item.title)+'"><h2>'+escape(subject)+'</h2>'+(task.length?'<p>'+escape(task.join(' — '))+'</p>':'')+'</a></div></div><div class="tags">'+((item.tags||[]).length?item.tags.map(tag=>'<button type="button" class="tag" data-filter-tag="'+escape(tag)+'">'+escape(tag)+'</button>').join(''):'<span class="no-tags">No Tags</span>')+'</div><div class="dates" title="Saved '+escape(new Date(item.updatedAt).toLocaleString())+'">'+date(item.revisedDate)+(item.reviewedDate?'<small>Reviewed '+date(item.reviewedDate)+'</small>':'')+'</div><span class="status '+(needs?'needs-review':'current')+'">'+(needs?icons.warning:icons.check)+(needs?'Needs Review':'Current')+'</span><div class="actions"><a class="view-link" data-view="'+escape(item.id)+'" href="'+escape(href)+'" target="_blank" rel="noopener">View SOP</a><a class="icon-action" data-open="'+escape(item.id)+'" href="./editor.html?'+new URLSearchParams({sop:item.id})+'" aria-label="Edit '+escape(item.title)+'" title="Edit SOP">'+icons.edit+'<span class="sr-only">Edit SOP</span></a><button class="icon-action delete-action" data-delete="'+escape(item.id)+'" type="button" aria-label="Delete SOP: '+escape(item.title)+'" title="Delete SOP">'+icons.trash+'<span class="sr-only">Delete SOP</span></button></div></article>';
    }).join(''):'<div class="library-empty"><h2>'+ (library.length?'No Matching SOPs':'No Saved SOPs Yet')+'</h2><p>'+(library.length?'Try another search or clear the filters.':'Create a procedure and save it to see it here.')+'</p></div>');
    const url=new URL(location.href);url.search='';if(search)url.searchParams.set('q',$('library-search').value.trim());if(tag)url.searchParams.set('tag',tag);if(review)url.searchParams.set('review',review);if(sort!=='title')url.searchParams.set('sort',sort);history.replaceState(null,'',url);
  }

  async function load(){
    if(loading)return;loading=true;$('library-status').textContent='Loading SOPs…';
    try{const response=await fetch('/api/sops',{cache:'no-store'});if(!response.ok)throw Error('Unable to load your SOPs. Reload the page to try again.');const records=await response.json();if(!Array.isArray(records))throw Error('The SOP library response was unavailable. Reload the page to try again.');library=records;render();$('library-status').textContent='';}
    catch(error){$('library-status').textContent=error.message;}
    finally{loading=false;}
  }
  $('library-search').oninput=render;$('library-tag').onchange=render;$('library-sort').onchange=render;$('library-review').onchange=render;
  $('clear-library-filters').onclick=()=>{$('library-search').value='';$('library-tag').value='';$('library-review').value='';render();};
  document.querySelectorAll('[data-layout-choice]').forEach(button=>button.onclick=()=>{layout=button.dataset.layoutChoice;try{localStorage.setItem('sop-library-layout',layout);}catch{}render();});
  $('review-shortcut').onclick=()=>{$('library-review').value=$('library-review').value==='review'?'':'review';render();};
  $('library-list').onclick=event=>{const remove=event.target.closest('[data-delete]');if(remove){
    const item=library.find(item=>item.id===remove.dataset.delete);if(!item)return;
    deleteTarget={...item};$('delete-sop-title').textContent=item.title;$('delete-sop-confirmation').value='';$('delete-sop-error').textContent='';$('confirm-delete-sop').disabled=true;
    $('delete-sop-dialog').showModal();$('delete-sop-confirmation').focus();return;
  }const view=event.target.closest('[data-view],[data-preview-link]');if(view&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&!event.altKey&&event.button===0){event.preventDefault();const opened=window.open(view.href,'_blank','popup,width=1000,height=900,resizable=yes,scrollbars=yes');if(opened)opened.opener=null;else $('library-status').textContent='Allow pop-ups to view the SOP in a new window, or open the View SOP link in a new tab.';return;}const tag=event.target.closest('[data-filter-tag]');if(tag){$('library-tag').value=tag.dataset.filterTag;render();}};
  $('delete-sop-confirmation').oninput=()=>{$('confirm-delete-sop').disabled=deleting||$('delete-sop-confirmation').value!=='DELETE';};
  $('cancel-delete-sop').onclick=()=>{if(!deleting)$('delete-sop-dialog').close();};
  $('delete-sop-dialog').addEventListener('cancel',event=>{if(deleting)event.preventDefault();});
  $('delete-sop-dialog').addEventListener('close',()=>{if(!$('delete-sop-dialog').open)deleteTarget=null;});
  $('delete-sop-form').onsubmit=async event=>{
    event.preventDefault();if(deleting||!deleteTarget||$('delete-sop-confirmation').value!=='DELETE')return;
    const target=deleteTarget;deleting=true;$('confirm-delete-sop').disabled=true;$('cancel-delete-sop').disabled=true;$('delete-sop-confirmation').disabled=true;$('delete-sop-error').textContent='';
    try{
      const response=await fetch('/api/sops/'+encodeURIComponent(target.id),{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirmation:'DELETE',title:target.title,updatedAt:target.updatedAt})});
      if(!response.ok){const error=await response.json().catch(()=>({}));throw Error(error.error||'Unable to delete this SOP. Please try again.');}
      library=library.filter(item=>item.id!==target.id);render();$('delete-sop-dialog').close();$('library-status').textContent='Deleted SOP: '+target.title;$('library-search').focus();
    }catch(error){$('delete-sop-error').textContent=error.message;}
    finally{deleting=false;$('cancel-delete-sop').disabled=false;$('delete-sop-confirmation').disabled=false;$('confirm-delete-sop').disabled=$('delete-sop-confirmation').value!=='DELETE';}
  };
  window.addEventListener('pageshow',event=>{if(event.persisted)load();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!$('delete-sop-dialog').open)load();});
  load();
})();
