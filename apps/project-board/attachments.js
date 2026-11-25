'use strict';

const boardFiles = (() => {
  const picker = document.getElementById('files');
  const list = document.getElementById('fileList');
  const message = document.getElementById('fileMessage');
  const extensions = /\.(xlsx?|xlsm|xlsb|xltx?|xltm|csv|docx?|docm|dotx?|dotm|pdf|jpe?g|png|gif|webp|bmp|tiff?|heic|heif|avif|svg|ico)$/i;
  picker.accept = '.xls,.xlsx,.xlsm,.xlsb,.xlt,.xltx,.xltm,.csv,.doc,.docx,.docm,.dot,.dotx,.dotm,.pdf,image/*,.heic,.heif,.tif,.tiff';
  let database;
  let generation = 0;
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
      link.href = URL.createObjectURL(entry.file);
      urls.push(link.href);
      link.download = entry.file.name;
      link.textContent = entry.file.name;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Remove';
      remove.setAttribute('aria-label', 'Remove ' + entry.file.name);
      remove.onclick = () => {
        entries = entries.filter(item => item !== entry);
        if (!entry.pending) removed.push(entry.id);
        renderList();
      };
      row.append(link, remove);
      list.append(row);
    }
  }

  function reset() {
    generation++;
    entries = [];
    removed = [];
    picker.value = '';
    picker.disabled = false;
    message.textContent = '';
    renderList();
  }

  async function open(projectId) {
    reset();
    if (!projectId) return;
    picker.disabled = true;
    const current = generation;
    try {
      const db = await connect();
      const saved = await new Promise((resolve, reject) => {
        const request = db.transaction('files').objectStore('files').index('projectId').getAll(projectId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      if (current !== generation) return;
      entries = saved;
      picker.disabled = false;
      renderList();
    } catch {
      if (current === generation) message.textContent = 'Could not load attachments. Close and reopen the project to retry.';
    }
  }

  picker.onchange = () => {
    const rejected = [];
    for (const file of picker.files) {
      if (extensions.test(file.name) || file.type.startsWith('image/')) {
        entries.push({id:Array.from(crypto.getRandomValues(new Uint32Array(4))).join('-'), file, pending:true});
      } else rejected.push(file.name);
    }
    picker.value = '';
    message.textContent = rejected.length ? 'Unsupported file type: ' + rejected.join(', ') : '';
    renderList();
  };

  async function commit(projectId) {
    const additions = entries.filter(entry => entry.pending);
    if (!additions.length && !removed.length) return;
    const db = await connect();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('files','readwrite');
      tx.oncomplete = resolve;
      tx.onabort = () => reject(tx.error);
      const store = tx.objectStore('files');
      for (const id of removed) store.delete(id);
      for (const {id,file} of additions) store.put({id,projectId,file});
    });
  }
  return {open, reset, commit};
})();
