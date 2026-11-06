'use strict';
// Retire pre-migration cached HTML once. The response clears cache only; saved
// preferences, inventory data, cookies, and local/session storage are untouched.
if(location.protocol==='https:'){
  const migrationKey='operations-home-cache-20261021';
  let repaired=false;
  try { repaired=localStorage.getItem(migrationKey)==='done'; } catch {}
  if(!repaired){
    fetch('/?repair=cache-20261021',{cache:'no-store'}).then(response=>{
      if(!response.ok)return;
      try { localStorage.setItem(migrationKey,'done'); } catch {}
    }).catch(()=>{ /* Versioned navigation still opens fresh HTML if this fails. */ });
  }
}
const svg = paths => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+paths+'</svg>';
const icons = {
  home:svg('<path d="m3 10 9-7 9 7v11h-6v-7H9v7H3z"/>'),
  board:svg('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 9v12M13 13h4M13 17h4M5 6h1M9 6h1"/>'),
  box:svg('<path d="m12 3 9 5v8l-9 5-9-5V8zM3 8l9 5 9-5M12 13v8M7.5 5.5l9 5"/>'),
  water:svg('<path d="M12 3S5 10 5 15a7 7 0 0 0 14 0c0-5-7-12-7-12Z"/><path d="M9 17a3 3 0 0 0 3 2"/>'),
  waves:svg('<path d="M3 7c3-4 6 4 9 0s6 4 9 0M3 12c3-4 6 4 9 0s6 4 9 0M3 17c3-4 6 4 9 0s6 4 9 0"/>'),
  book:svg('<path d="M12 5C8 2 4 3 2 4v15c4-2 7-1 10 1 3-2 6-3 10-1V4c-2-1-6-2-10 1ZM12 5v15"/>'),
  search:svg('<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>'),
  jar:svg('<path d="M5 3h14M7 3v5l-3 9a3 3 0 0 0 3 4h10a3 3 0 0 0 3-4l-3-9V3M6 14h12"/><path d="M9 17h.01M14 16h.01"/>'),
  dose:svg('<path d="M8 3h8M10 3v7l-6 9a1 1 0 0 0 1 2h14a1 1 0 0 0 1-2l-6-9V3M8 15h8"/>'),
  meter:svg('<path d="M8 3h8v18H8zM11 7h5M12 11h4M11 15h5M12 19h4"/>'),
  chart:svg('<path d="M3 3v18h18M7 16l4-5 4 2 5-7"/>'),
  flow:svg('<rect x="2" y="8" width="5" height="8" rx="1"/><rect x="17" y="8" width="5" height="8" rx="1"/><path d="M7 12h10M10 9l3 3-3 3M4 5v3M20 16v3"/>'),
  thermometer:svg('<path d="M9 14V5a3 3 0 0 1 6 0v9a5 5 0 1 1-6 0ZM12 8v9"/><circle cx="12" cy="18" r="1"/>'),
  clock:svg('<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>'),
  video:svg('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m10 8 6 4-6 4Z"/>'),
  cards:svg('<rect x="7" y="3" width="14" height="17" rx="2"/><path d="M4 7H3v14a1 1 0 0 0 1 1h12M11 8h6M11 12h4"/>')
};
const categoryStyle={operations:{nav:'Daily Operations',icon:'board',description:'Your everyday starting points.'},water:{nav:'Water Treatment',icon:'water'},wastewater:{nav:'Wastewater',icon:'waves'},training:{nav:'Training',icon:'book'}};
const categories=window.Operations.categories.map(category=>({...category,...categoryStyle[category.id]}));
const apps=window.Operations.applications.map(app=>({...app,href:window.Operations.href(app)}));
let activeCategory = 'all';
const nav = document.getElementById('categoryNav');
const search = document.getElementById('toolSearch');
[{id:'all',nav:'All Applications',icon:'home'},...categories].forEach(category=>{
  const button=document.createElement('button');button.type='button';button.className='nav-item';button.dataset.category=category.id;
  button.innerHTML='<span>'+icons[category.icon]+'</span><span>'+category.nav+'</span><span class="nav-count">'+apps.filter(app=>category.id==='all'||app.category===category.id).length+'</span>';
  button.setAttribute('aria-pressed',String(category.id===activeCategory));
  button.addEventListener('click',()=>{activeCategory=category.id;render();});nav.append(button);
});
document.querySelectorAll('[data-icon]').forEach(node=>node.innerHTML=icons[node.dataset.icon]);
function render(){
  const query=search.value.trim().toLowerCase();
  const matches=apps.filter(app=>(activeCategory==='all'||app.category===activeCategory)&&[app.name,app.description,categories.find(category=>category.id===app.category).label].join(' ').toLowerCase().includes(query));
  const directory=document.getElementById('directory');directory.replaceChildren();
  categories.forEach((category,index)=>{
    const items=matches.filter(app=>app.category===category.id);if(!items.length)return;
    const section=document.createElement('section');section.className='app-section category-'+category.id;section.setAttribute('aria-labelledby','heading-'+category.id);
    const heading=document.createElement('header');heading.className='section-heading';heading.innerHTML='<div><h2 id="heading-'+category.id+'">'+category.label+'</h2></div>'+(category.id==='operations'?'<p>'+category.description+'</p>':'<span class="section-index">'+String(index).padStart(2,'0')+'</span>');section.append(heading);
    const grid=document.createElement('div');grid.className='app-grid';
    items.forEach(app=>{
      const link=document.createElement('a');link.className='app-card';link.dataset.app=app.id;link.href=app.href;
      link.innerHTML='<div class="card-top"><span class="card-icon">'+icons[app.icon]+'</span><span class="card-arrow" aria-hidden="true">→</span></div><h3>'+app.name+'</h3><p>'+app.description+'</p>';
      if(app.id==='sops'){const banner=document.createElement('span');banner.className='construction-banner';banner.textContent='Under Construction';link.append(banner);}
      grid.append(link);
    });section.append(grid);directory.append(section);
  });
  document.querySelectorAll('[data-category]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.category===activeCategory)));
  document.getElementById('resultSummary').textContent=matches.length+(matches.length===1?' Application':' Applications')+(query||activeCategory!=='all'?' Found':'');
  document.getElementById('emptyState').hidden=matches.length>0;
  document.getElementById('resetFilters').hidden=!query&&activeCategory==='all';
}
function reset(){search.value='';activeCategory='all';render();}
search.addEventListener('input',render);
document.getElementById('resetFilters').addEventListener('click',reset);
document.getElementById('resetEmpty').addEventListener('click',()=>{reset();search.focus();});
document.addEventListener('keydown',event=>{if(document.getElementById("opsAppMenu")?.open)return;if(event.key==='/'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)){event.preventDefault();search.focus();}if(event.key==='Escape'&&document.activeElement===search){reset();}});
render();
