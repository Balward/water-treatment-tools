(() => {
  'use strict';
  const $=id=>document.getElementById(id),model=ChemicalInventory;
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number=value=>value===null||value===undefined?'—':value.toLocaleString(undefined,{maximumFractionDigits:2});
  const dateLabel=date=>new Date(date+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
  let saved={revision:0,records:[]},dirty=false,busy=false,loaded=false,summaryDate=null;
  let saveTimer,activeSave=null,editVersion=0,saveFailed=false,editingCompleted=false;
  const complete=record=>!!record&&(record.status||'complete')==='complete';
  const current=()=>saved.records.find(r=>r.date===$('chemical-date').value);
  const phone=navigator.userAgentData?.mobile===true||/iPhone|iPod|Android.*Mobile/i.test(navigator.userAgent);
  const layout=()=>{document.documentElement.dataset.layout=!phone&&innerWidth>=900?'desktop':'mobile';};layout();window.addEventListener('resize',layout);
  function message(text,error=false){$('chemical-status').textContent=text;$('chemical-status').classList.toggle('chemical-status-error',error);}
  function controls(){
    for(const button of document.querySelectorAll('.chemical-actions button,[data-edit-date],[data-view-date],[data-delete-date]'))button.disabled=busy||!!activeSave||!loaded;
    $('reload-chemicals').disabled=busy||!!activeSave;
    for(const input of $('chemical-form').querySelectorAll('input,textarea'))input.disabled=busy||!loaded||!current()||(complete(current())&&!editingCompleted);
    $('chemical-date').disabled=true;
    const count=model.fields.filter(([id])=>{const input=$('reading-'+id);return input.value!==''&&input.validity.valid;}).length;
    $('complete-chemical').hidden=editingCompleted;
    $('save-chemical').textContent=editingCompleted?'Save Changes':'Save Draft';
    $('chemical-progress').textContent=editingCompleted?'Correcting completed inventory - changes save automatically':count+' of '+model.fields.length+' readings entered';
    $('complete-chemical').disabled=busy||!!activeSave||!loaded||!current()||complete(current())||count!==model.fields.length||!$('chemical-operator').value.trim();
    $('chemical-date-notice').hidden=!$('chemical-existing').textContent;
    for(const id of ['chemical-date-warning-icon','chemical-date-warning-title','choose-chemical-date'])$(id).hidden=true;
    $('entry-tab').hidden=!current();

  }
  async function request(url,options={}){const response=await fetch(url,{...options,headers:{'Content-Type':'application/json'}});const result=await response.json();if(!response.ok)throw new Error(result.error||'Could not load chemical inventory.');return result;}
  function numeric(id){const input=$(id);return input.value===''?null:input.valueAsNumber;}
  function draft(){return{...(current()?.source?.type==='workbook'?{recordedGallons:Object.fromEntries(model.chemicals.map(c=>[c.id,numeric('snapshot-'+c.id)]))}:{}),date:$('chemical-date').value,operator:$('chemical-operator').value.trim(),notes:$('chemical-notes').value,readings:Object.fromEntries(model.fields.map(([id])=>[id,numeric('reading-'+id)]))};}
  $('chemical-fields').innerHTML=model.chemicals.map(c=>'<section class="chemical-card"><h2>'+escape(c.name)+'</h2><div class="chemical-inputs">'+c.fields.map(([id,label,unit])=>'<label><span>'+escape(label)+'<small>'+escape(unit)+'</small></span><input id="reading-'+id+'" data-reading="'+id+'" type="number" inputmode="decimal" min="0" max="1000000000" step="any"></label>').join('')+'</div></section>').join('');
  const snapshotFields=document.createElement('section');snapshotFields.id='chemical-snapshot-fields';snapshotFields.className='chemical-card';snapshotFields.hidden=true;
  snapshotFields.innerHTML='<h2>Recorded Gallons</h2><p class="report-note">Correct the original workbook totals directly. Historical tank formulas are preserved.</p><div class="chemical-inputs">'+model.chemicals.map(c=>'<label><span>'+escape(c.name)+'<small>gal</small></span><input id="snapshot-'+c.id+'" type="number" min="0" max="1000000000" step="any" inputmode="decimal"></label>').join('')+'</div>';
  $('chemical-fields').before(snapshotFields);
  function loadDate(){
    const record=current();
    if(complete(record)&&!editingCompleted){dirty=false;showSummary(record.date);return;}
    const imported=record?.source?.type==='workbook';
    $('chemical-snapshot-fields').hidden=!imported;$('chemical-fields').hidden=imported;
    for(const id of ['salt','nwos'])$('reading-'+id).closest('section').hidden=imported;
    for(const chemical of model.chemicals)$('snapshot-'+chemical.id).value=record?.recordedGallons?.[chemical.id]??'';
    for(const [id]of model.fields)$('reading-'+id).value=record?.readings[id]??'';
    $('chemical-operator').value=record?.operator||$('chemical-operator').value;$('chemical-notes').value=record?.notes||'';
    $('chemical-existing').textContent=record?'Editing saved readings · '+record.operator:'';
    dirty=false;saveFailed=false;editVersion++;controls();
  }
  function tab(view){const history=view===true||view==='history',trends=view==='trends';$('chemical-summary').hidden=true;$('chemical-entry').hidden=history||trends;$('chemical-history').hidden=!history;$('chemical-trends').hidden=!trends;$('entry-tab').setAttribute('aria-pressed',String(!history&&!trends));$('history-tab').setAttribute('aria-pressed',String(history));$('trends-tab').setAttribute('aria-pressed',String(trends));if(trends)ChemicalTrends.render(saved.records);$('trends-tab').parentElement.querySelector('[aria-pressed="true"]')?.scrollIntoView({block:'nearest',inline:'nearest'});}
  function inventoryTable(record,large=false){return'<div class="chemical-table-wrap"><table class="chemical-table'+(large?' chemical-summary-table':'')+'"><thead><tr><th>Chemical</th><th>On Hand (gal)</th></tr></thead><tbody>'+model.chemicals.map(c=>'<tr><th scope="row">'+escape(c.name)+'</th><td>'+number(record.totals[c.id].gallons)+'</td></tr>').join('')+'</tbody></table></div>';}
  function extraInventory(record){return'<p class="chemical-summary-meta">Salt: '+number(record.readings.salt)+' pallets<br>East permanganate (10% batch): '+number(record.readings.permEast)+' in<br>Northwest Open Space meter: '+number(record.readings.nwos)+' × 1,000 gal<br>Water used: '+(record.nwosReset?'Review meter reset':number(record.nwosUsed)+' gal')+'</p>';}
  function reportDetails(record){
    if(record.source?.type==='workbook')return '';
    return '<details class="chemical-report-details"><summary>Readings &amp; Calculation Details</summary>'+model.chemicals.map(c=>'<section><h3>'+escape(c.name)+'</h3><dl>'+c.fields.map(([id,label,unit])=>'<div><dt>'+escape(label)+'</dt><dd>'+number(record.readings[id])+' '+escape(unit)+'</dd></div>').join('')+'</dl><p>'+escape(record.settingsSnapshot?ChemicalSettings.formula(record.settingsSnapshot[c.id]):c.formula)+'</p>'+(c.note?'<p>'+escape(c.note)+'</p>':'')+(['polymer','permanganate'].includes(c.id)?'<p>1 IBC tote = '+number(record.settingsSnapshot?.[c.id]?.delivery??265)+' gal.</p>':'')+'</section>').join('')+'<p>Salt: 49 bags of 50 lb per pallet.'+(record.readings.salt===null?'':' Approximately '+Math.round(record.readings.salt*49).toLocaleString()+' bags / '+number(record.readings.salt*2450)+' lb.')+'</p><p>Calculations use the settings saved with this inventory. Original baseline: Weekly Chemical Inventory, October 21, 2026.</p></details>';
  }
  function reportReadings(record){
    if(record.source?.type==='workbook')return '';
    return '<section class="chemical-report-readings"><h3>Recorded Tank Levels &amp; Stored Inventory</h3><div class="chemical-report-grid">'+model.chemicals.map(c=>'<article><h4>'+escape(c.name)+'</h4><dl>'+c.fields.map(([id,label,unit])=>'<div><dt>'+escape(label)+'</dt><dd>'+number(record.readings[id])+' '+escape(unit)+'</dd></div>').join('')+'</dl></article>').join('')+'</div></section>';
  }
  function reportOrders(record){
    const advice=ChemicalTrends.reportOrderAdvice(saved.records,record),dayMs=86400000;
    const dateAt=days=>Math.abs(days)<=3650?dateLabel(new Date(Date.parse(record.date)+Math.floor(days)*dayMs).toISOString().slice(0,10)):'Beyond 10-Year Estimate';
    const now=new Date();now.setMinutes(now.getMinutes()-now.getTimezoneOffset());const age=(Date.parse(now.toISOString().slice(0,10))-Date.parse(record.date))/dayMs;
    return '<section class="chemical-report-orders"><h3>Order Guidance</h3><p class="report-note">As of '+escape(dateLabel(record.date))+'. Uses recent net drawdown and the delivery lead time saved for each chemical. '+(!complete(record)?'Draft guidance is provisional until all readings are entered. ':'')+(age>14?'This is an older reading. Check current levels before placing an order.':'')+'</p><div class="chemical-report-grid">'+advice.map(({key,decision,forecast,plan})=>{
      const name=model.chemicals.find(c=>c.id===key).name;
      let details=plan?'<dl><div><dt>On Hand</dt><dd>'+number(plan.gallons)+' gal</dd></div><div><dt>Reorder Level</dt><dd>'+number(plan.threshold)+' gal</dd></div></dl>':'<p>No gallons calculated for this chemical. Enter its required readings to assess ordering.</p>';
      if(plan&&forecast.available)details+='<p>Recent net drawdown: <strong>'+number(forecast.ratePerDay)+' gal/day</strong> ('+forecast.intervals+' intervals).</p>';
      if(plan?.orderDays!==undefined)details+='<dl><div><dt>Order By</dt><dd>'+(decision==='Order Now'?'Now':escape(dateAt(plan.orderDays)))+'</dd></div><div><dt>Target Delivery</dt><dd>'+escape(dateAt(Math.ceil(plan.deliveryDays)))+'</dd></div></dl>';
      else if(plan)details+='<p>'+escape(forecast.available?'No recent net drawdown to estimate a delivery date.':forecast.reason)+'</p>';
      if(plan?.daysToZero!==undefined&&plan.daysToZero<plan.leadDays)details+='<p class="chemical-warning">Less than '+plan.leadDays+' days of estimated supply remain. Contact the supplier to arrange delivery.</p>';
      if(plan&&plan.deliveryLevel<plan.threshold)details+='<p class="chemical-warning">A full '+number(plan.delivery)+' gal load needs inventory at or below '+number(plan.deliveryLevel)+' gal to fit. Coordinate a smaller load or delivery timing.</p>';
      if(plan?.storedField)details+='<p>Delivered in '+number(plan.delivery)+' gal totes. Confirm a free tote position; maximum '+(plan.storedTotes??2)+' stored totes. Partial totes still occupy a position.</p>';
      if(plan&&plan.gallons>plan.capacity)details+='<p class="chemical-warning">Recorded stock exceeds approximate usable capacity. Verify levels and capacity before ordering.</p>';
      return '<article data-order-chemical="'+key+'"><h4>'+escape(name)+'</h4><strong class="chemical-order-decision '+(decision==='Order Now'?'is-due':'')+'">'+escape(decision)+'</strong>'+details+'</article>';
    }).join('')+'</div><p class="report-note">Estimates assume the recent rate continues without replenishment; stock increases are excluded. Verify individual tank space before accepting a delivery. No order is sent automatically.</p></section>';
  }
  function showSummary(date,justSaved=false){
    const record=saved.records.find(r=>r.date===date);if(!record)return;
    history.replaceState(null,'','?date='+encodeURIComponent(date)+'&view=report');
    editingCompleted=false;selectedDate=$('chemical-date').value=date;summaryDate=date;tab(false);$('chemical-entry').hidden=true;$('chemical-summary').hidden=false;
    $('entry-tab').hidden=false;$('entry-tab').setAttribute('aria-pressed','false');$('chemical-saved-banner').hidden=!justSaved;
    $('chemical-summary-title').textContent='Inventory · '+dateLabel(date);
    const imported=record.source?.type==='workbook';
    $('chemical-summary-title').textContent=(complete(record)?'Completed Inventory':'Draft Report')+' \u00b7 '+dateLabel(date);
    $('chemical-saved-banner').textContent=complete(record)?'Inventory Completed Successfully':'Draft Saved Successfully';
    $('summary-edit').hidden=false;$('summary-edit').textContent=complete(record)?'Edit Inventory':'Resume Inventory';
    $('chemical-summary-content').innerHTML='<p class="chemical-summary-meta">'+escape(record.operator)+(imported?'':' · Saved '+escape(new Date(record.updatedAt).toLocaleString()))+'</p>'+(imported?'<p class="chemical-import-note">Imported from the 2026 workbook. These are the gallons recorded on this date, preserved without recalculating historical tank formulas. Tank levels and salt were not imported.</p>':'')+inventoryTable(record,true)+reportReadings(record)+extraInventory(record)+reportOrders(record)+(record.notes?'<p class="chemical-note-copy">'+escape(record.notes)+'</p>':'')+reportDetails(record);
    window.scrollTo({top:0,behavior:'instant'});$('chemical-summary-title').focus({preventScroll:true});
  }
  async function openEditor(date){
    if((dirty||activeSave)&&!await saveReading())return;
    clearTimeout(saveTimer);
    const unfinished=saved.records.find(r=>r.status==='draft');
    if(!saved.records.some(r=>r.date===date)&&unfinished)date=unfinished.date;
    editingCompleted=complete(saved.records.find(r=>r.date===date));
    selectedDate=$('chemical-date').value=date;
    history.replaceState(null,'','?date='+encodeURIComponent(date)+(editingCompleted?'&view=edit':''));
    tab(false);loadDate();window.scrollTo({top:0,behavior:'instant'});$('chemical-date').focus({preventScroll:true});
  }
  function renderHistory(){
    $('chemical-history-list').innerHTML=saved.records.length?saved.records.map(record=>{
      const imported=record.source?.type==='workbook';
      return '<article class="chemical-history-card"><h3>'+escape(dateLabel(record.date))+' <span class="badge '+(complete(record)?'ok':'')+'">'+(complete(record)?'Completed':'Draft')+'</span></h3><p>'+escape(record.operator)+(imported?' / Imported Workbook':'')+'</p>'+inventoryTable(record)+extraInventory(record)+(record.notes?'<p class="chemical-note-copy">'+escape(record.notes)+'</p>':'')+'<div class="chemical-history-actions"><button type="button" data-view-date="'+record.date+'">View Report</button>'+'<button type="button" data-edit-date="'+record.date+'">Edit</button>'+'<button type="button" data-delete-date="'+record.date+'">Delete</button></div></article>';
    }).join(''):'<div class="empty">No chemical readings recorded yet.</div>';ChemicalTrends.render(saved.records);controls();
  }
  async function refresh(){busy=true;controls();try{
    saved=await request('/api/chemicals');loaded=true;
    const query=new URLSearchParams(location.search),requested=query.get('date'),unfinished=saved.records.find(r=>r.status==='draft');
    const explicitRecord=requested&&saved.records.find(r=>r.date===requested);
    editingCompleted=!!explicitRecord&&complete(explicitRecord)&&query.get('view')==='edit';
    $('chemical-date').value=selectedDate=explicitRecord?requested:unfinished?.date||'';
    loadDate();renderHistory();
    if(explicitRecord&&!editingCompleted&&(query.get('view')==='report'||complete(explicitRecord)))showSummary(selectedDate);else tab(!current());
    message('');
  }catch(error){message(error.message,true);}finally{busy=false;controls();}}
  function scheduleSave(){clearTimeout(saveTimer);if(!loaded||saveFailed||!dirty||!$('chemical-date').value||!$('chemical-operator').value.trim()||!current()||(complete(current())&&!editingCompleted))return;saveTimer=setTimeout(()=>void saveReading(),650);}
  async function saveReading(status='draft'){
    clearTimeout(saveTimer);
    if(activeSave){if(!await activeSave)return false;}
    if(complete(current())&&!editingCompleted)return true;
    if(editingCompleted)status='complete';
    if(!current()){message('Start a new inventory from Inventory Home.',true);return false;}
    if(!$('chemical-operator').value.trim()){message('Choose an operator from the name list.',true);$('chemical-operator').focus();return false;}
    if(!dirty&&current()&&status==='draft')return true;
    if(!$('chemical-form').checkValidity()){$('chemical-form').reportValidity();return false;}
    const version=editVersion,record=draft();message(status==='complete'?'Completing inventory...':'Saving...');
    activeSave=(async()=>{try{saved=await request('/api/chemicals/records/'+record.date,{method:'PUT',body:JSON.stringify({...record,status,revision:saved.revision,...(editingCompleted?{editCompleted:true}:{})})});if(version===editVersion)dirty=false;saveFailed=false;history.replaceState(null,'','?date='+encodeURIComponent(record.date)+(editingCompleted?'&view=edit':''));renderHistory();message(dirty?'Changes waiting to save...':editingCompleted?'Changes saved':status==='complete'?'Chemical inventory completed.':'All changes saved');return true;}catch(error){saveFailed=true;message(error.message,true);return false;}})();
    controls();const result=await activeSave;activeSave=null;controls();if(result&&dirty&&(status!=='complete'||editingCompleted))scheduleSave();return result;
  }
  $('chemical-form').addEventListener('input',event=>{if(event.target.id==='chemical-date')return;dirty=true;editVersion++;controls();scheduleSave();});
  let selectedDate=$('chemical-date').value;
  $('entry-tab').addEventListener('click',async()=>{if(!current())return;if((dirty||activeSave)&&!await saveReading())return;if(complete(current()))showSummary(current().date);else await openEditor(current().date);});$('history-tab').addEventListener('click',()=>tab(true));
  $('trends-tab').addEventListener('click',async()=>{if(busy)return;if((dirty||activeSave)&&!await saveReading())return;location.assign('./trends.html?view=chemicals');});
  document.addEventListener('chemical:open-inventory',event=>showSummary(event.detail.date));
  $('reload-chemicals').addEventListener('click',()=>{if(!dirty||confirm('Discard unsaved entries and reload saved readings?')){clearTimeout(saveTimer);refresh();}});
  $('chemical-form').addEventListener('submit',async event=>{
    event.preventDefault();if(busy||!loaded)return;await saveReading();
  });
  $('chemical-report').addEventListener('click',async()=>{if(await saveReading())showSummary($('chemical-date').value,true);});
  $('complete-chemical').addEventListener('click',async()=>{busy=true;controls();try{if(await saveReading('complete'))showSummary($('chemical-date').value,true);}finally{busy=false;controls();}});
  $('chemical-history-list').addEventListener('click',async event=>{
    const edit=event.target.closest('[data-edit-date]'),view=event.target.closest('[data-view-date]'),remove=event.target.closest('[data-delete-date]');if(busy||activeSave||!loaded)return;
    if(edit)openEditor(edit.dataset.editDate);
    if(view){if((dirty||activeSave)&&!await saveReading())return;showSummary(view.dataset.viewDate);}
    if(remove){
      if(dirty&&!await saveReading())return;clearTimeout(saveTimer);
      const date=remove.dataset.deleteDate;if(!confirm('Delete chemical inventory for '+dateLabel(date)+'? Following water-usage figures will recalculate.'))return;
      busy=true;controls();try{saved=await request('/api/chemicals/records/'+date,{method:'DELETE',body:JSON.stringify({revision:saved.revision})});loadDate();renderHistory();message('Chemical inventory deleted.');}catch(error){message(error.message,true);}finally{busy=false;controls();}
    }
  });
  $('summary-edit').addEventListener('click',()=>openEditor(summaryDate));
  $('summary-history').addEventListener('click',()=>tab(true));
  document.querySelector('.chemical-back').addEventListener('click',async event=>{event.preventDefault();const destination=event.currentTarget.href;if((!dirty&&!activeSave)||await saveReading())location.assign(destination);});
  window.addEventListener('beforeunload',event=>{if(dirty||activeSave){event.preventDefault();event.returnValue='';}});
  document.addEventListener('operations:before-navigate',event=>{event.detail.waitUntil((dirty||activeSave)?saveReading():Promise.resolve(true));});
  controls();refresh();
})();
