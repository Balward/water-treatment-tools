(() => {
  'use strict';
  const endpoint=document.body.dataset.opsApp==='inventory'?'https://water.gibbhub.io/api/operations/users':'/api/operations/users';
  let pending;
  async function active(){
    if(pending)return pending;
    pending=(async()=>{
      let response=await fetch(endpoint,{cache:'no-store',signal:AbortSignal.timeout(10000)});
      // Existing suite deployments expose the same directory through Plant Rounds.
      if(response.status===404)response=await fetch(endpoint.replace('/operations/users','/plant-rounds/users'),{cache:'no-store',signal:AbortSignal.timeout(10000)});
      if(!response.ok)throw new Error('The user directory is unavailable. Try again.');
      const result=await response.json();
      if(!Array.isArray(result.users))throw new Error('The user directory could not be read.');
      return result.users.filter(user=>user.active).sort((a,b)=>a.name.localeCompare(b.name));
    })();
    try{return await pending;}finally{pending=null;}
  }
  let choosing=false;
  async function choose(previous=''){
    if(choosing)return null;choosing=true;
    const dialog=document.createElement('dialog');dialog.className='ops-operator-dialog';
    dialog.setAttribute('aria-labelledby','opsOperatorTitle');
    dialog.innerHTML='<form><h2 id="opsOperatorTitle">Save Change As</h2><label for="opsOperatorSelect">Operator</label><select id="opsOperatorSelect" required disabled><option value="">Loading Users...</option></select><p role="status"></p><div><button type="button" data-reload>Reload Users</button><button type="button" data-cancel>Cancel</button><button type="submit" disabled>Continue</button></div></form>';
    document.body.append(dialog);const select=dialog.querySelector('select'),submit=dialog.querySelector('[type=submit]'),status=dialog.querySelector('p');
    const load=async()=>{select.disabled=submit.disabled=true;status.textContent='';try{const users=await active();select.replaceChildren(new Option('Select Your Name',''),...users.map(user=>new Option(user.name,user.name)));select.value=users.some(user=>user.name===previous)?previous:'';select.disabled=submit.disabled=false;if(!users.length)status.textContent='No active users. Add a user in User Management.';select.focus();}catch(error){status.textContent=error.message;}};
    return new Promise(resolve=>{
      let name=null;
      dialog.querySelector('form').onsubmit=event=>{event.preventDefault();if(!select.value)return;name=select.value;dialog.close();};
      dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();dialog.querySelector('[data-reload]').onclick=load;
      dialog.addEventListener('close',()=>{dialog.remove();choosing=false;resolve(name);},{once:true});dialog.showModal();void load();
    });
  }
  window.OperationsUsers={active,choose};
  // Selection-only combobox: readonly prevents the mobile text keyboard.
  const inputs=['operator-name','chemical-operator','ordered-by'].map(id=>document.getElementById(id)).filter(Boolean);
  for(const input of inputs){
    const wrapper=document.createElement('div');wrapper.className='ops-operator-field';
    input.before(wrapper);wrapper.append(input);input.removeAttribute('list');input.autocomplete='off';input.readOnly=true;input.inputMode='none';
    input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','none');input.setAttribute('aria-readonly','true');input.setAttribute('aria-expanded','false');
    if(!input.hasAttribute('aria-label'))input.setAttribute('aria-label',input.labels?.[0]?.firstChild?.textContent.trim()||'Operator Name');
    const toggle=document.createElement('button');toggle.type='button';toggle.className='ops-operator-toggle';toggle.setAttribute('aria-label','Choose Operator');toggle.innerHTML='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
    const popup=document.createElement('div');popup.className='ops-operator-popup';popup.hidden=true;
    const list=document.createElement('div');list.id=input.id+'-options';list.setAttribute('role','listbox');list.setAttribute('aria-label','Active Operators');
    input.setAttribute('aria-controls',list.id);toggle.setAttribute('aria-controls',list.id);
    const status=document.createElement('p');status.setAttribute('role','status');
    const retry=document.createElement('button');retry.type='button';retry.className='ops-operator-retry';retry.textContent='Retry Loading Names';retry.hidden=true;
    popup.append(list,status,retry);wrapper.append(toggle,popup);
    let users=[],filtered=[],highlight=-1,opened=false,loading=false,error=false;
    function close(){opened=false;popup.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');}
    function choose(user){input.value=user.name;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));close();input.focus({preventScroll:true});close();}
    function draw(){
      filtered=users;highlight=-1;input.removeAttribute('aria-activedescendant');list.replaceChildren();
      for(const [index,user]of filtered.entries()){
        const option=document.createElement('button');option.type='button';option.tabIndex=-1;option.id=list.id+'-'+index;option.setAttribute('role','option');option.setAttribute('aria-selected','false');option.textContent=user.name;
        option.addEventListener('pointerdown',event=>event.preventDefault());option.onclick=()=>choose(user);list.append(option);
      }
      status.hidden=!!filtered.length;status.textContent=loading?'Loading operator names...':error?'Names could not be loaded. Retry to choose an operator.':'No active operators. Add users in User Management.';
      retry.hidden=!error;
    }
    async function refresh(){if(loading)return;loading=true;error=false;draw();try{users=await active();}catch{error=true;users=[];}finally{loading=false;if(opened)draw();}}
    function open(){if(input.disabled)return;opened=true;popup.hidden=false;input.setAttribute('aria-expanded','true');draw();void refresh();}
    input.addEventListener('focus',open);input.addEventListener('click',()=>{if(!opened)open();});
    toggle.addEventListener('pointerdown',event=>event.preventDefault());toggle.onclick=()=>{if(input.disabled)return;if(opened)close();else{input.focus({preventScroll:true});if(!opened)open();}};
    retry.onclick=()=>void refresh();
    input.addEventListener('keydown',event=>{
      if(event.key==='Escape'&&opened){event.preventDefault();event.stopPropagation();close();return;}
      if(event.key==='Tab'){close();return;}
      if(['ArrowDown','ArrowUp'].includes(event.key)){
        event.preventDefault();if(!opened)open();if(!filtered.length)return;
        highlight=highlight<0?(event.key==='ArrowDown'?0:filtered.length-1):(highlight+(event.key==='ArrowDown'?1:-1)+filtered.length)%filtered.length;
        [...list.children].forEach((option,index)=>option.setAttribute('aria-selected',String(index===highlight)));
        const option=list.children[highlight];input.setAttribute('aria-activedescendant',option.id);option.scrollIntoView({block:'nearest'});
      }else if(event.key==='Enter'||event.key===' '){event.preventDefault();if(event.key==='Enter'&&opened&&highlight>=0)choose(filtered[highlight]);else if(opened)close();else open();}
    });
    wrapper.addEventListener('focusout',()=>setTimeout(()=>{if(!wrapper.contains(document.activeElement))close();},0));
    document.addEventListener('pointerdown',event=>{if(!wrapper.contains(event.target))close();});
    new MutationObserver(()=>{toggle.disabled=input.disabled;if(input.disabled)close();}).observe(input,{attributes:true,attributeFilter:['disabled']});
    toggle.disabled=input.disabled;void refresh();
  }
})();
