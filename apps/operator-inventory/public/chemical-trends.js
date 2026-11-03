/* Local, dependency-free trend charts. Missing readings remain gaps. */
(function(root){
  'use strict';
  function buildSeries(records,key,measure='used',from='',through=''){
    return records.filter(r=>(!from||r.date>=from)&&(!through||r.date<=through)).sort((a,b)=>a.date.localeCompare(b.date)).map(record=>{
      const raw=key==='salt'?record.readings.salt:key==='nwos'?(measure==='meter'?record.readings.nwos:record.nwosUsed):record.totals?.[key]?.gallons;
      const reset=key==='nwos'&&measure!=='meter'&&record.nwosReset;
      return{date:record.date,value:!reset&&typeof raw==='number'&&Number.isFinite(raw)&&raw>=0?raw:null,imported:record.source?.type==='workbook',operator:record.operator||'',intervalStart:key==='nwos'&&measure!=='meter'?record.nwosPreviousDate:null,missing:reset?'Meter reset / review':'Not recorded'};
    });
  }
  const dayMs=86400000;
  // Planning assumptions supplied by the facility; these never change saved gallons.
  const orderSettings={
    alum:{threshold:4000,capacity:17250,delivery:4400,description:'3 small tanks at 1,750 usable gal each + 12,000 usable gal East tank'},
    hypochlorite:{threshold:2000,capacity:7200,delivery:4500,description:'2 tanks at 3,600 usable gal each'},
    naoh:{threshold:2000,capacity:5250,delivery:4000,description:'3 tanks at 1,750 usable gal each'},
    polymer:{threshold:400,capacity:830,delivery:265,storedField:'polymerInventory',description:'300 gal tank + up to 2 stored 265 gal totes'},
    permanganate:{threshold:400,capacity:830,delivery:265,storedField:'permInventory',description:'300 usable gal West 20% tank + up to 2 stored 265 gal totes; East 10% batch excluded'}
  };
  function orderPlan(key,latest,forecast,overrides){
    const settings=(overrides||orderSettings)[key];
    if(!settings||!latest||!Number.isFinite(latest.value)||latest.value<0)return null;
    const plan={...settings,leadDays:settings.leadDays??7,asOf:latest.date,gallons:latest.value,headroom:Math.max(0,settings.capacity-latest.value),deliveryLevel:settings.capacity-settings.delivery};
    if(!forecast?.available||forecast.ratePerDay<=0)return plan;
    const rate=forecast.ratePerDay;
    plan.thresholdDays=Math.max(0,(latest.value-settings.threshold)/rate);
    plan.fitDays=Math.max(0,(latest.value-plan.deliveryLevel)/rate);
    plan.deliveryDays=Math.max(plan.thresholdDays,plan.fitDays);
    plan.orderDays=plan.deliveryDays-plan.leadDays;
    plan.arrivalGallons=Math.max(0,latest.value-rate*plan.deliveryDays);
    plan.daysToZero=latest.value/rate;
    return plan;
  }
  function forecastValue(forecast,days){
    if(forecast.kind==='stock')return Math.max(0,forecast.latestValue-forecast.ratePerDay*days);
    if(forecast.kind==='meter')return forecast.latestValue+forecast.ratePerDay*days;
    return forecast.ratePerDay*forecast.intervalDays;
  }
  function estimateForecast(rows,key,measure='used',horizon=30){
    horizon=Number.isFinite(horizon)&&horizon>0?Math.max(1,Math.min(90,Math.round(horizon))):30;
    const dated=rows.filter(r=>Number.isFinite(Date.parse(r.date))).sort((a,b)=>a.date.localeCompare(b.date));
    const valid=dated.filter(r=>typeof r.value==='number'&&Number.isFinite(r.value)&&r.value>=0),latest=valid.at(-1);
    if(!latest)return{available:false,reason:'No recorded readings to forecast.'};
    const cutoff=Date.parse(latest.date)-42*dayMs,kind=key==='nwos'?(measure==='meter'?'meter':'interval'):'stock';
    const intervals=[];let excluded=0;
    if(kind==='interval'){
      for(const row of valid){const start=Date.parse(row.intervalStart),days=(Date.parse(row.date)-start)/dayMs;if(start>=cutoff&&days>0)intervals.push({amount:row.value,days});}
    }else{
      for(let i=1;i<dated.length;i++){
        const a=dated[i-1],b=dated[i],days=(Date.parse(b.date)-Date.parse(a.date))/dayMs;
        if(Date.parse(a.date)<cutoff||!Number.isFinite(a.value)||!Number.isFinite(b.value)||a.value<0||b.value<0||days<=0)continue;
        const amount=kind==='stock'?a.value-b.value:b.value-a.value;
        if(amount<0){excluded++;continue;}
        intervals.push({amount,days});
      }
    }
    const recent=intervals.slice(-4);
    if(recent.length<2)return{available:false,reason:kind==='stock'?'Forecast needs at least two recent comparable intervals (usually three readings), excluding stock increases and missing values.':'Forecast needs at least two recent valid water-use intervals, excluding meter resets.'};
    const days=recent.reduce((sum,r)=>sum+r.days,0),ratePerDay=recent.reduce((sum,r)=>sum+r.amount,0)/days;
    const lengths=recent.map(r=>r.days).sort((a,b)=>a-b),mid=Math.floor(lengths.length/2),intervalDays=lengths.length%2?lengths[mid]:(lengths[mid-1]+lengths[mid])/2;
    const result={available:true,kind,ratePerDay,intervalDays,asOf:latest.date,latestValue:latest.value,intervals:recent.length,days,excluded,horizon,daysToZero:kind==='stock'&&ratePerDay>0?latest.value/ratePerDay:null};
    const dateAt=offset=>new Date(Date.parse(latest.date)+offset*dayMs).toISOString().slice(0,10);
    const offsets=kind==='interval'?[0,Math.min(horizon,Math.max(1,Math.round(intervalDays))),horizon]:[0,horizon];
    if(result.daysToZero!==null&&result.daysToZero>0&&result.daysToZero<horizon)offsets.push(Math.ceil(result.daysToZero));
    result.projected=[...new Set(offsets)].sort((a,b)=>a-b).map(offset=>({date:dateAt(offset),value:forecastValue(result,offset)}));
    return result;
  }
  function reportOrderAdvice(records,record,overrides){
    if(!overrides&&record.settingsSnapshot){const model=typeof module==='object'&&module.exports?require('./chemical-settings'):root.ChemicalSettings;overrides=model.planning(record.settingsSnapshot);}
    // A dated report cannot use later readings, or borrow a missing current value.
    const history=records.filter(r=>r.date<=record.date&&(r.date===record.date||(r.status||'complete')==='complete'));
    return Object.keys(orderSettings).map(key=>{
      const rows=buildSeries(history,key),latest=rows.find(row=>row.date===record.date);
      const forecast=estimateForecast(rows,key),plan=orderPlan(key,latest,forecast,overrides);
      if(!plan)return{key,decision:'Reading Missing',forecast,plan:null};
      const decision=plan.gallons<=plan.threshold||plan.orderDays!==undefined&&plan.orderDays<=0?'Order Now':plan.orderDays!==undefined?'Plan Order':forecast.available?'No Recent Drawdown':'Trend Unavailable';
      return{key,decision,forecast,plan};
    });
  }
  if(typeof module==='object'&&module.exports){module.exports={buildSeries,estimateForecast,forecastValue,orderPlan,orderSettings,reportOrderAdvice};return;}
  const $=id=>document.getElementById(id),svgNS='http://www.w3.org/2000/svg';
  const items=[...root.ChemicalInventory.chemicals.map(c=>({id:c.id,name:c.name})),{id:'salt',name:'Salt'},{id:'nwos',name:'Northwest Open Space Water'}];
  let records=[],points=[],selected=-1,geometry=[],forecast=null,chartScale=null;
  const number=n=>n.toLocaleString(undefined,{maximumFractionDigits:2});
  const dateLabel=date=>new Date(date+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
  const shortDate=time=>new Date(time).toLocaleDateString(undefined,{month:'short',day:'numeric',timeZone:'UTC'});
  const stamp=date=>Date.parse(date+'T00:00:00Z');
  function svgElement(tag,attributes={},text){const node=document.createElementNS(svgNS,tag);for(const [name,value]of Object.entries(attributes))node.setAttribute(name,String(value));if(text!==undefined)node.textContent=text;return node;}
  function open(date){document.dispatchEvent(new CustomEvent('chemical:open-inventory',{detail:{date}}));}
  for(const item of items){const option=document.createElement('option');option.value=item.id;option.textContent=item.name;$('trend-item').append(option);}
  function selectPoint(index,focus=false){
    if(index<0||index>=points.length)return;
    selected=index;const point=points[index];
    $('trend-open-inventory').hidden=false;
    $('trend-point-date').textContent=dateLabel(point.date);$('trend-point-value').textContent=number(point.value)+' '+unit();
    $('trend-point-source').textContent=(point.imported?'Imported Workbook':'App Reading'+(point.operator?' · '+point.operator:''))+(point.intervalStart?' · Since '+dateLabel(point.intervalStart):'');
    for(const [i,group]of [...$('trend-chart').querySelectorAll('[data-trend-point]')].entries()){group.classList.toggle('is-selected',i===index);group.setAttribute('tabindex',i===index?'0':'-1');if(focus&&i===index)group.focus();}
    const cursor=$('trend-chart').querySelector('.trend-cursor');if(cursor){cursor.setAttribute('x1',geometry[index].x);cursor.setAttribute('x2',geometry[index].x);}
  }
  function unit(){return $('trend-item').value==='salt'?'pallets':$('trend-item').value==='nwos'&&$('trend-measure').value==='meter'?'× 1,000 gal':'gal';}
  function niceStep(value){const power=10**Math.floor(Math.log10(value||1)),fraction=value/power;return([1,2,2.5,5,10].find(n=>n>=fraction)||10)*power;}
  function renderOrderPlan(key,rows,latest){
    const panel=$('trend-order-plan');panel.replaceChildren();panel.hidden=!orderSettings[key];
    if(panel.hidden)return;
    const heading=document.createElement('h3');heading.textContent='Order Planning';panel.append(heading);
    const snapshot=records.find(r=>r.date===latest.date)?.settingsSnapshot,configuration=snapshot?root.ChemicalSettings.planning(snapshot):orderSettings;
    const estimate=estimateForecast(rows,key),plan=orderPlan(key,latest,estimate,configuration);
    if(!plan){const message=document.createElement('p');message.textContent='Save a gallons-on-hand reading to estimate order timing.';panel.append(message);return;}
    const addText=(text,className='')=>{const p=document.createElement('p');p.textContent=text;p.className=className;panel.append(p);};
    addText('Based on '+dateLabel(plan.asOf)+'. '+plan.description+'. Standard delivery: '+number(plan.delivery)+' gal'+(plan.storedField?' (1 tote)':'')+'. Lead time: '+plan.leadDays+' days.');
    const grid=document.createElement('div');grid.className='trend-order-grid';panel.append(grid);
    const metric=(label,value)=>{const div=document.createElement('div'),name=document.createElement('span'),amount=document.createElement('strong');name.textContent=label;amount.textContent=value;div.append(name,amount);grid.append(div);};
    metric('Reorder Level',number(plan.threshold)+' gal');metric('Usable Capacity',number(plan.capacity)+' gal');metric('Estimated Total Headroom',number(plan.headroom)+' gal');
    const now=new Date();now.setMinutes(now.getMinutes()-now.getTimezoneOffset());const today=now.toISOString().slice(0,10),age=Math.max(0,(stamp(today)-stamp(plan.asOf))/dayMs);
    const dateAt=(days,round=Math.ceil)=>Math.abs(days)<=3650?dateLabel(new Date(stamp(plan.asOf)+round(days)*dayMs).toISOString().slice(0,10)):'Beyond 10-year estimate';
    if(plan.thresholdDays!==undefined){
      metric('Reorder Level Reached',plan.gallons<=plan.threshold?'At / Below Level':dateAt(plan.thresholdDays));
      metric('Target Delivery',dateAt(plan.deliveryDays));
      metric('Place Order By',dateAt(plan.orderDays,Math.floor)+(plan.orderDays<=age?' - Due Now':''));
      metric('7-Day Estimated Use',number(estimate.ratePerDay*7)+' gal');
      addText('Target delivery is when inventory reaches the reorder level and has estimated room for a standard load. Place the order '+plan.leadDays+' days earlier. Expected inventory at delivery: '+number(plan.arrivalGallons)+' gal. These dates assume continued recent net drawdown and no replenishment.');
      if(plan.fitDays>plan.thresholdDays)addText('A standard load will not fit at the reorder level. Estimated room for '+number(plan.delivery)+' gal occurs at '+number(plan.deliveryLevel)+' gal remaining. Arrange a smaller load or confirm the later delivery date with the supplier.','chemical-warning');
      if(plan.daysToZero<age+plan.leadDays)addText('Estimated supply may run out before a new '+plan.leadDays+'-day delivery could arrive. Check current levels and contact the supplier.','chemical-warning');
    }else addText(estimate.available?'No recent net drawdown; order dates cannot be estimated.':estimate.reason);
    if(age>14)addText('This reading is '+Math.floor(age)+' days old. Enter current levels before placing an order.','chemical-warning');
    if(plan.gallons>plan.capacity)addText('Recorded gallons exceed the approximate usable capacity. Check levels and the capacity basis before planning a delivery.','chemical-warning');
    if(plan.storedField){
      const record=records.find(r=>r.date===plan.asOf),stored=record?.readings?.[plan.storedField];
      addText(Number.isFinite(stored)?'Stored inventory: '+number(stored)+' gal ('+number(stored/plan.delivery)+' tote equivalents). Nominal storage headroom: '+number(Math.max(0,plan.delivery*(plan.storedTotes??2)-stored))+' gal.':'Stored tote readings are unavailable for this inventory; storage space cannot be determined.');
      addText((plan.storedTotes??2)+' totes maximum on site. Partial totes still occupy a slot: confirm a free tote position or transfer space before delivery.');
    }
    addText('Capacity and headroom are approximate totals, not confirmation that an individual tank can accept a load. Verify tank distribution, operating limits, and tote space. Saved workbook formulas and gallons are unchanged.','report-note');
  }
  function drawChart(rows){
    const chart=$('trend-chart');chart.replaceChildren();geometry=[];
    const width=Math.max(280,Math.round(chart.getBoundingClientRect().width||900)),height=width<500?280:350;
    chart.setAttribute('viewBox',`0 0 ${width} ${height}`);
    const left=58,right=16,top=20,bottom=height-42,plotWidth=width-left-right;
    const snapshot=records.find(r=>r.date===rows.at(-1)?.date)?.settingsSnapshot;const reorder=(snapshot?root.ChemicalSettings.planning(snapshot):orderSettings)[$('trend-item').value];
    const values=[...points.map(p=>p.value),...(forecast?.available?forecast.projected.map(p=>p.value):[]),...(reorder?[reorder.threshold]:[])],min=Math.min(...values),max=Math.max(...values),meter=$('trend-item').value==='nwos'&&$('trend-measure').value==='meter';
    const step=niceStep((meter?(max-min||max*.1||1):(max||1))/4),low=meter?Math.max(0,Math.floor((min-step*.1)/step)*step):0,high=Math.ceil((max+step*.1)/step)*step;
    const first=stamp(points[0].date),last=stamp(forecast?.available?forecast.projected.at(-1).date:points.at(-1).date);
    const x=date=>last===first?left+plotWidth/2:left+(stamp(date)-first)/(last-first)*plotWidth;
    const y=value=>bottom-(value-low)/(high-low)*(bottom-top);
    chartScale={first,last,left,plotWidth};
    for(let value=low;value<=high+step*.001;value+=step){const position=y(value);chart.append(svgElement('line',{x1:left,x2:width-right,y1:position,y2:position,class:'trend-grid'}),svgElement('text',{x:left-8,y:position+4,'text-anchor':'end',class:'trend-tick'},new Intl.NumberFormat(undefined,{notation:'compact',maximumFractionDigits:1}).format(value)));}
    if(reorder)chart.append(svgElement('line',{x1:left,x2:width-right,y1:y(reorder.threshold),y2:y(reorder.threshold),class:'trend-reorder-line','aria-label':'Reorder level: '+number(reorder.threshold)+' gallons'}),svgElement('text',{x:width-right,y:y(reorder.threshold)-7,'text-anchor':'end',class:'trend-reorder-label'},'Order: '+number(reorder.threshold)+' gal'));
    const ticks=first===last?1:width<500?2:5;
    for(let i=0;i<ticks;i++){const time=ticks===1?first:first+(last-first)*i/(ticks-1),position=ticks===1?left+plotWidth/2:left+plotWidth*i/(ticks-1);chart.append(svgElement('text',{x:position,y:height-15,'text-anchor':ticks===1?'middle':i===0?'start':i===ticks-1?'end':'middle',class:'trend-tick'},shortDate(time)));}
    let segment=[];const flush=()=>{if(segment.length>1)chart.append(svgElement('polyline',{points:segment.join(' '),class:'trend-line'}));segment=[];};
    for(const row of rows.filter(r=>r.date>=points[0].date&&r.date<=points.at(-1).date)){if(row.value===null)flush();else segment.push(x(row.date)+','+y(row.value));}flush();
    if(forecast?.available){
      chart.append(svgElement('line',{x1:x(forecast.asOf),x2:x(forecast.asOf),y1:top,y2:bottom,class:'trend-forecast-start'}));
      chart.append(svgElement('polyline',{points:forecast.projected.map(p=>x(p.date)+','+y(p.value)).join(' '),class:'trend-forecast-line','aria-label':'Forecast based on recent usage'}));
      const end=forecast.projected.at(-1);chart.append(svgElement('circle',{cx:x(end.date),cy:y(end.value),r:4,class:'trend-forecast-end'}));
    }
    chart.append(svgElement('line',{x1:0,x2:0,y1:top,y2:bottom,class:'trend-cursor'}));
    for(const [index,point]of points.entries()){
      const position={x:x(point.date),y:y(point.value)};geometry.push(position);
      const group=svgElement('g',{'data-trend-point':index,tabindex:'-1',role:'button','aria-label':dateLabel(point.date)+': '+number(point.value)+' '+unit()+(point.imported?', imported workbook':', app reading'),class:'trend-point '+(point.imported?'is-imported':'is-app')});
      group.append(svgElement('circle',{cx:position.x,cy:position.y,r:13,class:'trend-hit'}),svgElement('circle',{cx:position.x,cy:position.y,r:4,class:'trend-dot'}));
      group.addEventListener('pointerenter',()=>selectPoint(index));group.addEventListener('focus',()=>{if(selected!==index)selectPoint(index);});group.addEventListener('click',()=>selectPoint(index));
      group.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight','Home','End','Enter',' '].includes(event.key)){event.preventDefault();if(event.key==='Enter'||event.key===' ')open(point.date);else selectPoint(event.key==='Home'?0:event.key==='End'?points.length-1:Math.max(0,Math.min(points.length-1,index+(event.key==='ArrowRight'?1:-1))),true);}});
      chart.append(group);
    }
    selectPoint(points.length-1);
    if(meter)$('trend-description').textContent+=' The vertical axis is zoomed to show changes in the cumulative reading.';
  }
  function render(nextRecords=records){
    records=nextRecords;
    const key=$('trend-item').value,measure=$('trend-measure').value,from=$('trend-from').value,through=$('trend-through').value;
    $('trend-measure-label').hidden=key!=='nwos';
    const invalid=from&&through&&from>through,rows=invalid?[]:buildSeries(records,key,measure,from,through);
    points=rows.filter(p=>p.value!==null);selected=-1;
    renderOrderPlan(key,rows,points.at(-1));
    const forecastOn=$('trend-forecast-enabled').checked;
    forecast=forecastOn?estimateForecast(rows,key,measure,Number($('trend-forecast-days').value)):null;
    $('trend-forecast-days').disabled=!forecastOn;$('trend-forecast-summary').hidden=!forecastOn;$('trend-forecast-legend').hidden=!forecast?.available;
    if(forecast?.available){
      const dailyUnit=key==='salt'?'pallets/day':'gal/day',daily=key==='nwos'&&measure==='meter'?forecast.ratePerDay*1000:forecast.ratePerDay;
      const rateText=daily>0&&daily<.01?daily.toLocaleString(undefined,{maximumSignificantDigits:3}):number(daily);
      let text=(forecast.kind==='stock'?'Recent net drawdown: ':'Recent water use: ')+rateText+' '+dailyUnit+'. Based on '+forecast.intervals+' usable intervals ('+number(forecast.days)+' observed days) in the 42 days ending '+dateLabel(forecast.asOf)+'. ';
      if(forecast.kind==='stock'){
        text+='Stock increases are excluded. Projection assumes this rate continues with no replenishment. ';
        if(forecast.ratePerDay===0)text+='No recent net drawdown; forecast stays flat.';
        else if(forecast.daysToZero<=365){const zeroDate=new Date(stamp(forecast.asOf)+Math.ceil(forecast.daysToZero)*dayMs).toISOString().slice(0,10);text+='Projected zero inventory around '+dateLabel(zeroDate)+' ('+Math.ceil(forecast.daysToZero)+' days after the last reading).';}
      }else if(forecast.kind==='interval')text+='Dashed line shows expected use per typical '+number(forecast.intervalDays)+'-day interval; it is an estimate, not a scheduled reading.';
      else text+='Dashed line extends the cumulative meter using this recent daily rate, assuming no reset.';
      $('trend-forecast-summary').textContent=text;
    }else $('trend-forecast-summary').textContent=forecastOn?(forecast?.reason||'No forecast available.') : '';
    $('trend-chart-panel').hidden=!points.length;$('trend-values').hidden=!rows.length;$('trend-stats').replaceChildren();
    $('trend-status').textContent=invalid?'Choose an end date on or after the start date.':!points.length?(key==='salt'?'No salt counts recorded in this date range. Salt was not included in the imported workbook history.':'No readings available for this item in the selected date range.'):`${points.length} recorded ${points.length===1?'reading':'readings'} · ${dateLabel(points[0].date)} – ${dateLabel(points.at(-1).date)}`;
    const heading=key==='nwos'?(measure==='meter'?'Cumulative Meter Reading':'Water Used Between Readings'):items.find(item=>item.id===key).name;
    $('trend-chart-title').textContent=heading+' ('+unit()+')';$('trend-value-heading').textContent=unit();
    $('trend-description').textContent=key==='nwos'?(measure==='meter'?'Meter values match the recorded counter display.':'Water used over each reading interval. Intervals can differ in length; meter resets are excluded.') : key==='salt'?'Salt inventory in pallets. Each pallet holds 49 bags of 50 lb.':'Saved gallons on hand. Imported workbook values are preserved; missing readings create gaps.';
    if(points.length){
      const values=points.map(p=>p.value),change=points.at(-1).value-points[0].value;
      const fourth=key==='nwos'&&measure==='used'?['Total For Shown Intervals',number(values.reduce((sum,n)=>sum+n,0))]:['Net Change',points.length>1?(change>0?'+':'')+number(change):'—'];
      for(const [label,value]of [['Latest Reading',number(points.at(-1).value)],['Lowest',number(Math.min(...values))],['Highest',number(Math.max(...values))],fourth]){const box=document.createElement('div'),name=document.createElement('span'),amount=document.createElement('strong'),suffix=document.createElement('small');name.textContent=label;amount.textContent=value;suffix.textContent=unit();box.append(name,amount,suffix);$('trend-stats').append(box);}
      drawChart(rows);
    }
    $('trend-value-rows').replaceChildren();
    for(const row of rows){const tr=document.createElement('tr'),date=document.createElement('td'),button=document.createElement('button');button.type='button';button.className='text-button';button.textContent=dateLabel(row.date);button.addEventListener('click',()=>open(row.date));date.append(button);const value=document.createElement('td');value.textContent=row.value===null?row.missing:number(row.value);const source=document.createElement('td');source.textContent=row.imported?'Imported Workbook':'App Reading';tr.append(date,value,source);$('trend-value-rows').append(tr);}
  }
  $('trend-chart').addEventListener('pointermove',event=>{
    if(!geometry.length||!points.length)return;
    const rect=$('trend-chart').getBoundingClientRect(),viewWidth=$('trend-chart').viewBox.baseVal.width,x=(event.clientX-rect.left)/rect.width*viewWidth;
    if(forecast?.available&&chartScale){
      const time=chartScale.first+(x-chartScale.left)/chartScale.plotWidth*(chartScale.last-chartScale.first);
      if(time>stamp(forecast.asOf)){
        const days=Math.max(1,Math.min(forecast.horizon,Math.round((time-stamp(forecast.asOf))/dayMs))),date=new Date(stamp(forecast.asOf)+days*dayMs).toISOString().slice(0,10);
        selected=-1;$('trend-point-date').textContent='Forecast · '+dateLabel(date);$('trend-point-value').textContent=number(forecastValue(forecast,days))+' '+unit();$('trend-point-source').textContent='Estimated from recent readings · Not a saved inventory';$('trend-open-inventory').hidden=true;
        const position=chartScale.left+(stamp(date)-chartScale.first)/(chartScale.last-chartScale.first)*chartScale.plotWidth,cursor=$('trend-chart').querySelector('.trend-cursor');cursor.setAttribute('x1',position);cursor.setAttribute('x2',position);return;
      }
    }
    let nearest=0;for(let i=1;i<geometry.length;i++)if(Math.abs(geometry[i].x-x)<Math.abs(geometry[nearest].x-x))nearest=i;if(nearest!==selected)selectPoint(nearest);
  });
  $('trend-open-inventory').addEventListener('click',()=>{if(points[selected])open(points[selected].date);});
  for(const id of ['trend-item','trend-measure'])$(id).addEventListener('change',()=>render());
  for(const id of ['trend-forecast-enabled','trend-forecast-days'])$(id).addEventListener('change',()=>render());
  $('trend-range').addEventListener('change',()=>{const range=$('trend-range').value;if(range==='custom')return;if(range==='all'){$('trend-from').value='';$('trend-through').value='';}else{const now=new Date();now.setMinutes(now.getMinutes()-now.getTimezoneOffset());const through=now.toISOString().slice(0,10),start=new Date(through+'T00:00:00Z');start.setUTCDate(start.getUTCDate()-Number(range)+1);$('trend-from').value=start.toISOString().slice(0,10);$('trend-through').value=through;}render();});
  for(const id of ['trend-from','trend-through'])$(id).addEventListener('change',()=>{$('trend-range').value='custom';render();});
  let resizeFrame;new ResizeObserver(()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>{if(!$('chemical-trends').hidden)render();});}).observe($('trend-chart'));
  root.ChemicalTrends={render,reportOrderAdvice};
})(typeof globalThis!=='undefined'?globalThis:this);
