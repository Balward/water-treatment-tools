'use strict';
const $ = id => document.getElementById(id);
const panel = $('panel');
const total = 3311;
const paths = [
  ['Trace a signal', 'Follow a measurement from its drawing to its controller.', [562,564,890,894]],
  ['Measure the process', 'Explore three ways to understand what is happening in a tank or pipe.', [1447,1692,1792]],
  ['Close the loop', 'Start with a treatment example, then explore how feedback changes a process.', [532,2297,2308,2321]]
];
let chapters = [], topics = [], page = 1, view = 'paths', searchSequence = 0, indexPromise;
let bookmarks = [];
try {
  const stored = JSON.parse(localStorage.getItem('instrumentation-bookmarks') || '[]');
  if (Array.isArray(stored)) bookmarks = stored.filter(n => Number.isInteger(n) && n >= 1 && n <= total);
} catch {}
function element(tag, text, parent) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (parent) parent.append(node);
  return node;
}
function button(text, parent, action) {
  const node = element('button', text, parent);
  node.onclick = action;
  return node;
}
async function json(file) {
  const response = await fetch(file);
  if (!response.ok) throw Error(response.status);
  return response.json();
}
function label(n) {
  const chapter = chapters.findLast(c => c.page <= n);
  const topic = chapter?.topics.findLast(t => t[1] <= n);
  return topic?.[0] || chapter?.title || 'Front matter';
}
function row(parent, n, title = label(n), excerpt = '') {
  const node = button('', parent, () => read(n));
  node.className = 'row';
  element('small', 'PDF p. ' + n, node);
  element('strong', title, node);
  if (excerpt) element('span', excerpt, node);
}
function markLabel() {
  $('mark').textContent = bookmarks.includes(page) ? 'Remove bookmark' : 'Bookmark page';
}
function read(n) {
  page = n;
  $('location').textContent = 'PDF page ' + n + ' of ' + total;
  $('heading').textContent = label(n);
  $('prev').disabled = n <= 1;
  $('next').disabled = n >= total;
  markLabel();
  const url = 'lessons.pdf#page=' + n;
  $('original').href = url;
  // A fresh frame opens the requested page even when the viewer owns hash navigation.
  const frame = $('source').cloneNode(false);
  frame.src = url;
  $('source').replaceWith(frame);
  if (!$('reader').open) $('reader').showModal();
}
$('prev').onclick = () => read(page - 1);
$('next').onclick = () => read(page + 1);
$('close').onclick = () => $('reader').close();
$('reader').onclose = () => {
  $('source').src = 'about:blank';
  if (view === 'saved') show(view);
};
$('mark').onclick = () => {
  bookmarks = bookmarks.includes(page) ? bookmarks.filter(n => n !== page) : [...bookmarks,page];
  markLabel();
  try { localStorage.setItem('instrumentation-bookmarks', JSON.stringify(bookmarks)); }
  catch { $('mark').textContent += ' (this session only)'; }
};
function bench() {
  const box = element('div', undefined, panel);
  box.className = 'bench';
  element('h3','Linear tank-level transmitter',box);
  element('p','A 0–10 ft tank level maps linearly to a 4–20 mA signal. Move the level to see the loop current.',box);
  const caption = element('label','Tank level',box);
  caption.htmlFor = 'level';
  const slider = element('input',undefined,box);
  slider.id = 'level'; slider.type = 'range'; slider.min = 0; slider.max = 10; slider.step = 0.1; slider.value = 5;
  const out = element('output',undefined,box);
  out.htmlFor = 'level';
  slider.oninput = () => { out.textContent = Number(slider.value).toFixed(1) + ' ft · ' + (4 + 1.6 * slider.value).toFixed(2) + ' mA'; };
  slider.oninput();
  element('h3','Check your reading',box);
  const question = element('p','',box), choices = element('div','',box), feedback = element('p','',box);
  let round = 0;
  function challenge() {
    const level = [2.5,7.5,5,0,10][round % 5], correct = 4 + level * 1.6;
    question.textContent = 'At ' + level + ' ft, what current would you expect?';
    choices.replaceChildren(); feedback.textContent = '';
    for (const answer of [4,8,12,16,20]) button(answer + ' mA',choices,() => {
      feedback.textContent = answer === correct ? 'Correct. 4 mA + (' + level + ' ÷ 10) × 16 mA = ' + correct + ' mA.' : 'Try again. Start at 4 mA and add the filled fraction of the 16 mA span.';
    });
  }
  challenge();
  button('Next question',box,() => { round++; challenge(); });
  row(box,894,'Read the signal-scaling example');
}
function show(name) {
  view = name; searchSequence++;
  document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', b.dataset.view === name));
  panel.replaceChildren();
  const headings = {paths:'Reading paths',chapters:'Chapter library',lab:'Signal bench',saved:'Your bookmarks',search:'Search results'};
  element('h2',headings[name],panel);
  if (name === 'paths') {
    const grid = element('div',undefined,panel); grid.className = 'grid';
    for (const [title,description,steps] of paths) {
      const card = element('article',undefined,grid); card.className = 'card';
      element('h3',title,card); element('p',description,card);
      steps.forEach(n => row(card,n));
    }
  } else if (name === 'chapters') {
    row(panel,1,'Cover and contents');
    for (const c of chapters) {
      const details = element('details',undefined,panel);
      element('summary',c.title,details); row(details,c.page,'Open chapter');
      c.topics.forEach(([title,n]) => row(details,n,title));
    }
  } else if (name === 'lab') bench();
  else if (name === 'saved') {
    if (!bookmarks.length) element('p','Open any textbook page and choose Bookmark page to keep it here on this browser.',panel);
    [...bookmarks].sort((a,b)=>a-b).forEach(n=>row(panel,n));
  }
}
const normalize = s => s.normalize('NFKC').toLowerCase().replace(/[–—-]/g,' ').replace(/\s+/g,' ').trim();
$('lookup').onsubmit = async event => {
  event.preventDefault();
  const query = normalize($('query').value);
  if (!query || !chapters.length) return;
  show('search');
  const seq = searchSequence;
  const status = element('p','Searching the textbook…',panel);
  try {
    indexPromise ??= json('pages.json').then(pages => pages.map(raw => ({raw, text:normalize(raw)}))).catch(e => {indexPromise = undefined; throw e;});
    const pages = await indexPromise;
    if (seq !== searchSequence) return;
    const words = [...new Set(query.split(' '))];
    const ranked = [];
    pages.forEach(({raw,text},i) => {
      const title = topics.get(i+1) || '';
      const combined = title + ' ' + text;
      if (!words.every(word=>combined.includes(word))) return;
      const at = text.indexOf(query);
      const offset = Math.max(0,(at < 0 ? text.indexOf(words[0]) : at) - 58);
      ranked.push({n:i+1,score:(title.includes(query)?10:0)+(at>=0?3:0),snippet:(offset?'…':'')+raw.slice(offset,offset+190)+'…'});
    });
    ranked.sort((a,b)=>b.score-a.score || a.n-b.n);
    status.textContent = ranked.length ? ranked.length.toLocaleString() + ' matching pages' : 'No matching pages. Try a shorter term or browse the chapter library.';
    let shown = 0;
    const results = element('div',undefined,panel);
    const more = button('Show more pages',panel,append);
    function append() {
      ranked.slice(shown,shown+20).forEach(r=>row(results,r.n,label(r.n),r.snippet));
      shown += 20; more.hidden = shown >= ranked.length;
    }
    append();
  } catch { if (seq === searchSequence) status.textContent = 'The search index could not load. Submit the search again to retry.'; }
};
async function start() {
  try {
    chapters = await json('chapters.json');
    topics = new Map();
    for (const c of chapters) {
      for (const [title,n] of [[c.title,c.page],...c.topics]) topics.set(n, (topics.get(n)||'')+' '+normalize(title));
    }
    document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>show(b.dataset.view));
    show('paths');
  } catch {
    panel.replaceChildren(); element('p','The chapter library could not load.',panel); button('Try again',panel,start);
  }
}
start();
