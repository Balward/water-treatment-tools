(() => {
  'use strict';
  const $=id=>document.getElementById(id),keys=['influentFlow','filterFlow','alum','polymer','naoh','hypochlorite','permanganate'];
  let context;
  const draftKey=()=>`plant-rounds-drawdown-reference-draft:${context.date}:${context.shift}`;
  let revision=0,busy=false,dirty=false,loaded=false;
  const inputs=()=>keys.map(key=>$('ref-'+key));
  function values(){return Object.fromEntries(keys.map(key=>[key,$('ref-'+key).value===''?null:Number($('ref-'+key).value)]));}
  function showError(message){$('referenceError').textContent=message;$('referenceError').hidden=!message;}
  function setBusy(value){busy=value;for(const el of [...inputs(),$('referenceOperator'),$('saveReference'),$('reloadReference')])el.disabled=value;}
  function stamp(record){
    $('referenceStatus').textContent=record.updatedAt?'Last updated by '+record.updatedBy+' · '+new Intl.DateTimeFormat(undefined,{timeZone:'America/Denver',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(record.updatedAt))+' (Denver)':'No reference values saved yet.';
  }
  async function request(options={}){
    const response=await fetch('/api/plant-rounds/'+encodeURIComponent(context.date)+'/'+context.shift+'/drawdown-reference',{cache:'no-store',signal:AbortSignal.timeout(12000),...options,headers:{'Content-Type':'application/json'}});
    const record=await response.json();if(!response.ok)throw new Error(record.error || 'Reference values could not be saved.');return record;
  }
  function saveDraft(){
    dirty=true;$('referenceStatus').textContent='Unsaved changes';
    try{localStorage.setItem(draftKey(),JSON.stringify({revision,values:Object.fromEntries(keys.map(key=>[key,$('ref-'+key).value]))}));}catch{showError('Your draft cannot be retained on this device. Keep this panel open until you save.');}
  }
  async function load(restoreDraft){
    if(busy)return;setBusy(true);showError('');loaded=false;$('referenceStatus').textContent='Loading this shift’s reference values…';for(const input of inputs())input.value='';
    try{
      const record=await request();revision=record.revision;for(const key of keys)$('ref-'+key).value=record.values[key] ?? '';dirty=false;stamp(record);loaded=true;
      let draft;try{draft=JSON.parse(localStorage.getItem(draftKey()));}catch{}
      if(restoreDraft && draft?.values){
        revision=draft.revision;for(const key of keys)$('ref-'+key).value=draft.values[key] ?? '';dirty=true;
        $('referenceStatus').textContent='Unsaved draft restored on this device.';
        if(draft.revision!==record.revision)showError('This shift’s values changed since this draft was entered. Reload saved values before making your changes.');
      }else if(!restoreDraft){try{localStorage.removeItem(draftKey());}catch{}}
    }catch(error){showError('Reference values could not be loaded. '+error.message);}
    finally{setBusy(false);$('saveReference').disabled=!loaded;}
  }
  window.DrawdownReference={open(selected){
    if($('referenceDialog').open)return;
    context={date:selected.date,shift:selected.shift};
    const operator=selected.operator;
    $('referenceContext').textContent=new Date(context.date+'T12:00:00Z').toLocaleDateString(undefined,{timeZone:'UTC',weekday:'short',month:'short',day:'numeric',year:'numeric'})+' · '+context.shift+' Rounds';
    if(operator && [...$('referenceOperator').options].some(option=>option.value===operator))$('referenceOperator').value=operator;
    $('referenceDialog').showModal();void load(true);
  }};
  for(const input of inputs())input.addEventListener('input',saveDraft);
  $('referenceForm').onsubmit=async event=>{
    event.preventDefault();if(busy || !loaded)return;setBusy(true);showError('');
    try{
      const record=await request({method:'PUT',body:JSON.stringify({revision,operator:$('referenceOperator').value,values:values()})});
      revision=record.revision;dirty=false;try{localStorage.removeItem(draftKey());}catch{}stamp(record);
      window.dispatchEvent(new CustomEvent('rounds:reference-saved',{detail:context}));
    }catch(error){showError(error.message+' Your entries are still in this panel.');}
    finally{setBusy(false);}
  };
  $('reloadReference').onclick=()=>{if(!dirty || confirm('Discard this draft and load the latest shared reference values?'))void load(false);};
  $('closeReference').onclick=()=>{if(!busy)$('referenceDialog').close();};
  $('referenceDialog').addEventListener('cancel',event=>{if(busy)event.preventDefault();});
  window.addEventListener('beforeunload',event=>{if(busy){event.preventDefault();event.returnValue='';}});
})();
