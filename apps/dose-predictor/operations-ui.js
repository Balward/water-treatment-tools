document.addEventListener('DOMContentLoaded',()=>{
  const links=[...document.querySelectorAll('.sidebar a')],sections=links.map(link=>document.querySelector(link.getAttribute('href')));
  const sync=()=>{const offset=document.querySelector('.site-header').getBoundingClientRect().height+48;const current=sections.filter(s=>s.getBoundingClientRect().top<=offset).at(-1)||sections[0];links.forEach((link,index)=>{if(sections[index]===current)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current')})};
  window.addEventListener('scroll',sync,{passive:true});window.addEventListener('resize',sync);sync();
  links.forEach(link=>link.addEventListener('click',()=>{if(link.hash==='#guide')document.getElementById('guide').open=true}));
  const presets=[...document.querySelectorAll('.preset-btn')];const syncPresets=()=>presets.forEach(b=>b.setAttribute('aria-pressed',String(b.classList.contains('active'))));presets.forEach(b=>new MutationObserver(syncPresets).observe(b,{attributes:true,attributeFilter:['class']}));syncPresets();
  const results=document.getElementById('resultsSection'),empty=document.getElementById('emptyResult');const syncResult=()=>{empty.hidden=results.style.display!=='none';sync()};new MutationObserver(syncResult).observe(results,{attributes:true,attributeFilter:['style']});syncResult();
  document.getElementById('predictionValue').setAttribute('aria-live','polite');
  document.querySelectorAll('.parameter-group input').forEach(input=>{input.inputMode='decimal';const help=input.parentElement.querySelector('small');help.id=input.id+'Help';input.setAttribute('aria-describedby',help.id)});
});
