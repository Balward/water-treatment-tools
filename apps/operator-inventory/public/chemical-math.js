/* Weekly Chemical Inventory, 2026 sheet, October 21 (row 45).
   Shared by browser and server so saved and preview calculations agree. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./chemical-settings'));else root.ChemicalInventory=factory(root.ChemicalSettings);})(typeof globalThis!=='undefined'?globalThis:this,function(settings){
  'use strict';
  const chemicals=[
    {id:'naoh',name:'Sodium Hydroxide',fields:[['naohEast','East Tank','in'],['naohCentral','Central Tank','in'],['naohWest','West Tank','in']],formula:'(East + Central + West) × 13.66 + 450',volume:r=>(r.naohEast+r.naohCentral+r.naohWest)*13.66+450},
    {id:'hypochlorite',name:'Sodium Hypochlorite',fields:[['hypoEast','East Tank','in'],['hypoWest','West Tank','in']],formula:'(East + West) × 27.5325 + 650',volume:r=>(r.hypoEast+r.hypoWest)*27.5325+650},
    {id:'alum',name:'Aluminum Sulfate',fields:[['alumEast','East Tank','in'],['alumNorth','North Tank','in'],['alumSouth','South Tank','in'],['alumWest','West Tank','in']],formula:'East ÷ 12 × 805.40032 + (North + South + West) × 13.66',volume:r=>r.alumEast/12*805.40032+(r.alumNorth+r.alumSouth+r.alumWest)*13.66},
    {id:'polymer',name:'Polymer (8103+)',fields:[['polymerTank','Tank Level','in'],['polymerInventory','Stored Inventory','gal']],formula:'Tank × 5.61 + Stored Inventory',volume:r=>r.polymerTank*5.61+r.polymerInventory},
    {id:'permanganate',name:'Sodium Permanganate (20%)',fields:[['permEast','East Tank (10% Batch)','in'],['permWest','West Tank (20%)','in'],['permInventory','Stored Inventory (20%)','gal']],required:['permWest','permInventory'],formula:'West Tank × 7.143 + Stored Inventory',note:'East contains the diluted 10% batch. Its level is monitored for batching, but is excluded from the 20% inventory.',volume:r=>r.permWest*7.143+r.permInventory}
  ];
  const fields=[...chemicals.flatMap(c=>c.fields),['salt','Salt Inventory','pallets'],['nwos','Northwest Open Space Meter','1,000 gal']];
  const present=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
  function volume(chemical,readings){return(chemical.required||chemical.fields.map(f=>f[0])).every(key=>present(readings[key]))?chemical.volume(readings):null;}
  function calculate(records){
    const sorted=[...records].sort((a,b)=>a.date.localeCompare(b.date));
    return sorted.map((record,index)=>{
      const earlier=sorted.slice(0,index);
      const totals=Object.fromEntries(chemicals.map(c=>[c.id,{gallons:record.recordedGallons ? record.recordedGallons[c.id]??null : record.settingsSnapshot?settings.volume(record.settingsSnapshot[c.id],record.readings):volume(c,record.readings)}]));
      const previous=[...earlier].reverse().find(r=>(r.status||'complete')==='complete'&&present(r.readings.nwos));
      const nwosUsed=Object.hasOwn(record,'recordedWaterUsed')?record.recordedWaterUsed:present(record.readings.nwos)&&previous?(record.readings.nwos-previous.readings.nwos)*1000:null;
      return{...record,totals,nwosUsed,nwosPreviousDate:Object.hasOwn(record,'recordedWaterPreviousDate')?record.recordedWaterPreviousDate:previous?.date||null,nwosReset:nwosUsed!==null&&nwosUsed<0};
    }).reverse();
  }
  return{chemicals,fields,volume,calculate,formulaVersion:'2026-10-21'};
});
