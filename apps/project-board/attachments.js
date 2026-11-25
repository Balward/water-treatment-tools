'use strict';

const boardFiles = (() => {
  const picker = document.getElementById('files');
  const list = document.getElementById('fileList');
  const message = document.getElementById('fileMessage');
  const extensions = /\.(xlsx?|xlsm|xlsb|xltx?|xltm|csv|docx?|docm|dotx?|dotm|pdf|jpe?g|png|gif|webp|bmp|tiff?|heic|heif|avif|svg|ico)$/i;
  picker.accept = '.xls,.xlsx,.xlsm,.xlsb,.xlt,.xltx,.xltm,.csv,.doc,.docx,.docm,.dot,.dotx,.dotm,.pdf,image/*,.heic,.heif,.tif,.tiff';
  let database;
  let entries = [];
  let removed = [];
  let urls = [];

  function connect() {
    if (!database) database = new Promise((resolve, reject) => {
      const request = indexedDB.open('ng.project-board.attachments', 1);
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore('files', {keyPath:'id'});
        store.createIndex('projectId', 'projectId');
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }).catch(error => { database = null; throw error; });
    return database;
  }

  function renderList() {
    urls.forEach(url => URL.revokeObjectURL(url));
    urls = [];
    list.replaceChildren();
    for (const entry of entries) {
      const row = document.createElement('li');
      const link = document.createElement('a');
      if (entry.file) {
        link.href = URL.createObjectURL(entry.file);
        urls.push(link.href);
      } else {
        link.href = '/api/project-board/projects/' + entry.projectId + '/files/' + entry.id;
      }
      link.download = entry.name;
      link.textContent = entry.name;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Remove';
      remove.setAttribute('aria-label', 'Remove ' + entry.name);
      remove.onclick = () => {
        entries = entries.filter(item => item !== entry);
        if (!entry.file) removed.push(entry.id);
        renderList();
      };
      row.append(link, remove);
      list.append(row);
    }
  }

  function reset() {
    entries = [];
    removed = [];
    picker.value = '';
    picker.disabled = false;
    message.textContent = '';
    renderList();
  }

  function open(project) {
    reset();
    entries = (project?.files || []).map(item => ({...item,projectId:project.id}));
    renderList();
  }

  async function legacy(projectId) {
    const db = await connect();
    return new Promise((resolve,reject) => {
      const request = db.transaction('files').objectStore('files').index('projectId').getAll(projectId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  picker.onchange = () => {
    const rejected = [];
    for (const file of picker.files) {
      if (extensions.test(file.name) || file.type.startsWith('image/')) {
        entries.push({id:Array.from(crypto.getRandomValues(new Uint32Array(4))).join('-'), file, name:file.name});
      } else rejected.push(file.name);
    }
    picker.value = '';
    message.textContent = rejected.length ? 'Unsupported file type: ' + rejected.join(', ') : '';
    renderList();
  };

  function changes() { return {uploads:entries.filter(entry => entry.file),removed}; }
  return {open, reset, changes, legacy};
})();
