'use strict';
const {randomUUID}=require('node:crypto');
const chemicals=require('./public/chemical-math');
const settingsModel=require('./public/chemical-settings');
const {reportOrderAdvice}=require('./public/chemical-trends');
const day=86400000;
const dateAt=(date,days)=>new Date(Date.parse(date+'T12:00:00Z')+days*day).toISOString().slice(0,10);
const readingKey=record=>record.date+'|'+(record.updatedAt||'imported');
function reconcile(state,today=new Date().toISOString().slice(0,10)){
  const records=chemicals.calculate((state.chemicalInventory?.records||[]).filter(r=>(r.status||'complete')==='complete'));
  const latest=records.find(r=>r.source?.type!=='workbook'),existing=state.orderList||[],supplies=existing.filter(e=>!e.chemicalKey);
  if(!latest){return existing.some(e=>e.chemicalKey)?{...state,orderList:supplies,orderListRevision:(state.orderListRevision||0)+1}:state;}
  const key=readingKey(latest),age=Math.max(0,(Date.parse(today)-Date.parse(latest.date))/day),next=[];
  const configuration=settingsModel.resolve(state.chemicalSettings?.versions,today).chemicals;
  for(const advice of reportOrderAdvice(records,latest,settingsModel.planning(configuration))){
    const {plan,forecast}=advice,id=advice.key;
    if(!plan||!(plan.gallons<=plan.threshold||Number.isFinite(plan.orderDays)&&plan.orderDays<=age))continue;
    if(state.chemicalOrderResolutions?.[id]?.readingKey===key)continue;
    // A dated delivery already arranged covers readings taken before that delivery.
    const incoming=(state.orderHistory||[]).flatMap(order=>order.items).some(e=>e.chemicalKey===id&&e.deliveryDate&&e.deliveryDate>=latest.date);
    if(incoming)continue;
    const previous=existing.find(e=>e.chemicalKey===id),chemical=chemicals.chemicals.find(c=>c.id===id),tote=!!plan.storedField;
    const target=dateAt(latest.date,Math.ceil(Math.max(age+plan.leadDays,plan.deliveryDays||0)));
    const warnings=[];
    if(age>14)warnings.push('Inventory is more than 14 days old. Check current tank levels before ordering.');
    if(!forecast.available)warnings.push('Recent usage is unavailable. Confirm current levels and delivery timing.');
    if(plan.delivery>plan.headroom)warnings.push('A standard delivery does not fit at the recorded level. Confirm available space before unloading.');
    if(tote)warnings.push('Confirm a stored tote position is available. Maximum '+plan.storedTotes+' stored totes.'+(id==='permanganate'?' East 10% batch is excluded.':''));
    if(Number.isFinite(plan.daysToZero)&&plan.daysToZero<age+plan.leadDays)warnings.push('Projected supply may run out before delivery. Contact the supplier and check current levels.');
    const planning={gallons:plan.gallons,threshold:plan.threshold,capacity:plan.capacity,delivery:plan.delivery,leadDays:plan.leadDays,rate:forecast.available?forecast.ratePerDay:null,orderBy:Number.isFinite(plan.orderDays)?dateAt(latest.date,Math.ceil(Math.max(0,plan.orderDays))):latest.date,targetDelivery:target,warnings};
    next.push({...previous,id:previous?.id||randomUUID(),chemicalKey:id,source:'chemical',readingKey:key,item:{id:'chemical-'+id,description:chemical.name,itemNumber:'',company:previous?.item.company||configuration[id].supplier||'',countSize:tote?'Tote':'gal',caseSize:tote?plan.delivery+' gal per tote':'Standard bulk delivery: '+plan.delivery.toLocaleString()+' gal',productUrl:'',par:plan.threshold},quantity:previous?previous.quantity:tote?1:plan.delivery,orderUnit:previous?.orderUnit||(tote?'Tote':'gal'),notes:previous?.notes||'',addedAt:previous?.addedAt||new Date().toISOString(),deliveryDate:previous?.deliveryDateEdited?previous.deliveryDate:target,inventoryDate:latest.date,operator:latest.operator,worksheet:'chemical',inventoryStatus:'complete',onHand:plan.gallons,planning});
  }
  const items=[...supplies,...next];
  // Stable ordering and comparison keep repeated reads from creating revision conflicts.
  if(JSON.stringify(items)===JSON.stringify(existing))return state;
  return {...state,orderList:items,orderListRevision:(state.orderListRevision||0)+1};
}
module.exports={reconcile,readingKey};
