(() => {
  'use strict';
  // Keep one catalog for navigation and Operations Home. All pages use local assets.
  const categories=[['operations','Daily Operations'],['water','Water Treatment'],['wastewater','Wastewater Treatment'],['training','Training & Certification']].map(([id,label])=>({id,label}));
  const applications=[
    {id:'rounds',category:'operations',name:'Plant Rounds',description:'Record AM and PM checks, compare readings, and share daily handoff notes.',icon:'board',path:'/plant-rounds/'},
    {id:'equipment',category:'operations',name:'Equipment Status Board',description:'Check equipment availability and share operating notes.',icon:'board',path:'/live-operations-dashboard/'},
    {id:'inventory',category:'operations',name:'Supply Inventory',description:'Count supplies, check PAR levels, and manage your order list.',icon:'box',external:'https://inventory.gibbhub.io/'},
    {id:'robojar',category:'water',name:'RoboJar Analyzer',description:'Compare jar-test results and review coagulant performance.',icon:'jar',path:'/robojar-analyzer/?v=20261022-robo1'},
    {id:'hypo',category:'water',name:'Sodium Hypochlorite Calculator',description:'Calculate chlorine dose and chemical feed requirements.',icon:'water',path:'/sodium-hypochlorite-calculator/?v=20261022-hypo1'},
    {id:'permanganate',category:'water',name:'Permanganate Dose Predictor',description:'Explore dose estimates using historical plant data.',icon:'dose',path:'/dose-predictor/?v=20261022-dose1'},
    {id:'alum',category:'water',name:'Alum Hydrometer Conversion',description:'Correct density readings and estimate dry alum strength.',icon:'meter',path:'/alum-hydrometer-conversion/'},
    {id:'explorer',category:'water',name:'Water Data Explorer',description:'Find trends and correlations in your water-quality data.',icon:'chart',path:'/water-data-explorer/?v=20261022-explorer1'},
    {id:'detention',category:'water',name:'Detention Time',description:'Follow flow through the plant and compare basin detention times.',icon:'flow',path:'/plant-flow/?v=20261022-plant1'},
    {id:'mwat',category:'wastewater',name:'MWAT & DM Calculator',description:'Review temperature records and calculate weekly averages.',icon:'thermometer',path:'/mwat-calculator/'},
    {id:'loading',category:'wastewater',name:'NH3 Loading Insight',description:'Compare loading patterns and identify peak hours.',icon:'chart',path:'/nh4-loading/'},
    {id:'reg100',category:'training',name:'Regulation 100 Study Guide',description:'Review chaptered material for operator certification.',icon:'book',path:'/regulation-100-study/?v=20261022-reg100-2'},
    {id:'videos',category:'training',name:'Class A Training Videos',description:'Watch lessons and refresh your treatment knowledge.',icon:'video',path:'/video-tutorials/?v=20261022-videos1'},
    {id:'flashcards',category:'training',name:'Water Treatment Flashcards',description:'Practice key terms, formulas, and treatment concepts.',icon:'cards',path:'/water-treatment-flashcards/?v=20261022-study1'}
  ];
  const host=document.body.dataset.opsApp || 'home';
  // Public subdomains may point at a standalone app; the directory lives on water.
  const suiteOrigin=host==='inventory'||/\.gibbhub\.io$/i.test(location.hostname)?'https://water.gibbhub.io':location.origin;
  const href=app=>app.external || new URL(app.path,suiteOrigin).href;
  // A distinct URL bypasses legacy HTML cached before Operations Home existed.
  const homeHref=new URL('/?v=operations-home-20261021',suiteOrigin).href;
  window.Operations=Object.freeze({applications:Object.freeze(applications.map(Object.freeze)),categories:Object.freeze(categories.map(Object.freeze)),href,homeHref});
  const homeLinks=[...document.querySelectorAll('.site-header .brand,.ops-home-link')];
  homeLinks.forEach(link=>{link.href=homeHref;link.dataset.opsHome='';link.setAttribute('aria-label','Operations Home');});
  const buttons=[...document.querySelectorAll('[data-ops-menu]')];
  if(!buttons.length)return;
  const menu=document.createElement('dialog');menu.id='opsAppMenu';menu.className='ops-app-menu';menu.setAttribute('aria-labelledby','opsAppMenuTitle');
  menu.innerHTML='<header class="ops-app-menu-header"><div><h2 id="opsAppMenuTitle" class="ops-app-menu-title">Switch Applications</h2></div><button class="ops-app-menu-close" type="button" aria-label="Close Applications Menu" autofocus><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header><nav class="ops-app-menu-links" aria-label="Navigate Between Applications"></nav><footer class="ops-app-menu-footer">One Workspace. All Your Operations Tools.</footer>';
  const links=menu.querySelector('nav');
  function addLink(parent,name,url,id,className=''){
    const link=document.createElement('a');link.href=url;link.textContent=name;link.className=className;link.dataset.opsDestination=id;
    if(id===host){link.setAttribute('aria-current','page');const badge=document.createElement('small');badge.className='ops-app-menu-current';badge.textContent='Current Page';link.append(badge);}
    parent.append(link);
  }
  addLink(links,'Operations Home',homeHref,'home','ops-app-menu-home');
  addLink(links,'User Management',new URL('/operations-management/',suiteOrigin).href,'management','ops-app-menu-home');
  addLink(links,'Application Review',new URL('/application-review/',suiteOrigin).href,'applications','ops-app-menu-home');
  categories.forEach(category=>{const section=document.createElement('section');section.className='ops-app-menu-group';const heading=document.createElement('h3');heading.textContent=category.label;section.append(heading);applications.filter(app=>app.category===category.id).forEach(app=>addLink(section,app.name,href(app),app.id));links.append(section);});
  document.body.append(menu);
  let opener=null,leaving=false;
  buttons.forEach(button=>{
    button.classList.add('ops-apps-button');button.type='button';button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls',menu.id);button.setAttribute('aria-expanded','false');
    button.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg><span>Apps</span>';
    button.addEventListener('click',()=>{if(document.querySelector('dialog[open]'))return;opener=button;menu.showModal();button.setAttribute('aria-expanded','true');document.body.classList.add('ops-app-menu-open');});
  });
  menu.querySelector('button').addEventListener('click',()=>menu.close());
  menu.addEventListener('close',()=>{buttons.forEach(button=>button.setAttribute('aria-expanded','false'));document.body.classList.remove('ops-app-menu-open');opener?.focus({preventScroll:true});});
  menu.addEventListener('click',event=>{const box=menu.getBoundingClientRect();if(event.target===menu&&(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom))menu.close();});
  menu.addEventListener('keydown',event=>{if(event.key!=='Tab')return;const controls=[...menu.querySelectorAll('button,a[href]')],first=controls[0],last=controls[controls.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}});
  // Hosts may wait for saving or cancel navigation; no app data lives in this layer.
  async function navigateLink(event){
    const link=event.target.closest('a');if(!link||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
    event.preventDefault();if(leaving)return;if(menu.open)menu.close();if((homeLinks.includes(link)?'home':link.dataset.opsDestination)===host){if(homeLinks.includes(link))window.scrollTo({top:0,left:0});return;}
    const waits=[];const request=new CustomEvent('operations:before-navigate',{cancelable:true,detail:{url:link.href,waitUntil:promise=>waits.push(Promise.resolve(promise))}});
    leaving=true;
    try {if(!document.dispatchEvent(request))return;const decisions=await Promise.all(waits);if(decisions.some(value=>value===false))return;location.assign(link.href);}
    catch(error){console.error('Application navigation was cancelled:',error);}
    finally{leaving=false;}
  }
  links.addEventListener('click',navigateLink);
  homeLinks.forEach(link=>link.addEventListener('click',navigateLink));
})();
