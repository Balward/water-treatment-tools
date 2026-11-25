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
function render() {
  options($('filter'), locations, 'All locations', $('filter').value);
  const visible = projects.filter(p => !$('filter').value || p.place === $('filter').value);
  visible.sort((a,b) => ($('sort').value === 'Location' && compare(a.place,b.place)) || compare(a.title,b.title));
  $('board').replaceChildren(...stages.map((stage,index) => {
    const lane = element('section','lane','');
    lane.style.setProperty('--accent', accents[index]);
    const cards = visible.filter(p => p.stage === stage);
    const heading = element('h2','',stage);
    heading.append(element('span','count',cards.length));
    lane.append(heading);
    for (const project of cards) {
      const card = element('button','card','');
      card.append(element('strong','',project.title),element('small','',project.place || 'No location'));
      card.onclick = () => edit(project);
      card.draggable = true;
      card.ondragstart = event => { dragging = project.id; event.dataTransfer.setData('text/plain',project.id); };
      card.ondragend = () => { dragging = null; document.querySelectorAll('.over').forEach(n=>n.classList.remove('over')); };
      lane.append(card);
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
  if (response.status === 401) $('login').hidden = false;
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
function edit(project) {
  editing = project || {id:crypto.randomUUID(),revision:0};
  $('editorTitle').textContent = project ? 'Edit project' : 'New project';
  $('title').value = project?.title || '';
  options($('place'), locations, 'No location', project?.place ?? $('filter').value);
  $('stage').value = project?.stage || stages[0];
  $('notes').value = project?.notes || '';
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
  const project = {...editing,title,place:$('place').value,stage:$('stage').value,notes:$('notes').value.trim()};
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
initialize();
