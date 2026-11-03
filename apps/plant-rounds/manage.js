(() => {
  'use strict';
  const $=id=>document.getElementById(id),node=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
  let catalog,editing=null,busy=false;
  const typeNames={number:'Number',check:'Checkbox',yesno:'Yes / No',text:'Text'};
  function message(text){$('manageMessage').textContent=text;$('manageMessage').hidden=!text;}
  async function request(path,options={}){
    const response=await fetch('/api/plant-rounds'+path,{cache:'no-store',signal:AbortSignal.timeout(15000),...options,headers:{'Content-Type':'application/json'}});
    const body=await response.json();if(!response.ok)throw new Error(body.error || 'The checklist could not be saved.');return body;
  }
  function setBusy(value){busy=value;$('saveItem').disabled=value;$('refreshItems').disabled=value;$('newItem').disabled=value;document.querySelectorAll('#itemList button,#itemForm input,#itemForm select,#cancelItem').forEach(e=>e.disabled=value);}
  function render(){
    const list=$('itemList');list.replaceChildren();
    const items=catalog.fields.filter(f=>(!$('filterLocation').value || f.location===$('filterLocation').value) && (f.label+' '+f.section).toLowerCase().includes($('searchItems').value.toLowerCase()));
    $('itemCount').textContent=items.length+' Items';
    for(const field of items){
      const row=node('article','manage-item'),info=node('div','');info.append(node('h3','',field.label));
      info.append(node('p','',catalog.locations.find(l=>l.id===field.location).label+' · '+field.section));
      info.append(node('p','',typeNames[field.type]+' · '+field.shifts.join(' + ')+' · '+(field.required?'Required':'Optional')+(field.unit?' · '+field.unit:'')));
      const actions=node('div','review-actions');
      const edit=node('button','','Edit');edit.onclick=()=>open(field);edit.disabled=busy;
      const remove=node('button','delete-item','Remove');remove.onclick=()=>void removeItem(field);remove.disabled=busy;
      edit.setAttribute('aria-label','Edit '+field.label);remove.setAttribute('aria-label','Remove '+field.label);
      actions.append(edit,remove);row.append(info,actions);list.append(row);
    }
    if(!items.length)list.append(node('p','empty','No items match this filter.'));
  }
  function sectionMode(){
    const creating=$('itemSection').value==='';
    $('newSectionLabel').hidden=!creating;$('newSectionName').required=creating;
  }
  function populateSections(preferred){
    const sections=[...new Set(catalog.fields.filter(field=>field.location===$('itemLocation').value).map(field=>field.section))].sort();
    $('itemSection').replaceChildren();
    for(const section of sections)$('itemSection').append(new Option(section,section));
    $('itemSection').append(new Option('New Section…',''));
    $('itemSection').value=sections.includes(preferred)?preferred:sections.includes('Readings And Checks')?'Readings And Checks':sections[0] || '';
    sectionMode();
  }
  function open(field){
    if(busy)return;editing=field || null;$('itemForm').reset();$('newSectionName').setCustomValidity('');
    $('formTitle').textContent=field?'Edit Item':'Add Item';$('itemLabel').value=field?.label || '';
    $('itemLocation').value=field?.location || $('filterLocation').value || catalog.locations[0].id;
    populateSections(field?.section);$('itemType').value=field?.type || 'check';$('itemUnit').value=field?.unit || '';
    $('itemRequired').checked=field?.required ?? true;$('itemAM').checked=field?field.shifts.includes('AM'):true;$('itemPM').checked=field?field.shifts.includes('PM'):true;
    $('unitLabel').hidden=$('itemType').value!=='number';$('itemError').hidden=true;$('itemDialog').showModal();
  }
  async function removeItem(field){
    if(busy || !$('managerName').reportValidity())return;
    if(!confirm('Remove "'+field.label+'" from new rounds? Saved dates will keep this item and its readings.'))return;
    setBusy(true);message('');
    try{catalog=await request('/items/'+encodeURIComponent(field.id),{method:'DELETE',body:JSON.stringify({operator:$('managerName').value.trim(),revision:catalog.revision})});render();message('Item removed from new rounds. Saved dates are unchanged.');}
    catch(error){message(error.message);}finally{setBusy(false);}
  }
  async function load(){
    if(busy)return;setBusy(true);message('Loading checklist…');
    try{
      await window.RoundsUsers.refresh();catalog=await request('/template');
      for(const id of ['filterLocation','itemLocation']){$(id).replaceChildren();if(id==='filterLocation')$(id).append(new Option('All Locations',''));for(const l of catalog.locations)$(id).append(new Option(l.label,l.id));}
      render();message('');
    }catch(error){message(error.message+' Use Refresh to try again.');}finally{setBusy(false);if(!catalog)$('newItem').disabled=true;}
  }
  $('itemForm').onsubmit=async event=>{
    event.preventDefault();if(busy || !$('managerName').reportValidity())return;
    const scheduled=['AM','PM'].filter(shift=>$('item'+shift).checked);
    if(!scheduled.length){$('itemError').textContent='Select AM, PM, or both.';$('itemError').hidden=false;return;}
    const section=($('itemSection').value || $('newSectionName').value).trim();
    if(!section){$('newSectionName').setCustomValidity('Enter a section name.');$('newSectionName').reportValidity();return;}
    const body={operator:$('managerName').value.trim(),revision:catalog.revision,item:{label:$('itemLabel').value.trim(),location:$('itemLocation').value,section,type:$('itemType').value,unit:$('itemUnit').value.trim(),required:$('itemRequired').checked,shifts:scheduled}};
    setBusy(true);$('itemError').hidden=true;
    try{catalog=await request('/items'+(editing?'/'+encodeURIComponent(editing.id):''),{method:editing?'PUT':'POST',body:JSON.stringify(body)});$('itemDialog').close();render();message('Checklist saved. Changes apply to new daily records.');}
    catch(error){$('itemError').textContent=error.message;$('itemError').hidden=false;}finally{setBusy(false);}
  };
  $('newItem').onclick=()=>{if($('managerName').reportValidity())open();};$('cancelItem').onclick=()=>$('itemDialog').close();
  $('itemDialog').addEventListener('cancel',event=>{if(busy)event.preventDefault();});
  $('itemType').onchange=()=>{$('unitLabel').hidden=$('itemType').value!=='number';};
  $('itemSection').onchange=sectionMode;$('newSectionName').oninput=()=>$('newSectionName').setCustomValidity('');
  $('itemLocation').onchange=()=>populateSections($('itemSection').value);
  $('filterLocation').onchange=render;$('searchItems').oninput=()=>{if(catalog)render();};$('refreshItems').onclick=()=>void load();
  try{$('managerName').value=JSON.parse(localStorage.getItem('plant-rounds-operator')) || '';}catch{}
  void load();
})();
