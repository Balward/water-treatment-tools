'use strict';
// Optional real-browser integration check: node test/bin-card-browser.js
const {spawn} = require('node:child_process');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const assert = require('node:assert/strict');
const {createApp} = require('../server');
async function main() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(),'inventory-card-browser-'));
  const server = createApp({dataDir:path.join(temp,'data'),mailer:{enabled:false}});
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const chrome = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=0','--user-data-dir=' + path.join(temp,'profile'),'about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
  let socket;
  try {
    const url = await new Promise((resolve,reject) => {
      let output = '';
      const timeout = setTimeout(() => reject(new Error('Chrome startup timed out')),20000);
      chrome.on('error',reject);
      chrome.stderr.on('data',chunk => { output += chunk; const match = output.match(/DevTools listening on (ws:\/\/\S+)/); if (match) { clearTimeout(timeout); resolve(match[1]); } });
    });
    socket = new WebSocket(url);
    await new Promise((resolve,reject) => { socket.addEventListener('open',resolve); socket.addEventListener('error',reject); });
    let sequence = 0, sessionId;
    const requests = new Map(), errors = [];
    socket.addEventListener('message',event => {
      const data = JSON.parse(event.data);
      if (data.method === 'Runtime.exceptionThrown') errors.push(data.params.exceptionDetails);
      if (requests.has(data.id)) { const request = requests.get(data.id); requests.delete(data.id); data.error ? request.reject(new Error(JSON.stringify(data.error))) : request.resolve(data.result); }
    });
    function call(method,params = {}) {
      const id = ++sequence;
      return new Promise((resolve,reject) => { requests.set(id,{resolve,reject}); socket.send(JSON.stringify({id,method,params,...(sessionId ? {sessionId} : {})})); });
    }
    async function evaluate(expression) {
      const result = await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      return result.result.value;
    }
    async function until(expression) {
      for (let attempt = 0; attempt < 150; attempt++) { if (await evaluate(expression)) return; await new Promise(resolve => setTimeout(resolve,100)); }
      throw new Error('Timed out: ' + expression + '\n' + await evaluate('document.body.innerText.slice(0,1800)'));
    }
    async function page(url) {
      const target = await call('Target.createTarget',{url:'about:blank'});
      sessionId = (await call('Target.attachToTarget',{targetId:target.targetId,flatten:true})).sessionId;
      await call('Page.enable'); await call('Runtime.enable');
      await call('Page.navigate',{url});
    }
    const previewDir = path.join(__dirname,'../preview'); fs.mkdirSync(previewDir,{recursive:true});
    async function screenshot(name) {
      const result = await call('Page.captureScreenshot',{format:'png'});
      fs.writeFileSync(path.join(previewDir,name + '.png'),Buffer.from(result.data,'base64'));
    }
    await page(base);
    await until('document.querySelectorAll("[data-worksheet]").length === 3');
    await evaluate('document.getElementById("nav-manage").click()');
    await until('!document.getElementById("item-manager").hidden && document.querySelectorAll("[data-edit-item]").length === 40');
    assert.equal(await evaluate('document.getElementById("nav-manage").getAttribute("aria-current")'),'page');
    assert.equal(await evaluate('document.querySelectorAll("[data-print-bin-card]").length'),40);
    await evaluate('document.getElementById("manager-worksheet").value="janitorial";document.getElementById("manager-worksheet").dispatchEvent(new Event("change"))');
    assert.equal(await evaluate('document.querySelectorAll("[data-print-bin-card]").length'),0);
    await evaluate('document.getElementById("print-bin-cards-tab").click()');
    assert.equal(await evaluate('document.querySelectorAll("[data-bin-card]").length'),40);
    assert.ok(await evaluate('document.getElementById("print-selected-bin-cards").disabled'));
    for (const width of [320,390,430,1366]) {
      await call('Emulation.setDeviceMetricsOverride',{width,height:850,deviceScaleFactor:1,mobile:false});
      assert.ok(await evaluate('document.querySelectorAll(".bottom-nav button>span>svg").length===5 && [...document.querySelectorAll(".bottom-nav button>span>svg")].every(icon=>icon.getBoundingClientRect().width===24 && icon.getBoundingClientRect().height===24)'),'Navigation icons have consistent sizing at ' + width);
      assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'),'No page overflow at ' + width);
      assert.ok(await evaluate('document.getElementById("app-scroll").scrollWidth <= document.getElementById("app-scroll").clientWidth + 1'),'No management overflow at ' + width);
    }
    await call('Emulation.setDeviceMetricsOverride',{width:390,height:850,deviceScaleFactor:1,mobile:false});
    await evaluate('document.getElementById("select-all-bin-cards").click()');
    assert.equal(await evaluate('selectedBinCards.size'),40);
    await evaluate('document.getElementById("bin-card-search").value="2770120";document.getElementById("bin-card-search").dispatchEvent(new Event("input"))');
    assert.equal(await evaluate('document.querySelectorAll("[data-bin-card]").length'),1);
    await evaluate('document.querySelector("[data-bin-card]").click()');
    assert.equal(await evaluate('selectedBinCards.size'),39,'Filtering does not discard hidden selections');
    await evaluate('document.getElementById("clear-bin-cards").click();document.getElementById("bin-card-search").value="";document.getElementById("bin-card-search").dispatchEvent(new Event("input"));window.open=(url)=>{window.lastPrintUrl=url}');
    assert.equal(await evaluate('document.querySelectorAll("[data-bin-card]:checked").length'),0);
    await evaluate('document.querySelector("[data-bin-card=s1-r7]").click();document.getElementById("print-selected-bin-cards").click()');
    assert.deepEqual(new URL(await evaluate('lastPrintUrl'),base).searchParams.getAll('id'),['s1-r7']);
    await screenshot('bin-card-management-mobile');
    await evaluate('document.getElementById("manage-items-tab").click();document.getElementById("manager-worksheet").value="operating";document.getElementById("manager-worksheet").dispatchEvent(new Event("change"));document.querySelector("[data-print-bin-card=s1-r5]").click()');
    assert.deepEqual(new URL(await evaluate('lastPrintUrl'),base).searchParams.getAll('id'),['s1-r5']);
    const catalog = await (await fetch(base + '/api/catalog')).json();
    const ids = catalog.items.filter(i => i.sourceSheet === 1).map(i => i.id);
    const changed = catalog.items.find(i => i.id === 's1-r5');
    const save = await fetch(base + '/api/catalog/items/' + changed.id,{method:'PATCH',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({...changed,worksheet:'operating',revision:catalog.revision,par:3,company:'Updated supplier',itemNumber:'PRINT-123'})});
    assert.equal(save.status,200);
    const renamedProducts = {'s1-r25':'Swiftest Free Chlorine Reagent Refill Vial','s1-r26':'Swiftest Total Chlorine Reagent Refill Vial','s1-r33':'Turbidimeter Vial','s1-r34':'Free Chlorine Reagent Set','s1-r36':'Turbidimeter Wiper'};
    for (const [id,description] of Object.entries(renamedProducts)) {
      const current = await (await fetch(base + '/api/catalog')).json();
      const item = current.items.find(i => i.id === id);
      const response = await fetch(base + '/api/catalog/items/' + id,{method:'PATCH',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({...item,worksheet:'operating',revision:current.revision,description})});
      assert.equal(response.status,200);
    }
    await evaluate('openManager()');
    assert.ok(await evaluate(JSON.stringify(Object.keys(renamedProducts)) + '.every(id=>productPhoto(catalog.items.find(i=>i.id===id)).includes("/images/"))'),'Inventory photos survive display-name edits');
    await page(base + '/bin-cards.html?' + ids.map(id => 'id=' + id).join('&'));
    await until('document.documentElement.dataset.cardsReady === "true"');
    assert.equal(await evaluate('document.querySelectorAll(".bin-card").length'),40);
    assert.equal(await evaluate('document.querySelectorAll(".bin-sheet").length'),7);
    assert.ok(await evaluate(JSON.stringify(Object.keys(renamedProducts)) + '.every(id=>document.querySelector(\'[data-id="\'+id+\'"] .bin-photo\')?.naturalWidth>0)'),'All five renamed products load their photos in the print preview');
    assert.equal(await evaluate('document.getElementById("print-cards").disabled'),false,await evaluate('document.getElementById("print-status").textContent + document.getElementById("print-warnings").textContent'));
    assert.ok(await evaluate('document.querySelector("[data-id=s1-r5]").textContent.includes("Updated supplier") && document.querySelector("[data-id=s1-r5]").textContent.includes("#PRINT-123") && document.querySelector("[data-id=s1-r5]").textContent.includes("3 Bottle")'));
    assert.ok(await evaluate('document.getElementById("print-warnings").textContent.includes("Photo unavailable")'),'Changed product metadata flags stale photos');
    assert.ok(await evaluate('[...document.querySelectorAll(".bin-card")].every(c=>c.offsetWidth===384&&c.offsetHeight===168)'),'Cards retain 4 by 1.75 inch dimensions');
    await call('Emulation.setDeviceMetricsOverride',{width:1120,height:900,deviceScaleFactor:1,mobile:false});
    await screenshot('bin-card-print-preview');
    await evaluate('window.print=()=>{window.testPrinted=true};document.getElementById("print-cards").click()');
    assert.ok(await evaluate('window.testPrinted'));
    await call('Emulation.setEmulatedMedia',{media:'print'});
    assert.equal(await evaluate('getComputedStyle(document.querySelector(".print-toolbar")).display'),'none');
    assert.ok(await evaluate('[...document.querySelectorAll(".bin-sheet")].every(s=>s.offsetHeight===816&&s.offsetWidth===1056)'),'Six cards fit a landscape Letter page');
    await call('Emulation.setEmulatedMedia',{media:''});
    await page(base + '/bin-cards.html?id=s2-r5&id=s1-r7');
    await until('document.documentElement.dataset.cardsReady === "true"');
    assert.equal(await evaluate('document.querySelectorAll(".bin-card").length'),1,'Non-operating IDs cannot be printed');
    assert.ok(await evaluate('document.getElementById("print-warnings").textContent.includes("omitted")'));
    await page(base + '/bin-cards.html?id=deleted-item');
    await until('document.documentElement.dataset.cardsReady === "true"');
    assert.ok(await evaluate('document.getElementById("print-cards").disabled'));
    assert.equal(await evaluate('document.querySelectorAll(".bin-card").length'),0);
    assert.deepEqual(await (await fetch(base + '/api/inventories')).json(),[]);
    assert.equal(errors.length,0,JSON.stringify(errors));
    console.log('Bin-card browser checks passed: selection, individual printing, live edits, 40 card layouts, print sizing, missing metadata, Operating Supplies restriction, and mobile/desktop navigation.');
  } finally {
    socket?.close(); chrome.kill();
    await new Promise(resolve => server.close(resolve));
    await new Promise(resolve => setTimeout(resolve,500));
    fs.rmSync(temp,{recursive:true,force:true,maxRetries:5,retryDelay:200});
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
