const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { launchBrowser } = require('./lib/browser-check.cjs');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  let fail = false, legacyCalls = 0, browser;
  const server = http.createServer((req, res) => {
    if (req.url === '/api/operations/users') { res.writeHead(404).end(); return; }
    if (req.url === '/api/plant-rounds/users') {
      legacyCalls++;
      res.writeHead(fail ? 503 : 200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ users: [
        { name: 'Carson Conlin', active: true }, { name: 'Inactive Operator', active: false },
        { name: 'Blaine Alward', active: true },
      ] })); return;
    }
    if (req.url.startsWith('/shared/operations/')) {
      const name = path.basename(req.url);
      if (!['users.js', 'navigation.css'].includes(name)) { res.writeHead(404).end(); return; }
      res.setHeader('Content-Type', name.endsWith('.js') ? 'text/javascript' : 'text/css');
      res.end(fs.readFileSync(path.join(__dirname, '../shared/operations', name))); return;
    }
    res.setHeader('Content-Type', 'text/html');
    res.end('<meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/shared/operations/navigation.css"><label>Operator Name<input id="operator-name" value="Remembered Name"></label><input id="other"><script src="/shared/operations/users.js" defer></script>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    browser = await launchBrowser();
    const { call, evaluate } = browser;
    await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await call('Page.navigate', { url: 'http://127.0.0.1:' + server.address().port });
    const until = async expression => {
      for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await wait(30); }
      throw new Error('Timed out: ' + expression);
    };
    await until('!!document.querySelector(".ops-operator-toggle")');
    await evaluate('document.getElementById("operator-name").focus()');
    await until('document.querySelectorAll("[role=option]").length===2');
    assert.ok(legacyCalls > 0, 'Uses legacy directory when the new endpoint is absent');
    assert.equal(await evaluate('document.querySelector("[role=listbox]").textContent'), 'Blaine AlwardCarson Conlin', 'Shows all active names, sorted, despite a remembered value');
    await evaluate('window.changed=0;document.getElementById("operator-name").addEventListener("change",()=>window.changed++);document.querySelector("[role=option]").click()');
    assert.equal(await evaluate('document.getElementById("operator-name").value'), 'Blaine Alward');
    assert.equal(await evaluate('window.changed'), 1, 'Selection notifies application autosave');
    assert.ok(await evaluate('document.querySelector(".ops-operator-popup").hidden'));
    await evaluate('document.querySelector(".ops-operator-toggle").click()');
    await wait(100);
    assert.ok(await evaluate('document.getElementById("operator-name").readOnly&&document.getElementById("operator-name").inputMode==="none"'),'Operator selection cannot open a text keyboard');
    await call('Input.insertText',{text:'Typed name'});
    assert.equal(await evaluate('document.getElementById("operator-name").value'),'Blaine Alward','Typing cannot change the chosen name');
    await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowDown' });
    await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowDown' });
    await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter' });
    assert.equal(await evaluate('document.getElementById("operator-name").value'), 'Carson Conlin');
    fail = true;
    await evaluate('document.getElementById("other").focus();document.getElementById("operator-name").focus()');
    await until('!document.querySelector(".ops-operator-retry").hidden');
    assert.ok(await evaluate('document.querySelector("[role=status]").textContent.includes("Retry to choose an operator")'));
    fail = false;
    await evaluate('document.querySelector(".ops-operator-retry").click()');
    await until('document.querySelectorAll("[role=option]").length===2');
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'), 'Dropdown fits mobile width');
    assert.deepEqual(browser.errors, []);
    console.log('Operator picker passed: legacy fallback, active names, selection-only entry, blocked typing, selection/autosave events, arrow keys, retry, and mobile width.');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
