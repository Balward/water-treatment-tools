document.addEventListener('DOMContentLoaded',()=>{
  const app=window.app,nav=document.getElementById('studyNav');
  const icon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M4 4h7a3 3 0 0 1 3 3v14a4 4 0 0 0-4-2H4zM14 7a3 3 0 0 1 3-3h3v15h-2a4 4 0 0 0-4 2"/></svg>';
  const chapters=flashcardData['grade3-4'].chapters;
  const items=[{id:'levels',title:'Study Levels'}, {id:'all',title:'All Chapters',count:Object.values(chapters).reduce((n,c)=>n+c.cards.length,0)},...Object.entries(chapters).map(([id,c])=>({id,title:c.title.replace(/\b[a-z]/g,c=>c.toUpperCase()),count:c.cards.length}))];
  for(const item of items){const b=document.createElement('button');b.type='button';b.className='nav-item';b.dataset.chapter=item.id;b.title=item.title;b.innerHTML='<span aria-hidden="true">'+icon+'</span><span></span>';b.children[1].textContent=item.title;if(item.count){const count=document.createElement('small');count.className='nav-count';count.textContent=item.count;b.append(count)}b.addEventListener('click',()=>{if(item.id==='levels')app.showBookSelection();else{app.selectBook('grade3-4');app.selectChapter(item.id)}});nav.append(b)}
  for(const item of items.filter(i=>i.count)){const tile=document.querySelector('.chapter-card[data-chapter="'+item.id+'"] .stat');if(tile)tile.textContent=item.count+' Terms'}
  const allCount=document.getElementById('allChaptersCount');if(allCount)allCount.textContent=items[1].count+' Terms';
  document.querySelector('.book-card.available .stat').textContent=items[1].count+' Terms Available';
  const sync=()=>{const selected=!app.currentBook?'levels':app.currentChapter;nav.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.chapter===selected)))};
  for(const name of ['showBookSelection','showChapterSelection','selectBook','startStudy']){const original=app[name];app[name]=function(...args){const result=original.apply(this,args);sync();return result}}sync();
  document.querySelectorAll('.book-icon>span,.chapter-icon>span').forEach(e=>{e.innerHTML=icon;e.setAttribute('aria-hidden','true')});
  document.querySelectorAll('.book-card:not(.available)').forEach(e=>e.setAttribute('aria-disabled','true'));
  document.querySelectorAll('.book-card.available,.chapter-card').forEach(e=>{e.setAttribute('role','button');e.tabIndex=0;e.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();e.click()}})});
  const card=document.getElementById('flashcard');card.tabIndex=0;card.setAttribute('role','region');card.setAttribute('aria-label','Study Card. Press Enter Or Space To Flip.');card.addEventListener('keydown',event=>{if(event.target===card&&(event.key==='Enter'||event.key===' ')){event.preventDefault();card.click()}});
  const syncFaces=()=>{const flipped=card.classList.contains('flipped');for(const [selector,hidden]of [['.card-front',flipped],['.card-back',!flipped]]){const face=card.querySelector(selector);face.inert=hidden;face.setAttribute('aria-hidden',String(hidden))}};new MutationObserver(syncFaces).observe(card,{attributes:true,attributeFilter:['class']});syncFaces();
});
