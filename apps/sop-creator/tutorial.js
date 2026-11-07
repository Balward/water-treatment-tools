(() => {
  'use strict';
  const $=id=>document.getElementById(id);let steps=[],index=0;
  function show(next){
    index=Math.max(0,Math.min(steps.length-1,next));const step=steps[index];
    $('tutorial-step').value=String(index);$('step-title').textContent=(index+1)+'. '+step.title;$('step-text').textContent=step.text;
    const src='tutorial-assets/'+step.image;$('step-image').src=src;$('step-image').alt='Step '+(index+1)+': '+step.title+'. '+step.text;
    $('screenshot-link').href=src;$('screenshot-link').hidden=false;$('screenshot-link').setAttribute('aria-label','Open screenshot for step '+(index+1)+' at full size');
    $('previous-step').disabled=index===0;$('next-step').disabled=index===steps.length-1;
  }
  $('previous-step').onclick=()=>show(index-1);$('next-step').onclick=()=>show(index+1);$('tutorial-step').onchange=()=>show(Number($('tutorial-step').value));
  $('watch-step').onclick=()=>{const video=$('tutorial-video');video.currentTime=steps[index].start;video.scrollIntoView({block:'center'});video.play().catch(()=>video.focus());};
  (async()=>{try{
    const response=await fetch('tutorial-assets/steps.json');if(!response.ok)throw Error();steps=await response.json();
    $('tutorial-step').replaceChildren(...steps.map((step,i)=>{const option=document.createElement('option');option.value=String(i);option.textContent=(i+1)+'. '+step.title;return option;}));
    $('tutorial-transcript').replaceChildren(...steps.map(step=>{const item=document.createElement('li'),title=document.createElement('strong'),text=document.createElement('span');title.textContent=step.title;text.textContent=step.text;item.append(title,text);return item;}));
    $('tutorial-step').disabled=false;$('watch-step').disabled=false;$('tutorial-status').hidden=true;show(0);
  }catch{$('tutorial-status').textContent='Unable to load the screenshot guide. Reload the page to try again, or watch the video above.';}})();
})();
