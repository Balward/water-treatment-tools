// Import a real conversion in a disposable browser/API. Never save to production.
const fs=require('node:fs'),fsp=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),express=require('express');
const {launchBrowser,removeTemporaryDirectory}=require('./lib/browser-check.cjs');
(async()=>{
 const file=path.resolve(process.argv[2]||'deployment/sop-word-import/verified/converted.sop.json'),backup=JSON.parse(fs.readFileSync(file)),expected=require('../apps/sop-creator/model').validate(backup.document),steps=expected.groups.flatMap(g=>g.steps);
 const directory=await fsp.mkdtemp(path.join(os.tmpdir(),'sop-word-browser-')),app=express();app.use(express.json({limit:'16mb'}));require('../sop-api')(app,{directory});app.use('/sop-creator',express.static(path.resolve('apps/sop-creator')));app.use('/shared',express.static(path.resolve('shared')));app.use('/assets',express.static(path.resolve('assets')));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));let browser;
 try{
  browser=await launchBrowser({acceptDialogs:true,userGesture:true});const {call,evaluate}=browser;
  const until=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,60));}throw Error('Timed out: '+expression);};
  await call('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/sop-creator/editor.html?import=1'});await until('!!document.getElementById("files-dialog")?.open');
  const root=await call('DOM.getDocument'),input=await call('DOM.querySelector',{nodeId:root.root.nodeId,selector:'#import-file'});await call('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[file]});
  await until('document.querySelectorAll(".photo-editor").length>0&&!document.getElementById("files-dialog").open');
  await until('[...document.querySelectorAll(".document-photos img")].every(i=>i.complete&&i.naturalWidth>0)');
  assert.equal(await evaluate('document.querySelector("[data-meta=title]").value'),expected.title);
  assert.equal(await evaluate('document.querySelector("[data-meta=preparedBy]").value'),expected.preparedBy);
  assert.equal(await evaluate('document.querySelectorAll(".step-editor").length'),steps.length);
  assert.deepEqual(await evaluate('[...document.querySelectorAll(".step-editor")].map(s=>[...s.querySelectorAll("[data-caption]")].map(c=>c.value))'),steps.map(s=>s.photos.map(p=>p.caption)));
  assert.deepEqual(await evaluate('[...document.querySelectorAll(".document-step")].map(s=>[...s.querySelectorAll(".document-photos img")].map(i=>i.src))'),steps.map(s=>s.photos.map(p=>p.data)));
  assert.deepEqual(browser.errors,[]);assert.equal((await fsp.readdir(directory)).filter(n=>n.endsWith('.json')).length,0,'Import does not save to the shared library');
  console.log('Word conversion browser passed: '+steps.length+' steps, '+steps.reduce((n,s)=>n+s.photos.length,0)+' photos, exact embedded bytes, captions, image placement, creator and title. No shared-library writes.');
 }finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));await removeTemporaryDirectory(directory);}
})().catch(e=>{console.error(e);process.exitCode=1;});
