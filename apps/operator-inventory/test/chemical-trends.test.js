const {test}=require('node:test'),assert=require('node:assert/strict');
const {buildSeries}=require('../public/chemical-trends');
const {estimateForecast,forecastValue}=require('../public/chemical-trends');
const {orderPlan,orderSettings}=require('../public/chemical-trends');
const {reportOrderAdvice}=require('../public/chemical-trends');
const model=require('../public/chemical-math');
test('chemical trends use preserved gallons, retain zero readings, and leave missing dates as gaps',()=>{
  const records=model.calculate([
    {date:'2026-01-01',readings:{},recordedGallons:{naoh:4226.9520438},source:{type:'workbook'}},
    {date:'2026-01-08',readings:{}},
    {date:'2026-01-15',readings:{},recordedGallons:{naoh:0},source:{type:'workbook'}}
  ]);
  const points=buildSeries(records,'naoh');assert.deepEqual(points.map(p=>p.value),[4226.9520438,null,0]);assert.ok(points[0].imported);
  assert.equal(records[0].readings.naohEast,undefined,'Charts do not create historical tank readings');
  assert.deepEqual(buildSeries(records,'naoh','used','2026-01-08','2026-01-15').map(p=>p.date),['2026-01-08','2026-01-15']);
});
test('salt is trended in pallets without converting absent historical counts into zero',()=>{
  const records=[{date:'2026-01-01',readings:{salt:null},source:{type:'workbook'}},{date:'2026-10-27',readings:{salt:.5}}];
  assert.deepEqual(buildSeries(records,'salt').map(p=>p.value),[null,.5]);
  assert.deepEqual(buildSeries(records,'salt','used','2027-01-01').map(p=>p.value),[]);
});
test('NWOS separates interval water use from counter readings and excludes reset usage',()=>{
  const records=model.calculate([
    {date:'2026-10-01',readings:{nwos:200000},recordedWaterUsed:0,recordedWaterPreviousDate:null,source:{type:'workbook'}},
    {date:'2026-10-08',readings:{nwos:200100}},
    {date:'2026-10-15',readings:{nwos:10}}
  ]);
  const usage=buildSeries(records,'nwos','used');assert.deepEqual(usage.map(p=>p.value),[0,100000,null]);assert.equal(usage[1].intervalStart,'2026-10-01');assert.equal(usage[2].missing,'Meter reset / review');
  assert.deepEqual(buildSeries(records,'nwos','meter').map(p=>p.value),[200000,200100,10]);
});
test('inventory forecast uses recent weighted drawdown and excludes observed stock increases',()=>{
  const rows=[['2026-01-01',1000],['2026-01-08',930],['2026-01-15',860],['2026-01-22',1300],['2026-01-29',1230],['2026-02-05',1160]].map(([date,value])=>({date,value}));
  const f=estimateForecast(rows,'naoh');assert.ok(f.available);assert.equal(f.ratePerDay,10);assert.equal(f.intervals,4);assert.equal(f.excluded,1);assert.equal(f.asOf,'2026-02-05');assert.equal(f.projected.at(-1).value,860);
  assert.equal(f.projected[0].value,1160,'Projection starts at the actual latest stock');
  const irregular=estimateForecast([{date:'2026-01-01',value:100},{date:'2026-01-03',value:80},{date:'2026-01-13',value:60}],'salt');
  assert.equal(irregular.ratePerDay,40/12,'Rates are weighted by elapsed days rather than by count of readings');
});
test('forecast never creates negative inventory, handles flat stock, and requires enough recent comparable data',()=>{
  const rows=[{date:'2026-01-01',value:40},{date:'2026-01-08',value:30},{date:'2026-01-15',value:20}];
  const f=estimateForecast(rows,'polymer');assert.equal(f.daysToZero,14);assert.ok(f.projected.every(p=>p.value>=0));assert.equal(f.projected.at(-1).value,0);assert.ok(f.projected.some(p=>p.date==='2026-01-29'&&p.value===0));
  const flat=estimateForecast(rows.map(r=>({...r,value:20})),'salt');assert.equal(flat.ratePerDay,0);assert.equal(flat.daysToZero,null);assert.equal(forecastValue(flat,30),20);
  assert.equal(estimateForecast(rows.slice(1),'naoh').available,false);
  assert.equal(estimateForecast([{date:'2026-01-01',value:100},{date:'2026-01-08',value:null},{date:'2026-01-15',value:90},{date:'2026-01-22',value:80}],'naoh').available,false,'Unknown readings are not bridged to infer usage');
  assert.equal(estimateForecast([{date:'2026-01-01',value:100},{date:'2026-01-08',value:90},{date:'2026-04-01',value:80}],'naoh').available,false,'Old usage outside the recent window is not reused');
});
test('NWOS forecast normalizes variable intervals and projects counter readings in meter units',()=>{
  const water=estimateForecast([{date:'2026-01-08',value:200,intervalStart:'2026-01-01'},{date:'2026-01-22',value:400,intervalStart:'2026-01-08'}],'nwos','used');
  assert.equal(water.ratePerDay,600/21);assert.equal(water.intervalDays,10.5);assert.equal(forecastValue(water,30),300,'Expected water volume uses a typical interval rather than assuming all intervals are a week');
  const meter=estimateForecast([{date:'2026-01-01',value:200},{date:'2026-01-08',value:210},{date:'2026-01-15',value:220}],'nwos','meter');assert.equal(meter.ratePerDay,20/14);assert.equal(forecastValue(meter,14),240);
});
test('order planning uses facility thresholds, usable volumes, delivery sizes and seven-day notice',()=>{
  assert.deepEqual(Object.values(orderSettings).map(s=>s.threshold),[4000,2000,2000,400,400]);
  assert.equal(orderSettings.alum.capacity,3*1750+12000);
  assert.equal(orderSettings.permanganate.capacity,300+2*265,'Diluted East tank does not add full-strength capacity');
  const latest={date:'2026-10-27',value:6000},f={available:true,ratePerDay:100};
  const alum=orderPlan('alum',latest,f);
  assert.equal(alum.thresholdDays,20);assert.equal(alum.deliveryDays,20);assert.equal(alum.orderDays,13);assert.equal(alum.arrivalGallons,4000);
  assert.equal(alum.headroom,11250);assert.equal(alum.delivery,4400);
  const caustic=orderPlan('naoh',{...latest,value:3000},f);
  assert.equal(caustic.thresholdDays,10);assert.equal(caustic.fitDays,17.5);
  assert.equal(caustic.deliveryDays,17.5);assert.equal(caustic.orderDays,10.5);assert.equal(caustic.arrivalGallons,1250);
  assert.ok(caustic.arrivalGallons+caustic.delivery<=caustic.capacity,'Standard load respects usable capacity');
  const hypo=orderPlan('hypochlorite',latest,f);assert.equal(hypo.deliveryDays,40);assert.equal(hypo.arrivalGallons,2000);
  for(const key of ['polymer','permanganate']){const tote=orderPlan(key,{...latest,value:600},f);assert.equal(tote.delivery,265);assert.equal(tote.deliveryDays,2);assert.equal(tote.orderDays,-5);}
});
test('planning handles low stock, capacity exceptions and sparse or flat histories without fabricated dates',()=>{
  const low=orderPlan('alum',{date:'2026-10-27',value:50},{available:true,ratePerDay:100});assert.equal(low.deliveryDays,0);assert.equal(low.orderDays,-7);assert.equal(low.daysToZero,.5);
  const over=orderPlan('naoh',{date:'2026-10-27',value:6000},{available:true,ratePerDay:100});assert.equal(over.headroom,0);assert.equal(over.fitDays,47.5);
  for(const f of [null,{available:false},{available:true,ratePerDay:0}]){const p=orderPlan('polymer',{date:'2026-10-27',value:500},f);assert.equal(p.threshold,400);assert.equal(p.orderDays,undefined);}
  assert.equal(orderPlan('salt',{date:'2026-10-27',value:1},null),null);
  assert.equal(orderPlan('alum',null,null),null);
});
test('report ordering uses only readings available on the report date and includes seven-day notice',()=>{
  const row=(date,alum)=>({date,status:'complete',readings:{},totals:{alum:{gallons:alum}}});
  const records=[row('2026-01-01',6000),row('2026-01-08',5300),row('2026-01-15',4600),row('2026-01-22',9000)];
  const advice=reportOrderAdvice(records,records[2]).find(a=>a.key==='alum');
  assert.equal(advice.forecast.ratePerDay,100);assert.equal(advice.forecast.asOf,'2026-01-15');assert.equal(advice.plan.orderDays,-1);assert.equal(advice.decision,'Order Now','Seven-day lead time triggers ordering before crossing the threshold');
  const missing=reportOrderAdvice(records,records[2]).find(a=>a.key==='naoh');assert.equal(missing.decision,'Reading Missing');assert.equal(missing.plan,null,'Report does not borrow a missing reading from another date');
});
test('report distinguishes reorder thresholds, future ordering, flat history and insufficient trends',()=>{
  const row=(date,value,status='complete')=>({date,status,readings:{},totals:{alum:{gallons:value}}});
  let records=[row('2026-01-01',7400),row('2026-01-08',6700),row('2026-01-15',6000,'draft')];
  let advice=reportOrderAdvice(records,records[2]).find(a=>a.key==='alum');assert.equal(advice.decision,'Plan Order');assert.equal(advice.plan.orderDays,13,'A partial report can use its recorded chemical total');
  records=[row('2026-01-15',3000)];advice=reportOrderAdvice(records,records[0]).find(a=>a.key==='alum');assert.equal(advice.decision,'Order Now');assert.equal(advice.forecast.available,false,'Threshold still works when there is too little trend history');
  records=[row('2026-01-15',6000)];assert.equal(reportOrderAdvice(records,records[0]).find(a=>a.key==='alum').decision,'Trend Unavailable');
  records=[row('2026-01-01',6000),row('2026-01-08',6000),row('2026-01-15',6000)];assert.equal(reportOrderAdvice(records,records[2]).find(a=>a.key==='alum').decision,'No Recent Drawdown');
});
