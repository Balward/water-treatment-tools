(() => {
  'use strict';
  const $=id=>document.getElementById(id),node=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;};
  let directory,editing=null,busy=false;
  function message(text){$('usersMessage').textContent=text;$('usersMessage').hidden=!text;}
  function setBusy(value){busy=value;for(const selector of ['#userForm input','#userForm button','#userList button','#addUser','#refreshUsers'])document.querySelectorAll(selector).forEach(el=>el.disabled=value);}
  async function request(path='',options={}){
    const response=await fetch('/api/operations/users'+path,{cache:'no-store',signal:AbortSignal.timeout(12000),...options,headers:{'Content-Type':'application/json'}});
    const result=await response.json();if(!response.ok)throw new Error(result.error || 'The user list could not be saved.');return result;
  }
  function render(){
    $('userList').replaceChildren();
    const list=directory.users.filter(user=>$('showInactive').checked || user.active);
    $('usersCount').textContent=directory.users.filter(user=>user.active).length+' Active Users';
    for(const user of list){
      const row=node('article','manage-item'),info=node('div','');info.append(node('h3','',user.name),node('p','',user.active?'Active':'Inactive'));
      const actions=node('div','review-actions'),edit=node('button','','Edit'),toggle=node('button',user.active?'delete-item':'',user.active?'Set Inactive':'Reactivate');
      edit.setAttribute('aria-label','Edit '+user.name);toggle.setAttribute('aria-label',(user.active?'Set Inactive: ':'Reactivate: ')+user.name);
      edit.onclick=()=>open(user);toggle.onclick=()=>void status(user);edit.disabled=toggle.disabled=busy;actions.append(edit,toggle);row.append(info,actions);$('userList').append(row);
    }
    if(!list.length)$('userList').append(node('p','empty','No users to show. Add a user or show inactive users.'));
  }
  function open(user){
    if(busy)return;editing=user || null;$('userForm').reset();$('userTitle').textContent=user?'Edit User':'Add User';$('firstName').value=user?.firstName || '';$('lastName').value=user?.lastName || '';$('userActive').checked=user?.active ?? true;$('userError').hidden=true;$('userDialog').showModal();
  }
  async function status(user){
    if(busy)return;
    if(user.active && !confirm('Set '+user.name+' inactive across Operations apps? Their saved records will be preserved.'))return;
    setBusy(true);message('');
    try{directory=await request('/'+encodeURIComponent(user.id),{method:user.active?'DELETE':'PUT',body:JSON.stringify({revision:directory.revision,firstName:user.firstName,lastName:user.lastName,active:true})});render();message(user.name+(user.active?' is now inactive.':' is active again.'));}
    catch(error){message(error.message);}finally{setBusy(false);}
  }
  async function load(){
    if(busy)return;setBusy(true);message('Loading users…');
    try{directory=await request();render();message('');}catch(error){message(error.message+' Use Refresh to try again.');}
    finally{setBusy(false);if(!directory)$('addUser').disabled=true;}
  }
  $('userForm').onsubmit=async event=>{
    event.preventDefault();if(busy)return;setBusy(true);$('userError').hidden=true;
    try{directory=await request(editing?'/'+encodeURIComponent(editing.id):'',{method:editing?'PUT':'POST',body:JSON.stringify({revision:directory.revision,firstName:$('firstName').value.trim(),lastName:$('lastName').value.trim(),active:$('userActive').checked})});$('userDialog').close();render();message('User saved. Existing rounds and notes retain their recorded names.');}
    catch(error){$('userError').textContent=error.message;$('userError').hidden=false;}finally{setBusy(false);}
  };
  $('showInactive').onchange=()=>{if(directory)render();};$('addUser').onclick=()=>open();$('refreshUsers').onclick=()=>void load();$('cancelUser').onclick=()=>$('userDialog').close();$('userDialog').addEventListener('cancel',event=>{if(busy)event.preventDefault();});
  void load();
})();
