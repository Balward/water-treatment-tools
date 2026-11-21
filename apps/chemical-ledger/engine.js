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
  function coveredDays(r,year){
    const start=r.source?.start||r.periodStart,end=r.source?.end||r.periodEnd;
    if(!start||!end)return 0;
    return Math.max(0,Math.min(stamp(end),Date.UTC(year+1,0,1))-Math.max(stamp(start),Date.UTC(year,0,1)))/day;
  }
  function usageInYear(r,year,asOf){
    if(asOf&&r.date>asOf)return 0;
    if(r.source||r.periodStart){if(r.source&&r.source.status!=='active')return 0;return r.quantity*coveredDays(r,year)/(r.source?.days||((stamp(r.periodEnd)-stamp(r.periodStart))/day));}
    return r.date.startsWith(year+'-')?r.quantity:0;
  }
  function totals(state,year,asOf){return state.chemicals.map(c=>{
    const inPeriod=r=>r.chemical===c.id&&r.date.startsWith(year+'-')&&(!asOf||r.date<=asOf);
    const d=state.deliveries.filter(inPeriod),u=state.usage.filter(r=>r.chemical===c.id&&(!asOf||r.date<=asOf)&&(!r.source||r.source.status==='active')&&(r.source||r.periodStart?coveredDays(r,year)>0:r.date.startsWith(year+'-')));
    return {...c,deliveries:d.length,received:d.reduce((s,r)=>s+r.quantity,0),spend:cents(d.reduce((s,r)=>s+deliveryCost(r).total,0)),used:u.reduce((s,r)=>s+usageInYear(r,year,asOf),0),usageEntries:u.length};
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
    const records=state.usage.filter(r=>r.chemical===chemical&&(!r.source||r.source.status==='active')),yearSet=new Set();
    for(const r of records){const from=Number((r.source?.start||r.periodStart||r.date).slice(0,4)),through=Math.min(year,Number(r.date.slice(0,4)));for(let y=from;y<=through;y++)if(r.source||r.periodStart?coveredDays(r,y)>0:r.date.startsWith(y+'-'))yearSet.add(y);}
    const years=[...yearSet].sort((a,b)=>b-a);
    for(const y of years){
      const h=state.history?.[y]||{months:12,weight:y===year?3:y===year-1?2:y===year-2?1:0},rows=records.filter(r=>r.source||r.periodStart?coveredDays(r,y)>0:r.date.startsWith(y+'-')),used=rows.reduce((s,r)=>s+usageInYear(r,y),0);let months=h.months,coverageDays=null;
      if(rows.some(r=>r.source||r.periodStart)){
        const intervals=rows.map(r=>[Math.max(stamp(r.source?.start||r.periodStart||r.date),Date.UTC(y,0,1)),Math.min(stamp(r.source?.end||r.periodEnd||r.date),Date.UTC(y+1,0,1))]).filter(([a,b])=>b>a).sort((a,b)=>a[0]-b[0]);let end=0;coverageDays=0;
        for(const [a,b] of intervals){coverageDays+=Math.max(0,b-Math.max(a,end))/day;end=Math.max(end,b);}
        months=coverageDays*12/((Date.UTC(y+1,0,1)-Date.UTC(y,0,1))/day);
      }
      if(months>0)entries.push({year:y,used,months,coverageDays,weight:h.weight,annual:used*12/months});
    }
    const weight=entries.reduce((s,r)=>s+r.weight,0);return {entries,annual:weight?entries.reduce((s,r)=>s+r.annual*r.weight,0)/weight:null};
  }
  function validState(s){
    const ids=chemicals.map(c=>c.id),finite=(n)=>typeof n==='number'&&Number.isFinite(n),date=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&!isNaN(Date.parse(x))&&new Date(x).toISOString().slice(0,10)===x;
    if(!s||!Array.isArray(s.deliveries)||s.deliveries.some(r=>!r||!['superfundTax','energySurcharge'].every(f=>r[f]===undefined||(finite(r[f])&&r[f]>=0))||!finite(deliveryCost(r).total)))return false;
    if(s.deliveries.some(r=>r.receivedQuantity!==undefined&&(!finite(r.receivedQuantity)||r.receivedQuantity<=0||!['gal','lb'].includes(r.receivedUnit)||!date(r.receivedDate)||!['unknown','before','after'].includes(r.countTiming))))return false;
    if(!Array.isArray(s.usage)||s.usage.some(r=>!r||(r.periodStart!==undefined||r.periodEnd!==undefined)&&(!date(r.periodStart)||!date(r.periodEnd)||r.periodStart>=r.periodEnd||r.date!==r.periodEnd)||r.source&&(!['active','stale'].includes(r.source.status)||r.source.type!=='inventory'||!date(r.source.start)||!date(r.source.end)||r.source.end!==r.date||!(r.source.days>0)||r.source.days!==(stamp(r.source.end)-stamp(r.source.start))/day||typeof r.source.profileVersion!=='string'||typeof r.source.fingerprint!=='string'||!/^[a-f0-9]{64}$/.test(r.source.fingerprint)||!finite(r.source.rawGallons)||r.source.rawGallons<0)))return false;
    return s&&s.version===1&&Array.isArray(s.chemicals)&&s.chemicals.length===5&&ids.every(id=>s.chemicals.filter(c=>c.id===id).length===1)&&s.chemicals.every(c=>finite(c.price)&&c.price>=0&&c.name===chemicals.find(x=>x.id===c.id).name&&c.unit===chemicals.find(x=>x.id===c.id).unit)&&['deliveries','usage'].every(k=>Array.isArray(s[k])&&new Set(s[k].map(r=>r.id)).size===s[k].length&&s[k].every(r=>typeof r.id==='string'&&ids.includes(r.chemical)&&date(r.date)&&finite(r.quantity)&&(k==='usage'?r.quantity>=0:r.quantity>0)&&(k==='usage'||(finite(r.price)&&r.price>=0))&&['notes','reference','supplier'].every(f=>r[f]===undefined||typeof r[f]==='string')))&&s.plans&&typeof s.plans==='object'&&!Array.isArray(s.plans)&&Object.entries(s.plans).every(([key,p])=>/^\d{4}-(permanganate|hydroxide|hypochlorite|polymer|alum)$/.test(key)&&p&&['months','growth','reserve','opening','price','escalation'].every(f=>finite(p[f]))&&p.months>0&&p.months<=12&&p.growth>=-100&&p.escalation>=-100&&p.reserve>=0&&p.opening>=0&&p.price>=0);
  }
  const api={initial,migrateState,totals,forecast,weighted,validState,deliveryCost,usageInYear,coveredDays};root.Ledger=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
