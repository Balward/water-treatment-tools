document.addEventListener('DOMContentLoaded',()=>{
  const app=window.studyGuide,nav=document.getElementById('studyNav'),lessons=window.reg100Lessons;
  const storageKey='reg100-study-v2';let reviewed=new Set();
  try{const saved=JSON.parse(localStorage.getItem(storageKey));if(Array.isArray(saved))reviewed=new Set(saved.filter(n=>Number.isInteger(n)&&n>=1&&n<=lessons.length))}catch{/* Storage may be unavailable. Study still works. */}
  app.slides.forEach((slide,index)=>{const button=document.createElement('button');button.type='button';button.className='nav-item';button.dataset.slide=String(index+1);const title=slide.querySelector('h2').textContent;button.title=title;const number=document.createElement('span');number.setAttribute('aria-hidden','true');number.textContent=String(index+1).padStart(2,'0');const label=document.createElement('span');label.textContent=title;button.append(number,label);button.addEventListener('click',()=>app.goToSlide(index+1));nav.append(button)});
  const sync=()=>{
    nav.querySelectorAll('button').forEach(b=>{const n=Number(b.dataset.slide),done=reviewed.has(n);b.setAttribute('aria-pressed',String(n===app.currentSlide));b.classList.toggle('reviewed',done);b.setAttribute('aria-label',lessons[n-1].title+(done?', Reviewed':''));b.firstChild.textContent=done?'\u2713':String(n).padStart(2,'0')});
    app.slides.forEach((slide,index)=>{const done=reviewed.has(index+1),button=slide.querySelector('.review-lesson');button.setAttribute('aria-pressed',String(done));button.textContent=done?'Reviewed — Undo':'Mark As Reviewed'});
    document.getElementById('reviewProgress').textContent=reviewed.size+' Of '+lessons.length+' Lessons Reviewed';
  };
  const original=app.goToSlide;app.goToSlide=function(...args){const before=this.currentSlide;original.apply(this,args);sync();if(before!==this.currentSlide){const heading=this.slides[this.currentSlide-1].querySelector('h2'),header=document.querySelector('.site-header');if(heading.getBoundingClientRect().top<header.getBoundingClientRect().bottom) this.slides[this.currentSlide-1].querySelector('.slide-content').scrollIntoView({block:'start'})}};sync();
  document.querySelector('.slide-counter').setAttribute('aria-live','polite');
  app.slides.forEach((slide,index)=>{
    slide.querySelector('.review-lesson').addEventListener('click',()=>{const n=index+1;reviewed.has(n)?reviewed.delete(n):reviewed.add(n);try{localStorage.setItem(storageKey,JSON.stringify([...reviewed]))}catch{}sync()});
    slide.querySelectorAll('.answer-option').forEach(button=>button.addEventListener('click',()=>{
      const lesson=lessons[index],right=Number(button.dataset.answer)===lesson.correct,feedback=slide.querySelector('.answer-feedback');
      slide.querySelectorAll('.answer-option').forEach(b=>{b.setAttribute('aria-pressed',String(b===button));b.classList.remove('answer-right','answer-wrong')});
      button.classList.add(right?'answer-right':'answer-wrong');feedback.hidden=false;feedback.classList.toggle('correct',right);feedback.textContent=(right?'Correct. ':'Try Again. ')+lesson.explanation;
    }));
  });
  const search=document.getElementById('lessonSearch'),results=document.getElementById('searchResults');
  search.addEventListener('input',()=>{
    const terms=search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);results.replaceChildren();results.hidden=!terms.length;if(!terms.length)return;
    const matches=lessons.map((l,index)=>({l,index,text:app.slides[index].textContent.toLowerCase()})).filter(m=>terms.every(t=>m.text.includes(t)));
    const heading=document.createElement('h2');heading.textContent=matches.length?'Matching Lessons ('+matches.length+')':'No Matching Lessons';results.append(heading);
    if(!matches.length){const p=document.createElement('p');p.textContent='Try a broader topic, such as certification, collection, or renewal.';results.append(p)}
    matches.forEach(({l,index})=>{const b=document.createElement('button');b.type='button';b.className='search-result';b.textContent=String(index+1).padStart(2,'0')+' · '+l.title;b.addEventListener('click',()=>{app.goToSlide(index+1);search.value='';results.hidden=true;const heading=app.slides[index].querySelector('h2');heading.tabIndex=-1;heading.focus({preventScroll:true});app.slides[index].scrollIntoView({block:'start'})});results.append(b)});
  });
  document.getElementById('printGuide').addEventListener('click',()=>window.print());
});
