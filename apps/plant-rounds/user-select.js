(() => {
  'use strict';
  let pending;
  function remembered(){try{return JSON.parse(localStorage.getItem('plant-rounds-operator')) || '';}catch{return '';}}
  async function refresh(){
    if(pending)return pending;
    pending=(async()=>{
      const response=await fetch('/api/plant-rounds/users',{cache:'no-store',signal:AbortSignal.timeout(12000)});
      const body=await response.json();if(!response.ok)throw new Error(body.error || 'The user list could not be loaded.');
      const active=body.users.filter(user=>user.active);
      for(const select of document.querySelectorAll('[data-rounds-user]')){
        const value=select.value || remembered();
        const signature=JSON.stringify(active.map(user=>[user.id,user.name]));
        if(select.dataset.users!==signature){
          select.replaceChildren(new Option(active.length?'Select Operator':'No Active Users',''));
          for(const user of active){const option=new Option(user.name,user.name);option.dataset.userId=user.id;select.append(option);}
          select.dataset.users=signature;
        }
        select.value=active.some(user=>user.name===value)?value:'';
      }
      return body;
    })();try{return await pending;}finally{pending=null;}
  }
  for(const select of document.querySelectorAll('[data-rounds-user]'))select.addEventListener('change',()=>{try{localStorage.setItem('plant-rounds-operator',JSON.stringify(select.value));}catch{}});
  window.RoundsUsers={refresh,ready:refresh()};
  // Pages handle initial failures; later refresh failures leave the saved list visible.
  window.RoundsUsers.ready.catch(()=>{});
  window.addEventListener('online',()=>void refresh().catch(()=>{}));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh().catch(()=>{});});
})();
