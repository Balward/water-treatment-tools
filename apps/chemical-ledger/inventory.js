(function(root){
 'use strict';
 const day=86400000,stamp=d=>Date.parse(d+'T00:00:00Z'),number=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
 const profiles={
  permanganate:{stockKey:'permanganate',version:'perm-2550lb-265gal-20261120',billingPerGallon:2550/265,productLbPerGallon:2550/265,estimated:false,description:'2,550 lb / 265 filled gal. Purchased 20% stock only; East 10% batch excluded.'},
  hydroxide:{stockKey:'naoh',version:'caustic-pending',billingPerGallon:null,productLbPerGallon:null,estimated:false,description:'Pending: clarify caustic assay and active pounds per gallon.'},
  hypochlorite:{stockKey:'hypochlorite',version:'hypo-gallons-20261120',billingPerGallon:1,productLbPerGallon:1.18*8.34,estimated:false,description:'Gallon billing. Weight receipts use example invoice SG 1.1800 × 8.34 lb/gal; enter measured gallons when available.'},
  polymer:{stockKey:'polymer',version:'catfloc-2295lb-265gal-20261120',billingPerGallon:2295/265,productLbPerGallon:2295/265,estimated:false,description:'2,295 lb / 265 filled gal, using the example Catfloc invoice and confirmed tote fill.'},
  alum:{stockKey:'alum',version:'alum-sg1327-dry482-20261120',billingPerGallon:1.327*8.34*.482/2000,productLbPerGallon:1.327*8.34,estimated:true,description:'Estimate: SG 1.327 × 8.34 lb/gal × 48.2% dry alum / 2,000. Actual invoice dry tons remain unchanged.'}
 };
 function build(state,records,hash=value=>value){
  const ordered=records.filter(r=>r.status==='complete').sort((a,b)=>a.date.localeCompare(b.date)),rows=[];
  for(let i=1;i<ordered.length;i++)for(const c of state.chemicals){
   const a=ordered[i-1],b=ordered[i],p=profiles[c.id],begin=a.gallons[p.stockKey],end=b.gallons[p.stockKey],days=(stamp(b.date)-stamp(a.date))/day;
   const row={id:`inventory-${c.id}-${a.date}-${b.date}`,chemical:c.id,start:a.date,end:b.date,days,beginning:begin,ending:end,received:0,rawGallons:null,quantity:null,unit:c.unit,profile:p,receipts:[],blockers:[],warnings:[]};
   if(!number(begin)||!number(end))row.blockers.push('A stock reading is missing.');
   if(!(days>0))row.blockers.push('Inventory dates are not in increasing order.');
   if(p.billingPerGallon===null)row.blockers.push('Conversion factor needs confirmation.');
   if(new Date(stamp(a.date)).getUTCDay()!==3||new Date(stamp(b.date)).getUTCDay()!==3)row.warnings.push('One inventory date is not Wednesday. Review the recorded dates.');
   if(days!==7)row.warnings.push(`This interval covers ${days} actual days.`);
   if(p.estimated)row.warnings.push('Alum conversion is an estimate using the supplied approximate SG and dry fraction.');
   for(const r of state.deliveries.filter(r=>r.chemical===c.id)){
    const date=r.receivedDate||r.date;if(date<a.date||date>b.date)continue;
    const boundary=date===a.date||date===b.date,timing=r.countTiming||'unknown';
    if(boundary&&timing==='unknown')row.blockers.push('A delivery on an inventory date needs before/after-count timing.');
    if(boundary&&((date===a.date&&timing==='before')||(date===b.date&&timing==='after')))continue;
    const gallons=r.receivedUnit==='gal'?r.receivedQuantity:r.receivedUnit==='lb'&&p.productLbPerGallon?r.receivedQuantity/p.productLbPerGallon:null;
    const receipt={id:r.id,date,quantity:r.receivedQuantity??null,unit:r.receivedUnit||'',timing,gallons:number(gallons)?gallons:null,reference:r.reference||''};row.receipts.push(receipt);
    if(!r.receivedDate||!number(gallons)||gallons<=0)row.blockers.push('A delivery needs physical received quantity, unit, and actual receiving date.');else row.received+=gallons;
   }
   if(number(begin)&&number(end)){row.rawGallons=begin+row.received-end;if(row.rawGallons<-.000001)row.blockers.push('The balance is negative. Check receipts, readings, or stock adjustments.');else if(p.billingPerGallon!==null)row.quantity=Math.max(0,row.rawGallons)*p.billingPerGallon;}
   for(const u of state.usage.filter(u=>!u.source&&u.chemical===c.id)){
    const overlap=u.periodStart&&u.periodEnd?u.periodStart<b.date&&u.periodEnd>a.date:[a.date.slice(0,4),b.date.slice(0,4)].includes(u.date.slice(0,4));
    if(overlap)row.blockers.push(u.periodStart?'Manual usage overlaps this interval. Remove or correct the overlap first.':'Manual usage in this year needs coverage dates before inventory usage can be approved.');
   }
   row.receipts.sort((a,b)=>a.id.localeCompare(b.id));
   row.fingerprint=hash(JSON.stringify({a,b,receipts:row.receipts,profile:p}));
   row.blockers=[...new Set(row.blockers)];
   const saved=state.usage.find(u=>u.id===row.id&&u.source);
   row.approved=!!saved&&saved.source.status==='active'&&saved.source.fingerprint===row.fingerprint;
   row.needsReview=!!saved&&!row.approved;row.ready=row.blockers.length===0&&number(row.quantity);rows.push(row);
  }
  return rows;
 }
 function reconcile(state,rows){
  const byId=new Map(rows.map(r=>[r.id,r]));let changed=false;
  const usage=state.usage.map(u=>{if(!u.source||u.source.status==='stale')return u;const r=byId.get(u.id);if(!r||r.fingerprint!==u.source.fingerprint||!r.ready){changed=true;return {...u,source:{...u.source,status:'stale'}};}return u;});
  return changed?{...state,usage}:state;
 }
 const api={profiles,build,reconcile};root.LedgerInventory=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
