(() => {
  'use strict';
  const $=id=>document.getElementById(id),model=SOPModel;
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let library=[],loading=false;
  $('library-tag').innerHTML='<option value="">All Tags</option><option value="__untagged">Untagged</option>'+model.tagGroups.map(group=>'<optgroup label="'+escape(group.label)+'">'+group.tags.map(tag=>'<option value="'+escape(tag)+'">'+escape(tag)+'</option>').join('')+'</optgroup>').join('');
  const query=new URLSearchParams(location.search);
  $('library-search').value=query.get('q')||'';
  if(model.tags.includes(query.get('tag'))||query.get('tag')==='__untagged')$('library-tag').value=query.get('tag');
  if(['saved','title','tags','revised'].includes(query.get('sort')))$('library-sort').value=query.get('sort');
  function render(){
    const search=$('library-search').value.trim().toLowerCase(),tag=$('library-tag').value,sort=$('library-sort').value;
    const matches=library.filter(item=>[item.title,item.team,...(item.tags||[])].some(value=>String(value||'').toLowerCase().includes(search))&&(!tag||(tag==='__untagged'?!(item.tags||[]).length:(item.tags||[]).includes(tag))));
    const title=(a,b)=>a.title.localeCompare(b.title);
    matches.sort((a,b)=>sort==='title'?title(a,b):sort==='tags'?(a.tags||[]).slice().sort().join(', ').localeCompare((b.tags||[]).slice().sort().join(', '))||title(a,b):sort==='revised'?(b.revisedDate||'').localeCompare(a.revisedDate||'')||title(a,b):b.updatedAt.localeCompare(a.updatedAt)||title(a,b));
    $('library-count').textContent=matches.length+' of '+library.length+' SOPs';
    $('library-list').innerHTML=matches.length?matches.map(item=>'<article class="library-card"><div class="library-card-content"><h2>'+escape(item.title)+'</h2><p>'+escape([item.team,item.revisedDate?'Revised '+item.revisedDate:''].filter(Boolean).join(' · '))+'</p><div class="sop-tags">'+(item.tags||[]).map(tag=>'<button type="button" data-filter-tag="'+escape(tag)+'" aria-label="Filter SOPs By '+escape(tag)+'">'+escape(tag)+'</button>').join('')+'</div><small>Saved '+escape(new Date(item.updatedAt).toLocaleString())+'</small></div><a class="library-link" data-open="'+escape(item.id)+'" href="./?'+new URLSearchParams({sop:item.id})+'">Open SOP →</a></article>').join(''):'<div class="library-empty"><h2>'+ (library.length?'No Matching SOPs':'No Saved SOPs Yet')+'</h2><p>'+(library.length?'Try another search or clear the tag filter.':'Create a procedure and save it to see it here.')+'</p></div>';
    const url=new URL(location.href);url.search='';if(search)url.searchParams.set('q',$('library-search').value.trim());if(tag)url.searchParams.set('tag',tag);if(sort!=='saved')url.searchParams.set('sort',sort);history.replaceState(null,'',url);
  }
  async function load(){
    if(loading)return;loading=true;$('refresh-library').disabled=true;$('library-status').textContent='Loading SOPs…';
    try{const response=await fetch('/api/sops',{cache:'no-store'});if(!response.ok)throw Error('Unable to load your SOPs. Choose Refresh to try again.');const records=await response.json();if(!Array.isArray(records))throw Error('The SOP library response was unavailable. Choose Refresh to try again.');library=records;render();$('library-status').textContent='';}
    catch(error){$('library-status').textContent=error.message;}
    finally{loading=false;$('refresh-library').disabled=false;}
  }
  $('library-search').oninput=render;$('library-tag').onchange=render;$('library-sort').onchange=render;
  $('clear-library-filters').onclick=()=>{$('library-search').value='';$('library-tag').value='';render();};
  $('refresh-library').onclick=load;
  $('library-list').onclick=event=>{const tag=event.target.closest('[data-filter-tag]');if(tag){$('library-tag').value=tag.dataset.filterTag;render();}};
  window.addEventListener('pageshow',event=>{if(event.persisted)load();});
  load();
})();
