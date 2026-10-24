// Preview navigation only. Calculation, CSV handling, and PDF export use ../script.js unchanged.
(() => {
  const links=[...document.querySelectorAll('.sidebar a')],sections=links.map(a=>document.querySelector(a.hash));
  const sync=()=>{const offset=document.querySelector('.site-header').offsetHeight+48;const current=sections.filter(s=>!s.classList.contains('hidden')&&s.getBoundingClientRect().top<=offset).at(-1)||sections[0];links.forEach((a,i)=>{a.setAttribute('aria-disabled',String(sections[i].classList.contains('hidden')));if(sections[i]===current)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current')})};
  links.forEach(a=>a.addEventListener('click',e=>{if(a.getAttribute('aria-disabled')==='true')e.preventDefault()}));
  sections.forEach(section=>new MutationObserver(sync).observe(section,{attributes:true,attributeFilter:['class']}));
  window.addEventListener('scroll',sync,{passive:true});window.addEventListener('resize',sync);sync();
})();
