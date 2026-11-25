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
  const projects = [];
  const places = new Set(defaults);
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(locationPrefix)) places.add(localStorage.getItem(key));
    if (key.startsWith(projectPrefix)) projects.push(JSON.parse(localStorage.getItem(key)));
  }
  locations = [...places].sort(compare);
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
    lane.ondrop = event => {
      event.preventDefault();
      lane.classList.remove('over');
      if (!dragging) return;
      const project = JSON.parse(localStorage.getItem(projectPrefix + dragging));
      dragging = null;
      if (project) save(projectPrefix + project.id, JSON.stringify({...project,stage}));
    };
    return lane;
  }));
}
function save(key,value) {
  try {
    localStorage.setItem(key,value);
    render();
    $('error').hidden = true;
    return true;
  } catch {
    const message = 'Could not save the board. Check browser storage and try again.';
    if (document.querySelector('dialog[open]')) window.alert(message);
    $('error').textContent = message;
    $('error').hidden = false;
    return false;
  }
}
function edit(project) {
  editing = project?.id || null;
  $('editorTitle').textContent = editing ? 'Edit project' : 'New project';
  $('title').value = project?.title || '';
  options($('place'), locations, 'No location', project?.place ?? $('filter').value);
  $('stage').value = project?.stage || stages[0];
  $('notes').value = project?.notes || '';
  $('editor').showModal();
}
$('stage').append(...stages.map(stage => new Option(stage)));
$('add').onclick = () => edit(null);
$('addLocation').onclick = () => { $('locationForm').reset(); $('name').setCustomValidity(''); $('locationDialog').showModal(); };
$('filter').onchange = $('sort').onchange = render;
document.querySelectorAll('[data-close]').forEach(button => button.onclick = () => button.closest('dialog').close());
for (const id of ['name','title']) $(id).oninput = () => $(id).setCustomValidity('');
$('locationForm').onsubmit = event => {
  event.preventDefault();
  const name = $('name').value.trim();
  if (!name || locations.some(existing => !compare(existing,name))) {
    $('name').setCustomValidity(name ? 'This location already exists.' : 'Enter a location name.');
    $('name').reportValidity();
    return;
  }
  if (save(locationPrefix + name.toLowerCase(),name)) $('locationDialog').close();
};
$('projectForm').onsubmit = event => {
  event.preventDefault();
  const title = $('title').value.trim();
  if (!title) { $('title').setCustomValidity('Enter a project title.'); $('title').reportValidity(); return; }
  const id = editing || Array.from(crypto.getRandomValues(new Uint32Array(4))).join('-');
  const project = {id,title,place:$('place').value,stage:$('stage').value,notes:$('notes').value.trim()};
  if (save(projectPrefix + id, JSON.stringify(project))) $('editor').close();
};
window.addEventListener('storage', render);
try { render(); } catch {
  $('error').textContent = 'Could not read the board from this browser’s storage.';
  $('error').hidden = false;
  $('add').disabled = $('addLocation').disabled = true;
}
