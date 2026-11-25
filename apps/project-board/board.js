'use strict';
const $ = id => document.getElementById(id);
const stages = ['Proposed', 'Approved', 'In Progress', 'Complete'];
const accents = ['#758999', '#4a80ae', '#b57826', '#28846d'];
const defaults = ['Clarifiers', 'Filter Gallery', 'Operations Room'];
const projectPrefix = 'ng.project-board.project.';
const locationPrefix = 'ng.project-board.location.';
const compare = new Intl.Collator('en', {numeric:true, sensitivity:'base'}).compare;
let editing = null;
let dragging = null;
let locations = [];
let projects = [];
const viewParams = new URLSearchParams(location.search);
const tv = viewParams.get('mode') === 'tv';
document.body.classList.toggle('tv',tv);
$('displayMode').textContent = tv ? 'Exit TV view' : 'TV view';
function updateViewLink() {
  const next = new URL(location.href);
  if (tv) next.searchParams.delete('mode'); else next.searchParams.set('mode','tv');
  for (const id of ['filter','sort']) {
    if ($(id).value && (id !== 'sort' || $(id).value !== 'Location')) next.searchParams.set(id,$(id).value);
    else next.searchParams.delete(id);
  }
  $('displayMode').href = next.href;
}
let restoreFilters = true;

function element(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}
function options(select, names, first, selection) {
  select.replaceChildren(new Option(first, ''), ...names.map(name => new Option(name, name)));
  select.value = names.includes(selection) ? selection : '';
}
function effortScore({cost,hours,complexity}) {
  if (cost == null || hours == null || complexity == null) return null;
  const points = (value, low, high) => value < low ? 1 : value <= high ? 2 : 3;
  return points(cost,500,5000) + points(hours,8,40) + complexity;
}
function scoreLabel(project) {
  const score = effortScore(project);
  return score === null ? 'Estimate incomplete' : 'Effort ' + score + '/9';
}
function readEstimate() {
  const number = id => $(id).value === '' ? null : Number($(id).value);
  return {cost:number('cost'),hours:number('hours'),complexity:number('complexity')};
}
function previewEstimate() { $('effortPreview').textContent = scoreLabel(readEstimate()); }
$('estimate').addEventListener('input',previewEstimate);
function render() {
  options($('filter'), locations, 'All locations', $('filter').value);
  if (restoreFilters) {
    const filter = viewParams.get('filter');
    if (locations.includes(filter)) $('filter').value = filter;
    const sort = viewParams.get('sort');
    if ([...$('sort').options].some(item=>item.value === sort)) $('sort').value = sort;
    restoreFilters = false;
  }
  updateViewLink();
  const visible = projects.filter(p => !$('filter').value || p.place === $('filter').value);
  const sort = $('sort').value;
  visible.sort((a,b) => {
    if (sort === 'effort') return (effortScore(b) ?? 0) - (effortScore(a) ?? 0) || compare(a.title,b.title);
    return (sort === 'Location' && compare(a.place,b.place)) || compare(a.title,b.title);
  });
  $('board').replaceChildren(...stages.map((stage,index) => {
    const lane = element('section','lane','');
    lane.style.setProperty('--accent', accents[index]);
    const cards = visible.filter(p => p.stage === stage);
    const heading = element('h2','',stage);
    heading.append(element('span','count',cards.length));
    lane.append(heading);
    for (const project of cards) {
      const card = element(tv ? 'article' : 'button','card','');
      card.append(element('strong','',project.title),element('small','',project.place || 'No location'));
      const estimates = [];
      if (project.cost != null) estimates.push('$' + project.cost.toLocaleString('en-US',{maximumFractionDigits:2}));
      if (project.hours != null) estimates.push(project.hours + ' person-hours');
      if (project.complexity != null) estimates.push(['Low','Medium','High'][project.complexity-1] + ' complexity');
      if (estimates.length) card.append(element('small','',estimates.join(' · ')));
      card.append(element('small','effort',scoreLabel(project)));
      lane.append(card);
      if (tv) continue;
      card.onclick = () => edit(project);
      card.draggable = true;
      card.ondragstart = event => { dragging = project.id; event.dataTransfer.setData('text/plain',project.id); };
      card.ondragend = () => { dragging = null; document.querySelectorAll('.over').forEach(n=>n.classList.remove('over')); };
    }
    if (!cards.length) lane.append(element('p','empty','No projects'));
    lane.ondragover = event => { if (dragging) { event.preventDefault(); lane.classList.add('over'); } };
    lane.ondragleave = () => lane.classList.remove('over');
    lane.ondrop = async event => {
      event.preventDefault();
      lane.classList.remove('over');
      if (!dragging) return;
      const project = projects.find(item => item.id === dragging);
      dragging = null;
      if (project) {
        try { await putProject({...project,stage}); await refresh(); }
        catch(error) { report(error); }
      }
    };
    return lane;
  }));
}
function report(error) {
  $('error').textContent = error.message;
  $('error').hidden = false;
}
async function api(path = '', options) {
  const response = await fetch('/api/project-board' + path,options);
  if (response.status === 401) {
    $('login').hidden = false;
    if (tv) $('board').replaceChildren();
  }
  if (!response.ok) {
    const result = await response.json().catch(()=>({}));
    throw Error(result.error || 'Server request failed (' + response.status + ').');
  }
  return response.json();
}
function post(path,data) {
  return api(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
}
function putProject(project, uploads = [], removed = [], migrate = false) {
  const form = new FormData();
  form.set('project', JSON.stringify({...project, files:undefined, revision:project.revision || 0, removed, migrate}));
  for (const {id,file} of uploads) form.append(id,file,file.name);
  return api('/projects/'+project.id,{method:'PUT',body:form});
}
async function refresh() {
  const state = await api();
  projects = state.projects;
  locations = [...new Set([...defaults,...state.locations])].sort(compare);
  render();
  $('add').disabled = $('addLocation').disabled = false;
}
async function initialize() {
  try {
    await refresh();
    $('login').hidden = true;
    $('error').hidden = true;
    if (localStorage.getItem('ng.project-board.migrated.v1')) return;
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(locationPrefix)) await post('/locations',{name:localStorage.getItem(key)});
      if (key.startsWith(projectPrefix)) {
        const project = JSON.parse(localStorage.getItem(key));
        const files = await boardFiles.legacy(project.id);
        await putProject(project,files,[],true);
      }
    }
    localStorage.setItem('ng.project-board.migrated.v1','done');
    await refresh();
  } catch(error) { report(error); }
}
$('login').onsubmit = async event => {
  event.preventDefault();
  try {
    await post('/login',{key:$('accessKey').value.trim()});
    $('accessKey').value = '';
    await initialize();
  } catch(error) { report(error); }
};
function addPurchaseLink(link = {}) {
  const row = element('div','purchase-row','');
  const label = document.createElement('input');
  label.placeholder = 'Item name (optional)';
  label.setAttribute('aria-label','Item name');
  label.maxLength = 160;
  label.value = link.label || '';
  const url = document.createElement('input');
  url.type = 'url';
  url.required = true;
  url.placeholder = 'https://…';
  url.setAttribute('aria-label','Retailer URL');
  url.value = link.url || '';
  const open = element('a','','Open retailer');
  open.target = '_blank';
  open.rel = 'noopener noreferrer';
  function update() {
    let address;
    try { address = new URL(url.value); } catch {}
    const valid = address && ['https:','http:'].includes(address.protocol);
    url.setCustomValidity(url.value && !valid ? 'Enter a full http or https address.' : '');
    open.hidden = !valid;
    if (valid) open.href = address.href; else open.removeAttribute('href');
  }
  update();
  url.oninput = update;
  const remove = element('button','','Remove');
  remove.type = 'button';
  remove.onclick = () => row.remove();
  row.append(label,url,open,remove);
  $('linkRows').append(row);
  return label;
}
$('addLink').onclick = () => addPurchaseLink().focus();
function edit(project) {
  editing = project || {id:crypto.randomUUID(),revision:0};
  $('editorTitle').textContent = project ? 'Edit project' : 'New project';
  $('title').value = project?.title || '';
  options($('place'), locations, 'No location', project?.place ?? $('filter').value);
  $('stage').value = project?.stage || stages[0];
  $('notes').value = project?.notes || '';
  for (const id of ['cost','hours','complexity']) $(id).value = project?.[id] ?? '';
  previewEstimate();
  $('linkRows').replaceChildren();
  for (const link of project?.links || []) addPurchaseLink(link);
  boardFiles.open(project);
  $('editor').showModal();
}
$('stage').append(...stages.map(stage => new Option(stage)));
$('add').onclick = () => edit(null);
$('addLocation').onclick = () => { $('locationForm').reset(); $('name').setCustomValidity(''); $('locationDialog').showModal(); };
$('filter').onchange = $('sort').onchange = render;
document.querySelectorAll('[data-close]').forEach(button => button.onclick = () => button.closest('dialog').close());
for (const id of ['name','title']) $(id).oninput = () => $(id).setCustomValidity('');
$('locationForm').onsubmit = async event => {
  event.preventDefault();
  const name = $('name').value.trim();
  if (!name || locations.some(existing => !compare(existing,name))) {
    $('name').setCustomValidity(name ? 'This location already exists.' : 'Enter a location name.');
    $('name').reportValidity();
    return;
  }
  try { await post('/locations',{name}); $('locationDialog').close(); await refresh(); }
  catch(error) { $('name').setCustomValidity(error.message); $('name').reportValidity(); }
};
$('editor').onclose = () => { if (!$('editor').open) boardFiles.reset(); };
$('editor').oncancel = event => { if ($('projectForm').inert) event.preventDefault(); };
$('projectForm').onsubmit = async event => {
  event.preventDefault();
  const title = $('title').value.trim();
  if (!title) { $('title').setCustomValidity('Enter a project title.'); $('title').reportValidity(); return; }
  if ($('projectForm').inert) return;
  const project = {...editing,...readEstimate(),title,place:$('place').value,stage:$('stage').value,notes:$('notes').value.trim()};
  project.links = [...$('linkRows').children].map(row=>{
    const [label,url] = row.querySelectorAll('input');
    return {label:label.value.trim(),url:url.value.trim()};
  });
  $('projectForm').inert = true;
  try {
    const {uploads,removed} = boardFiles.changes();
    await putProject(project,uploads,removed);
    $('editor').close();
    await refresh();
  } catch(error) {
    $('fileMessage').textContent = error.message;
    report(error);
  } finally { $('projectForm').inert = false; }
};
updateViewLink();
async function runBoard() {
  await initialize();
  while (tv) {
    await new Promise(resolve => setTimeout(resolve,30000));
    if (!$('login').hidden) continue;
    try { await refresh(); $('error').hidden = true; }
    catch(error) { report(error); }
  }
}
runBoard();
