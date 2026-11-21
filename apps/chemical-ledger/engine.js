(function(root){
  'use strict';
  const chemicals=[
    {id:'permanganate',name:'Sodium permanganate',unit:'lb',price:1.64,color:'#8055bb'},
    {id:'hydroxide',name:'Sodium hydroxide',unit:'active lb',price:.36,color:'#357b9e'},
    {id:'hypochlorite',name:'Sodium hypochlorite',unit:'gal',price:2.56,color:'#b47b18'},
    {id:'polymer',name:'Catfloc 8103+ Polymer',unit:'lb',price:2.34,color:'#278c7a'},
    {id:'alum',name:'Aluminum sulfate',unit:'dry US ton',price:661,color:'#5b6e9b'}
  ];
  function initial(){return {version:1,chemicals:chemicals.map(c=>({...c})),deliveries:[],usage:[],plans:{},history:{}};}
  function migrateState(s){
    const next=structuredClone(s),alum=Array.isArray(next?.chemicals)?next.chemicals.find(c=>c?.id==='alum'):null;
    if(alum?.unit==='dry lb'){alum.unit='dry US ton';next.alumUnitCorrected=true;}
    const polymer=Array.isArray(next?.chemicals)?next.chemicals.find(c=>c?.id==='polymer'):null;
    if(polymer?.name==='Polymer')polymer.name='Catfloc 8103+ Polymer';
    return next;
  }
  const cents=n=>Math.round((n+Number.EPSILON)*100)/100;
  function deliveryCost(r){
    const chemical=cents(r.quantity*r.price),superfundTax=r.superfundTax??0,energySurcharge=r.energySurcharge??0;
    return {chemical,superfundTax,energySurcharge,total:cents(chemical+superfundTax+energySurcharge)};
  }
  const day=86400000,stamp=d=>Date.parse(d+'T00:00:00Z');
  function totals(state,year,asOf){return state.chemicals.map(c=>{
    const d=state.deliveries.filter(r=>r.chemical===c.id&&r.date.startsWith(year+'-')&&(!asOf||r.date<=asOf));
    const received=d.reduce((sum,r)=>sum+r.quantity,0),chemicalSubtotal=cents(d.reduce((sum,r)=>sum+deliveryCost(r).chemical,0));
    return {...c,deliveries:d.length,received,chemicalSubtotal,superfundTax:cents(d.reduce((sum,r)=>sum+(r.superfundTax??0),0)),energySurcharge:cents(d.reduce((sum,r)=>sum+(r.energySurcharge??0),0)),spend:cents(d.reduce((sum,r)=>sum+deliveryCost(r).total,0)),averagePrice:received?chemicalSubtotal/received:null};
  });}
  function validState(s){
    const ids=chemicals.map(c=>c.id),finite=(n)=>typeof n==='number'&&Number.isFinite(n),date=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&!isNaN(Date.parse(x))&&new Date(x).toISOString().slice(0,10)===x;
    if(!s||!Array.isArray(s.deliveries)||s.deliveries.some(r=>!r||!['superfundTax','energySurcharge'].every(f=>r[f]===undefined||(finite(r[f])&&r[f]>=0))||!finite(deliveryCost(r).total)))return false;
    if(s.deliveries.some(r=>r.receivedQuantity!==undefined&&(!finite(r.receivedQuantity)||r.receivedQuantity<=0||!['gal','lb'].includes(r.receivedUnit)||!date(r.receivedDate)||!['unknown','before','after'].includes(r.countTiming))))return false;
    if(!Array.isArray(s.usage)||s.usage.some(r=>!r||(r.periodStart!==undefined||r.periodEnd!==undefined)&&(!date(r.periodStart)||!date(r.periodEnd)||r.periodStart>=r.periodEnd||r.date!==r.periodEnd)||r.source&&(!['active','stale'].includes(r.source.status)||r.source.type!=='inventory'||!date(r.source.start)||!date(r.source.end)||r.source.end!==r.date||!(r.source.days>0)||r.source.days!==(stamp(r.source.end)-stamp(r.source.start))/day||typeof r.source.profileVersion!=='string'||typeof r.source.fingerprint!=='string'||!/^[a-f0-9]{64}$/.test(r.source.fingerprint)||!finite(r.source.rawGallons)||r.source.rawGallons<0)))return false;
    return s&&s.version===1&&Array.isArray(s.chemicals)&&s.chemicals.length===5&&ids.every(id=>s.chemicals.filter(c=>c.id===id).length===1)&&s.chemicals.every(c=>finite(c.price)&&c.price>=0&&c.name===chemicals.find(x=>x.id===c.id).name&&c.unit===chemicals.find(x=>x.id===c.id).unit)&&['deliveries','usage'].every(k=>Array.isArray(s[k])&&new Set(s[k].map(r=>r.id)).size===s[k].length&&s[k].every(r=>typeof r.id==='string'&&ids.includes(r.chemical)&&date(r.date)&&finite(r.quantity)&&(k==='usage'?r.quantity>=0:r.quantity>0)&&(k==='usage'||(finite(r.price)&&r.price>=0))&&['notes','reference','supplier'].every(f=>r[f]===undefined||typeof r[f]==='string')))&&s.plans&&typeof s.plans==='object'&&!Array.isArray(s.plans)&&Object.entries(s.plans).every(([key,p])=>/^\d{4}-(permanganate|hydroxide|hypochlorite|polymer|alum)$/.test(key)&&p&&['months','growth','reserve','opening','price','escalation'].every(f=>finite(p[f]))&&p.months>0&&p.months<=12&&p.growth>=-100&&p.escalation>=-100&&p.reserve>=0&&p.opening>=0&&p.price>=0);
  }
  const api={initial,migrateState,totals,validState,deliveryCost};root.Ledger=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
