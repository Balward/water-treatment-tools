(() => {
  'use strict';
  const $=id=>document.getElementById(id);let steps=[],index=0;
  const tabs=[...document.querySelectorAll('[role="tab"]')];
  function selectTab(name){
    for(const tab of tabs){const selected=tab.getAttribute('aria-controls')===name;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;$(tab.getAttribute('aria-controls')).hidden=!selected;}
    if(name!=='video')$('tutorial-video').pause();
  }
  function openTab(name){selectTab(name);history.pushState(null,'','#'+name);}
  for(const [i,tab] of tabs.entries()){
    tab.onclick=event=>{event.preventDefault();openTab(tab.getAttribute('aria-controls'));};
    tab.onkeydown=event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(i+(event.key==='ArrowRight'?1:tabs.length-1))%tabs.length;tabs[next].focus();openTab(tabs[next].getAttribute('aria-controls'));};
  }
  const readHash=()=>selectTab(location.hash==='#guide'?'guide':'video');
  window.addEventListener('hashchange',readHash);window.addEventListener('popstate',readHash);readHash();
  function show(next){
    index=Math.max(0,Math.min(steps.length-1,next));const step=steps[index];
    $('tutorial-step').value=String(index);$('step-title').textContent=(index+1)+'. '+step.title;$('step-text').textContent=step.text;
    const src='tutorial-assets/'+step.image+'?v=20261107-recut2';$('step-image').src=src;$('step-image').alt='Step '+(index+1)+': '+step.title+'. '+step.text;
    $('screenshot-link').href=src;$('screenshot-link').hidden=false;$('screenshot-link').setAttribute('aria-label','Open screenshot for step '+(index+1)+' at full size');
    $('previous-step').disabled=index===0;$('next-step').disabled=index===steps.length-1;
  }
  $('previous-step').onclick=()=>show(index-1);$('next-step').onclick=()=>show(index+1);$('tutorial-step').onchange=()=>show(Number($('tutorial-step').value));
  $('watch-step').onclick=()=>{openTab('video');$('video-tab').focus();const video=$('tutorial-video');video.currentTime=steps[index].start;video.play().catch(()=>video.focus());};
  (async()=>{try{
    const response=await fetch('tutorial-assets/steps.json?v=20261107-recut2');if(!response.ok)throw Error();steps=await response.json();
    $('tutorial-step').replaceChildren(...steps.map((step,i)=>{const option=document.createElement('option');option.value=String(i);option.textContent=(i+1)+'. '+step.title;return option;}));
    $('tutorial-transcript').replaceChildren(...steps.map(step=>{const item=document.createElement('li'),title=document.createElement('strong'),text=document.createElement('span');title.textContent=step.title;text.textContent=step.text;item.append(title,text);return item;}));
    $('tutorial-step').disabled=false;$('watch-step').disabled=false;$('tutorial-status').hidden=true;show(0);
  }catch{$('tutorial-status').textContent='Unable to load the screenshot guide. Reload the page to try again, or select Watch Video.';}})();
})();
