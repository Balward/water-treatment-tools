(function(root){
'use strict';
const packs = typeof module === 'object' && module.exports ? require('./pack-sizes') : root.InventoryPackSizes;
const day = date => Date.parse(date + 'T00:00:00Z') / 86400000;
function identity(raw) {
  const item = packs.normalize(raw);
  return JSON.stringify([item.id,item.description,item.itemNumber,item.countSize,item.caseSize].map(value=>String(value || '').trim().toLowerCase()));
}
function series(item, records, from = '0001-01-01', through = '9999-12-31') {
  const dates = new Map(); let incompatible = 0;
  for (const record of records.filter(r=>r.worksheet==='operating' && r.status==='complete' && r.date>=from && r.date<=through).sort((a,b)=>String(a.updatedAt||a.id).localeCompare(String(b.updatedAt||b.id)))) {
    const snapshot = record.items.find(i=>i.id===item.id), count = record.counts[item.id];
    if (!snapshot || typeof count!=='number' || !Number.isFinite(count) || count<0) continue;
    if (identity(snapshot)!==identity(item)) { incompatible++; continue; }
    dates.set(record.date,{date:record.date,count,par:snapshot.par,inventoryId:record.id,operator:record.operator});
  }
  return {points:[...dates.values()].sort((a,b)=>a.date.localeCompare(b.date)),incompatible};
}
function review(points, {lead=7, interval=7, buffer=50, increment=1}={}) {
  if (![lead,interval,buffer,increment].every(Number.isFinite) || lead<0 || interval<=0 || buffer<0 || increment<=0) throw new Error('Enter valid planning values.');
  let decline=0, days=0, intervals=0, increases=0, longGaps=0, zeros=0;
  for(let i=1;i<points.length;i++) {
    const before=points[i-1], after=points[i], gap=day(after.date)-day(before.date);
    if(gap<=0) continue;
    if(after.count===0) zeros++;
    if(after.count>before.count) { increases++; continue; }
    if(gap>45) { longGaps++; continue; }
    decline+=before.count-after.count; days+=gap; intervals++;
  }
  const span=points.length>1 ? day(points.at(-1).date)-day(points[0].date) : 0;
  const ready=intervals>=3 && days>=21 && span>=28 && decline>0;
  const rate=days ? decline/days : null;
  const suggested=ready ? Math.ceil((rate*(lead+interval)*(1+buffer/100)-1e-10)/increment)*increment : null;
  return {ready,rate,suggested,decline,days,intervals,increases,longGaps,zeros,span};
}
const api={series,review,identity};
if(typeof module==='object' && module.exports) module.exports=api; else root.SupplyTrendMath=api;
})(typeof globalThis!=='undefined'?globalThis:this);
