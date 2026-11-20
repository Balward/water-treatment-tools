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
  function totals(state,year,asOf){return state.chemicals.map(c=>{
    const inPeriod=r=>r.chemical===c.id&&r.date.startsWith(year+'-')&&(!asOf||r.date<=asOf);
    const d=state.deliveries.filter(inPeriod),u=state.usage.filter(inPeriod);
    return {...c,deliveries:d.length,received:d.reduce((s,r)=>s+r.quantity,0),spend:cents(d.reduce((s,r)=>s+deliveryCost(r).total,0)),used:u.reduce((s,r)=>s+r.quantity,0),usageEntries:u.length};
  });}
  function forecast(used,p){
    const annual=used*12/p.months;
    const demand=annual*(1+p.growth/100);
    const quantity=Math.max(0,demand+p.reserve-p.opening);
    const price=p.price*(1+p.escalation/100);
    return {annual,demand,quantity,price,cost:quantity*price};
  }
  function weighted(state,chemical,year){
    const entries=[];
    const years=[...new Set(state.usage.filter(r=>r.chemical===chemical&&Number(r.date.slice(0,4))<=year).map(r=>Number(r.date.slice(0,4))))].sort((a,b)=>b-a);
    for(const y of years){const h=state.history?.[y]||{months:12,weight:y===year?3:y===year-1?2:y===year-2?1:0};const used=state.usage.filter(r=>r.chemical===chemical&&r.date.startsWith(y+'-')).reduce((s,r)=>s+r.quantity,0);entries.push({year:y,used,months:h.months,weight:h.weight,annual:used*12/h.months});}
    const weight=entries.reduce((s,r)=>s+r.weight,0);return {entries,annual:weight?entries.reduce((s,r)=>s+r.annual*r.weight,0)/weight:null};
  }
  function validState(s){
    const ids=chemicals.map(c=>c.id),finite=(n)=>typeof n==='number'&&Number.isFinite(n),date=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&!isNaN(Date.parse(x))&&new Date(x).toISOString().slice(0,10)===x;
    if(!s||!Array.isArray(s.deliveries)||s.deliveries.some(r=>!r||!['superfundTax','energySurcharge'].every(f=>r[f]===undefined||(finite(r[f])&&r[f]>=0))||!finite(deliveryCost(r).total)))return false;
    return s&&s.version===1&&Array.isArray(s.chemicals)&&s.chemicals.length===5&&ids.every(id=>s.chemicals.filter(c=>c.id===id).length===1)&&s.chemicals.every(c=>finite(c.price)&&c.price>=0&&c.name===chemicals.find(x=>x.id===c.id).name&&c.unit===chemicals.find(x=>x.id===c.id).unit)&&['deliveries','usage'].every(k=>Array.isArray(s[k])&&new Set(s[k].map(r=>r.id)).size===s[k].length&&s[k].every(r=>typeof r.id==='string'&&ids.includes(r.chemical)&&date(r.date)&&finite(r.quantity)&&r.quantity>0&&(k==='usage'||(finite(r.price)&&r.price>=0))&&['notes','reference','supplier'].every(f=>r[f]===undefined||typeof r[f]==='string')))&&s.plans&&typeof s.plans==='object'&&!Array.isArray(s.plans)&&Object.entries(s.plans).every(([key,p])=>/^\d{4}-(permanganate|hydroxide|hypochlorite|polymer|alum)$/.test(key)&&p&&['months','growth','reserve','opening','price','escalation'].every(f=>finite(p[f]))&&p.months>0&&p.months<=12&&p.growth>=-100&&p.escalation>=-100&&p.reserve>=0&&p.opening>=0&&p.price>=0);
  }
  const api={initial,migrateState,totals,forecast,weighted,validState,deliveryCost};root.Ledger=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
