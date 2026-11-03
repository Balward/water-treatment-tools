'use strict';
const $=id=>document.getElementById(id);
// Illustrative values only. This mockup has no API connections or storage writes.
const items=[
  {id:'hypo',type:'chemical',name:'Sodium Hypochlorite',stock:'1,600',unit:'gal',threshold:'2,000 gal',quantity:4500,orderUnit:'gal',load:'One Bulk Delivery',usage:'100 gal/day',caution:'Below the reorder level. Confirm current tank levels before arranging delivery.',source:'East + West tanks. Sample completed inventory: Oct 28, 2026.'},
  {id:'naoh',type:'chemical',name:'Sodium Hydroxide',stock:'1,800',unit:'gal',threshold:'2,000 gal',quantity:4000,orderUnit:'gal',load:'One Bulk Delivery',usage:'100 gal/day',caution:'A full load fits below about 1,250 gal on hand. At this usage, a Nov 4 delivery would leave about 1,100 gal before unloading. Confirm space in each tank.',source:'3 tanks, about 5,250 usable gal combined. Sample completed inventory: Oct 28, 2026.'},
  {id:'polymer',type:'chemical',name:'Polymer (8103+)',stock:'370',unit:'gal',threshold:'400 gal',quantity:1,orderUnit:'tote',load:'One 265-Gallon Tote',usage:'8 gal/day',caution:'Check stored tote positions before ordering. Up to two totes can be stored on site.',source:'Sample tank inventory: 105 gal; stored inventory: 265 gal. Completed Oct 28, 2026.'},
  {id:'desiccant',type:'supply',name:'Turbidimeter Desiccant Cartridge',stock:'1',unit:'each',threshold:'1 each',quantity:1,orderUnit:'each',load:'Hach · LZY876',source:'Operating Supplies · Sample completed inventory: Oct 28, 2026.'},
  {id:'swiftest',type:'supply',name:'Swiftest Free Chlorine Refill Vial',stock:'1',unit:'vial',threshold:'2 vials',quantity:2,orderUnit:'vials',load:'Hach · 2105560',source:'Operating Supplies · Sample completed inventory: Oct 28, 2026.'}
];
let filter='all',view='pending';const selected=new Set(),placed=new Map();
function render(){
  const history=view==='placed';$('page-title').textContent=history?'Placed Orders':'To Order List';$('page-copy').textContent=history?'Orders recorded during this preview.':'Supplies and chemical deliveries, ready to review in one place.';$('pending-controls').hidden=history;
  for(const id of ['pending','placed']){const button=$(id+'-tab');if(view===id)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');}
  $('pending-count').textContent=items.length-placed.size;$('placed-count').textContent=placed.size;
  for(const button of document.querySelectorAll('[data-filter]')){button.setAttribute('aria-pressed',String(button.dataset.filter===filter));button.querySelector('span').textContent=items.filter(item=>!placed.has(item.id)&&(button.dataset.filter==='all'||item.type===button.dataset.filter)).length;}
  const rows=items.filter(item=>history?placed.has(item.id):!placed.has(item.id)&&(filter==='all'||item.type===filter));
  $('cards').innerHTML=rows.map(item=>{
    const chemical=item.type==='chemical',order=placed.get(item.id);
    return `<article class="card ${item.type}"><div class="card-top"><label class="card-pick">${history?'':`<input type="checkbox" data-pick="${item.id}" ${selected.has(item.id)?'checked':''} aria-label="Select ${item.name}">`}<span><span class="kind">${chemical?'CHEMICAL':'OPERATING SUPPLIES'}</span><h3>${item.name}</h3></span></label><span class="badge ${history?'placed':''}">${history?'Placed':chemical?'Order Now':'At PAR'}</span></div><dl class="metrics"><div><dt>On Hand</dt><dd>${item.stock} <small>${item.unit}</small></dd></div><div><dt>${chemical?'Reorder Level':'PAR'}</dt><dd>${item.threshold}</dd></div></dl><div class="delivery"><strong>${history?order.quantity:item.quantity.toLocaleString()} ${item.orderUnit}${chemical&&!history?' Suggested':''}</strong><p>${item.load}${chemical?' · Supplier Not Set':''}</p></div>${chemical?`<div class="schedule"><div><span>Order By</span>Today · Oct 28</div><div><span>${history?'Scheduled Delivery':'Target Delivery'}</span>${history?order.delivery:'Nov 4, 2026'}</div><div><span>Recent Usage</span>${item.usage}</div></div>`:''}${!history&&item.caution?`<p class="caution">${item.caution}</p>`:''}<details class="source"><summary>Inventory Reference</summary><p>${item.source}</p></details></article>`;
  }).join('');$('empty').hidden=!!rows.length;$('empty').textContent=history?'No orders recorded in this preview yet.':'No pending items in this view.';selection();
}
function selection(){$('review').disabled=!selected.size;$('selection-status').textContent=selected.size?`${selected.size} selected across all types.`:'Select items you want to order.';}
document.querySelectorAll('[data-filter]').forEach(button=>button.onclick=()=>{filter=button.dataset.filter;render();});
$('cards').addEventListener('change',event=>{const id=event.target.dataset.pick;if(!id)return;if(event.target.checked)selected.add(id);else selected.delete(id);selection();});
$('pending-tab').onclick=()=>{view='pending';render();};$('placed-tab').onclick=()=>{view='placed';render();};
$('review').onclick=()=>{
  $('review-items').innerHTML=items.filter(item=>selected.has(item.id)).map(item=>`<section class="review-row"><h3>${item.name}</h3><div class="review-inputs"><label>Quantity (${item.orderUnit})<input data-quantity="${item.id}" type="number" value="${item.quantity}" min="0.01" step="any" required></label>${item.type==='chemical'?`<label>Delivery Date<input data-delivery="${item.id}" type="date" value="2026-11-04" required></label>`:'<p class="dialog-copy">Supply purchase</p>'}</div></section>`).join('');$('review-dialog').showModal();
};
$('close-review').onclick=()=>$('review-dialog').close();
$('review-form').onsubmit=event=>{event.preventDefault();for(const item of items.filter(item=>selected.has(item.id))){placed.set(item.id,{quantity:document.querySelector(`[data-quantity="${item.id}"]`).value,delivery:document.querySelector(`[data-delivery="${item.id}"]`)?.value});}selected.clear();$('review-dialog').close();view='placed';render();};
render();
