(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.ChemicalSettings=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const tank=(field,label,capacity,factor)=>({field,label,capacity,factor});
  const defaults={
    naoh:{supplier:'',threshold:2000,delivery:4000,leadDays:7,storedTotes:0,offset:450,tanks:[tank('naohEast','East Tank',1750,13.66),tank('naohCentral','Central Tank',1750,13.66),tank('naohWest','West Tank',1750,13.66)]},
    hypochlorite:{supplier:'',threshold:2000,delivery:4500,leadDays:7,storedTotes:0,offset:650,tanks:[tank('hypoEast','East Tank',3600,27.5325),tank('hypoWest','West Tank',3600,27.5325)]},
    alum:{supplier:'',threshold:4000,delivery:4400,leadDays:7,storedTotes:0,offset:0,tanks:[tank('alumEast','East Tank',12000,805.40032/12),tank('alumNorth','North Tank',1750,13.66),tank('alumSouth','South Tank',1750,13.66),tank('alumWest','West Tank',1750,13.66)]},
    polymer:{supplier:'',threshold:400,delivery:265,leadDays:7,storedTotes:2,offset:0,storedField:'polymerInventory',tanks:[tank('polymerTank','Day Tank',300,5.61)]},
    permanganate:{supplier:'',threshold:400,delivery:265,leadDays:7,storedTotes:2,offset:0,storedField:'permInventory',tanks:[tank('permWest','West Tank (20%)',300,7.143),tank('permEast','East Tank (10% Batch)',300,null)]}
  };
  const baseline={id:'baseline-2026-10-21',effectiveFrom:'0001-01-01',operator:'Original Workbook',reason:'Original facility calculations',chemicals:defaults};
  const clone=value=>JSON.parse(JSON.stringify(value));
  function resolve(versions,date){
    const applicable=(versions||[]).map((version,index)=>({...version,index})).filter(v=>v.effectiveFrom<=date).sort((a,b)=>a.effectiveFrom.localeCompare(b.effectiveFrom)||a.index-b.index);
    let resolved=clone(baseline);
    // A scheduled change to one chemical must not undo intervening changes to another.
    for(const version of applicable)resolved={...version,chemicals:{...resolved.chemicals,...(version.chemicalKey?{[version.chemicalKey]:clone(version.chemicals[version.chemicalKey])}:clone(version.chemicals))}};
    delete resolved.index;return resolved;
  }
  function planning(config=defaults){return Object.fromEntries(Object.entries(config).map(([key,c])=>[key,{threshold:c.threshold,delivery:c.delivery,leadDays:c.leadDays,storedTotes:c.storedTotes,supplier:c.supplier,capacity:c.tanks.filter(t=>t.factor!==null).reduce((sum,t)=>sum+t.capacity,0)+(c.storedField?c.delivery*c.storedTotes:0),...(c.storedField?{storedField:c.storedField}:{}),description:c.tanks.filter(t=>t.factor!==null).map(t=>t.label+': '+t.capacity.toLocaleString()+' usable gal').join(' + ')+(c.storedField?' + '+c.storedTotes+' stored totes':'')+(key==='permanganate'?'; East 10% batch excluded':'')} ]));}
  function volume(c,readings){const tracked=c.tanks.filter(t=>t.factor!==null);if(tracked.some(t=>typeof readings[t.field]!=='number'||!Number.isFinite(readings[t.field])||readings[t.field]<0)||c.storedField&&(typeof readings[c.storedField]!=='number'||!Number.isFinite(readings[c.storedField])||readings[c.storedField]<0))return null;const value=tracked.reduce((sum,t)=>sum+readings[t.field]*t.factor,c.offset)+(c.storedField?readings[c.storedField]:0);return Number.isFinite(value)?value:null;}
  function formula(c){return c.tanks.filter(t=>t.factor!==null).map(t=>t.label+' × '+t.factor).join(' + ')+(c.offset?' + '+c.offset:'')+(c.storedField?' + Stored Inventory':'');}
  function validate(key,input){
    const base=defaults[key];if(!base||!input||typeof input!=='object')throw Error('Choose a valid chemical.');
    const number=(value,label,min=0,max=1000000000)=>{if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw Error('Enter a valid '+label+'.');return value;};
    if(typeof input.supplier!=='string'||input.supplier.length>200)throw Error('Supplier must be up to 200 characters.');
    const output={supplier:input.supplier.trim(),threshold:number(input.threshold,'reorder level'),delivery:number(input.delivery,'delivery size',.000001),leadDays:number(input.leadDays,'delivery lead time',0,365),storedTotes:number(input.storedTotes,'stored tote count',0,100),offset:number(input.offset,'fixed volume offset'),...(base.storedField?{storedField:base.storedField}:{})};
    if(!Number.isInteger(output.leadDays)||!Number.isInteger(output.storedTotes)||!base.storedField&&output.storedTotes!==0)throw Error('Lead time and stored tote count must be whole numbers.');
    if(!Array.isArray(input.tanks)||input.tanks.length!==base.tanks.length||new Set(input.tanks.map(t=>t.field)).size!==base.tanks.length)throw Error('Keep the existing tank identities.');
    output.tanks=base.tanks.map(t=>{const value=input.tanks.find(v=>v.field===t.field);if(!value||t.factor===null&&value.factor!==null)throw Error('The East 10% batch must remain monitored separately.');return{...t,capacity:number(value.capacity,t.label+' capacity',.000001),factor:t.factor===null?null:number(value.factor,t.label+' gallons per inch',.000001,1000000)};});
    const capacity=planning({[key]:output})[key].capacity;if(output.threshold>capacity||output.delivery>capacity)throw Error('Reorder level and delivery size must fit within usable tank and stored capacity.');
    return output;
  }
  return{defaults,baseline,clone,resolve,planning,volume,formula,validate};
});
