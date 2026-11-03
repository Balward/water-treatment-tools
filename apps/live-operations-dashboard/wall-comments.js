// Full comments stay visible together; no timers, paging, or automatic text shrinking.
(() => {
  'use strict';
  const list = document.getElementById('generalCommentsList');
  const count = document.getElementById('wallCommentCount');
  const hint = document.getElementById('commentsOverflowHint');
  let frame;
  function update() {
    const total = list.querySelectorAll('.comment-card').length;
    list.style.setProperty('--comment-columns',Math.max(1,total));
    count.textContent = total + (total === 1 ? ' Note' : ' Notes');
    hint.hidden = !(innerWidth >= 900 && list.scrollHeight - list.scrollTop > list.clientHeight + 2);
  }
  function schedule() { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); }
  new ResizeObserver(schedule).observe(list);
  new MutationObserver(schedule).observe(list, {childList:true,subtree:true,characterData:true});
  document.fonts.ready.then(schedule);
  window.addEventListener('resize',schedule);
  list.addEventListener('scroll',schedule,{passive:true});
  schedule();
})();
