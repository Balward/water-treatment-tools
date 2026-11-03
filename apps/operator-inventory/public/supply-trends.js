'use strict';
(()=>{
const $=id=>document.getElementById(id), math=SupplyTrendMath;
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=value=>value===null||value===undefined?'Manual / Not Set':Number(value).toLocaleString(undefined,{maximumFractionDigits:3});
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Denver',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
let catalog,records=[],items=[],results=[],saving=false;
async function api(route,options={}) {
  const response=await fetch(route,{...options,headers:{'Content-Type':'application/json'}}), data=await response.json();
  if(!response.ok)throw new Error(data.error||'Unable to load inventory data.');
  return data;
}
function status(message,error=false){$('supply-status').textContent=message;$('supply-status').classList.toggle('error',error);}
function chart(item,points) {
  if(!points.length)return '<p>No compatible completed counts in this window.</p>';
  const w=900,h=300,left=65,right=25,top=25,bottom=48,dates=points.map(p=>Date.parse(p.date+'T00:00:00Z'));
  const min=dates[0],max=dates.at(-1),ceiling=Math.max(1,...points.map(p=>p.count),item.par||0)*1.12;
  const x=date=>left+(max===min?.5:(date-min)/(max-min))*(w-left-right),y=value=>h-bottom-value/ceiling*(h-top-bottom);
  const grid=Array.from({length:5},(_,i)=>{const v=ceiling*i/4;return `<line x1="${left}" x2="${w-right}" y1="${y(v)}" y2="${y(v)}" stroke="#d6e0e4"/><text x="${left-10}" y="${y(v)+5}" text-anchor="end">${number(v)}</text>`;}).join('');
  const par=typeof item.par==='number'?`<path d="M${left} ${y(item.par)}H${w-right}" stroke="#a15a00" stroke-width="2" stroke-dasharray="8 5"/><text x="${w-right}" y="${Math.max(15,y(item.par)-8)}" text-anchor="end">Current PAR ${number(item.par)}</text>`:'';
  return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="On-hand counts over time. Exact counts and dates are available in Recorded Counts below.">${grid}${par}<polyline points="${points.map((p,i)=>`${x(dates[i])},${y(p.count)}`).join(' ')}" fill="none" stroke="#00677f" stroke-width="3"/>${points.map((p,i)=>`<circle cx="${x(dates[i])}" cy="${y(p.count)}" r="5"><title>${escape(p.date)}: ${number(p.count)} ${escape(item.countSize)}</title></circle>`).join('')}<text x="${left}" y="${h-12}">${escape(points[0].date)}</text><text x="${w-right}" y="${h-12}" text-anchor="end">${points.length>1?escape(points.at(-1).date):''}</text></svg>`;
}
function renderReview(){
  const query=$('supply-search').value.trim().toLowerCase();
  $('supply-review').innerHTML=results.filter(({item})=>[item.description,item.company,item.location].join(' ').toLowerCase().includes(query)).map(({item,points,review})=>`<tr><td><button type="button" data-item="${escape(item.id)}">${escape(item.description)}</button><small>${escape(item.location)}</small></td><td>${escape(item.countSize)}</td><td>${number(item.par)}</td><td>${review.ready?number(review.suggested):'More History Needed'}</td><td>${points.length} counts / ${review.intervals} eligible intervals${points.length?`<small>Latest: ${escape(points.at(-1).date)}</small>`:''}</td></tr>`).join('')||'<tr><td colspan="5">No matching items.</td></tr>';
}
function renderItem(){
  const result=results.find(r=>r.item.id===$('supply-item').value); if(!result)return;
  const {item,points,review,incompatible}=result,latest=points.at(-1);
  $('supply-item-details').textContent=[item.company,item.itemNumber,item.countSize,item.caseSize].filter(Boolean).join(' · ');
  $('supply-stats').innerHTML=`<div>Latest On Hand<strong>${latest?number(latest.count):'No Counts'}</strong></div><div>Current PAR<strong>${number(item.par)}</strong></div><div>Estimated PAR<strong>${review.ready?number(review.suggested):'Need History'}</strong></div>`;
  $('supply-chart').innerHTML=chart(item,points);
  $('supply-evidence').textContent=`${points.length} completed counts; ${review.intervals} eligible intervals (${review.days} days). `+(review.rate!==null?`Observed net decline: ${number(review.rate)} ${item.countSize} per day. `:'')+(review.ready?`Estimated PAR: ${number(review.suggested)} ${item.countSize}.`:'More evidence is needed before suggesting a PAR.');
  const cautions=['Net decline may underestimate use when stock is replenished between counts.'];
  if(review.increases)cautions.push(`${review.increases} increasing interval(s) excluded; possible restocking or corrections.`);
  if(review.longGaps)cautions.push(`${review.longGaps} gap(s) over 45 days excluded.`);
  if(review.zeros)cautions.push('Zero stock was recorded; unmet demand is not captured.');
  if(incompatible)cautions.push(`${incompatible} count(s) excluded because the product or count unit changed.`);
  if(latest&&(Date.parse(today)-Date.parse(latest.date))/86400000>30)cautions.push('Latest count is over 30 days old. Take a new count before relying on this estimate.');
  if(item.par===null)cautions.push('This item currently uses manual review. Consider whether a numeric PAR is appropriate.');
  $('supply-cautions').textContent=cautions.join(' ');
  const save=$('save-supply-par');save.hidden=!review.ready||item.par===review.suggested;save.disabled=saving;save.textContent=`Save PAR Of ${number(review.suggested)} ${item.countSize} For Future Inventories`;
  $('supply-readings').innerHTML=points.slice().reverse().map(p=>`<tr><td>${escape(p.date)}</td><td>${number(p.count)}</td><td>${number(p.par)}</td><td>${escape(p.operator)}</td></tr>`).join('')||'<tr><td colspan="4">No counts to display.</td></tr>';
}
function render(){
  if(!$('supply-planning').checkValidity()){status('Enter valid planning values to update the estimates.',true);$('save-supply-par').hidden=true;return;}
  let from='0001-01-01';
  if($('supply-window').value!=='all'){const date=new Date(today+'T00:00:00Z');date.setUTCDate(date.getUTCDate()-Number($('supply-window').value));from=date.toISOString().slice(0,10);}
  const options={lead:Number($('supply-lead').value),interval:Number($('supply-interval').value),buffer:Number($('supply-buffer').value),increment:Number($('supply-increment').value)};
  results=items.map(item=>{const data=math.series(item,records,from,today);return {item,...data,review:math.review(data.points,options)};});
  renderReview();renderItem();
  status(`${results.filter(r=>r.review.ready).length} of ${items.length} items have enough recorded history for a PAR estimate. Planning defaults: 7-day lead time, weekly review, 50% buffer; adjust for your suppliers.`);
}
async function load(){
  try {
    [catalog,records]=await Promise.all([api('/api/catalog'),api('/api/supply-trends')]);
    items=catalog.items.filter(i=>i.sourceSheet===1).sort((a,b)=>a.description.localeCompare(b.description));
    $('supply-item').innerHTML=items.map(item=>`<option value="${escape(item.id)}">${escape(item.description)}</option>`).join('');render();
  }catch(error){status(error.message+' Reload the page to retry.',true);}
}
$('supply-planning').addEventListener('submit',event=>event.preventDefault());
$('supply-planning').addEventListener('input',()=>{if(!saving)render();});
$('supply-item').addEventListener('change',renderItem);$('supply-search').addEventListener('input',renderReview);
$('supply-review').addEventListener('click',event=>{const button=event.target.closest('[data-item]');if(!button)return;$('supply-item').value=button.dataset.item;renderItem();$('item-trend-title').scrollIntoView({block:'start'});$('supply-item').focus({preventScroll:true});});
$('save-supply-par').addEventListener('click',async()=>{
  if(saving||!$('supply-planning').checkValidity())return;
  const selected=results.find(r=>r.item.id===$('supply-item').value);if(!selected?.review.ready)return;
  const {item,review}=selected;saving=true;
  document.querySelectorAll('main input,main select,main button').forEach(control=>control.disabled=true);
  try {
    catalog=await api('/api/catalog/items/'+encodeURIComponent(item.id),{method:'PATCH',body:JSON.stringify({...item,worksheet:'operating',revision:catalog.revision,par:review.suggested})});
    items=catalog.items.filter(i=>i.sourceSheet===1).sort((a,b)=>a.description.localeCompare(b.description));render();status(`Saved PAR of ${number(review.suggested)} ${item.countSize} for ${item.description}. Future inventories will use this PAR.`);
  }catch(error){status(error.message+' Reload to verify the saved PAR before trying again.',true);}
  finally {saving=false;document.querySelectorAll('main input,main select,main button').forEach(control=>control.disabled=false);}
});
load();
})();
