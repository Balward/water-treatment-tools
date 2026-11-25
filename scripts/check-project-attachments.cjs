const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const express = require('express');
const { launchBrowser } = require('./lib/browser-check.cjs');

(async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(),'board-check-'));
  const app = express();
  const db = require('../project-board-api')(app,directory);
  app.use('/apps/project-board',express.static(path.resolve('apps/project-board')));
  app.use('/shared',express.static(path.resolve('shared')));
  app.use('/assets',express.static(path.resolve('assets')));
  const server = await new Promise(resolve => {
    const listener = app.listen(0,'127.0.0.1',()=>resolve(listener));
  });
  const origin = 'http://127.0.0.1:'+server.address().port;
  const browser = await launchBrowser();
  const {call, evaluate} = browser;
  async function waitFor(expression) {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (await evaluate(expression)) return;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw Error('Timed out waiting for ' + expression);
  }
  try {
    await call('Page.navigate', {url:origin+'/apps/project-board/index.html'});
    await waitFor("typeof boardFiles !== 'undefined' && document.getElementById('login') && !$('login').hidden");
    await evaluate("localStorage.setItem('ng.project-board.project.old',JSON.stringify({id:'old',title:'Legacy',place:'Gallery',notes:'',stage:'Approved'}))");
    await evaluate(`new Promise((resolve,reject)=>{
      const req=indexedDB.open('ng.project-board.attachments',1);
      req.onupgradeneeded=()=>req.result.createObjectStore('files',{keyPath:'id'}).createIndex('projectId','projectId');
      req.onsuccess=()=>{
        const tx=req.result.transaction('files','readwrite');
        tx.objectStore('files').put({id:'old-file',projectId:'old',file:new File(['legacy bytes'],'old.pdf')});
        tx.oncomplete=resolve;tx.onerror=reject;
      };
    })`);
    const key = fs.readFileSync(path.join(directory,'access-key.txt'),'utf8').trim();
    await evaluate("$('accessKey').value="+JSON.stringify(key)+";$('login').requestSubmit()");
    await waitFor("localStorage.getItem('ng.project-board.migrated.v1') && document.querySelector('.card')");
    assert.equal(await evaluate("fetch('/api/project-board/projects/old/files/old-file').then(r=>r.text())"),'legacy bytes');
    await waitFor('typeof boardFiles !== "undefined" && document.querySelector(".lane") !== null');
    assert.equal(await evaluate("document.querySelector('.effort').textContent"),'Estimate incomplete');
    assert.deepEqual(await evaluate('[ [0,0,1],[499.99,7.9,1],[500,8,2],[5000,40,2],[5000.01,40.1,3] ].map(([cost,hours,complexity])=>effortScore({cost,hours,complexity}))'),[3,3,6,6,9]);
    await evaluate(`
      $('add').click();
      $('cost').value = '1200';
      $('hours').value = '16';
      $('complexity').value = '1';
      $('title').value = 'Attachment check';
      const transfer = new DataTransfer();
      for (const name of ['plan.xlsx','scope.docx','map.pdf','photo.jpg','skip.exe']) {
        transfer.items.add(new File(['contents of ' + name], name));
      }
      $('files').files = transfer.files;
      $('files').dispatchEvent(new Event('change'));
    `);
    assert.match(await evaluate("$('fileMessage').textContent"), /skip.exe/);
    assert.equal(await evaluate("document.querySelectorAll('#fileList a').length"), 4);
    await evaluate("$('projectForm').requestSubmit()");
    await waitFor("!$('editor').open");
    await evaluate('localStorage.clear()');
    await call('Page.reload');
    await waitFor("!!document.querySelector('.card')");
    assert.equal(await evaluate("document.querySelector('.effort').textContent"),'Effort 5/9');
    await evaluate("document.querySelector('.card').click()");
    await waitFor("document.querySelectorAll('#fileList a').length === 4");
    assert.ok(await evaluate(`Promise.all([...document.querySelectorAll('#fileList a')].map(async link =>
      link.download === link.textContent && await (await fetch(link.href)).text() === 'contents of ' + link.download
    )).then(matches => matches.every(Boolean))`));
    await evaluate("document.querySelector('#fileList button').click(); $('editor').querySelector('[data-close]').click()");
    await evaluate("document.querySelector('.card').click()");
    await waitFor("document.querySelectorAll('#fileList a').length === 4");
    await evaluate("document.querySelector('#fileList button').click(); $('projectForm').requestSubmit()");
    await waitFor("!$('editor').open && projects.find(p=>p.title==='Attachment check')?.files.length === 3");
    await evaluate("document.querySelector('.card').click()");
    await waitFor("document.querySelectorAll('#fileList a').length === 3");
    const second = await launchBrowser();
    try {
      await second.call('Page.navigate',{url:origin+'/apps/project-board/index.html'});
      const download = await second.evaluate(`(async()=>{
        if ((await fetch('/api/project-board')).status !== 401) throw Error('Expected a locked board');
        await fetch('/api/project-board/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:${JSON.stringify(key)}})});
        const state = await (await fetch('/api/project-board')).json();
        const project = state.projects.find(p=>p.title==='Attachment check');
        const file = project.files[0];
        const response = await fetch('/api/project-board/projects/'+project.id+'/files/'+file.id);
        return [project.files.length,file.name,await response.text()];
      })()`);
      assert.equal(download[0],3);
      assert.equal(download[2],'contents of '+download[1]);
    } finally { await second.close(); }
    assert.deepEqual(browser.errors, []);
    console.log('Attachment selection, rejection, persistence, downloads, cancellation and removal passed.');
  } finally {
    await browser.close();
    await new Promise(resolve=>server.close(resolve));
    db.close();
    fs.rmSync(directory,{recursive:true,force:true});
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
