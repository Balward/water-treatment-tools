const assert = require('node:assert/strict');
const { createBrowserCheck } = require('./lib/browser-check.cjs');

(async () => {
  const browser = await createBrowserCheck();
  const {call, evaluate} = browser;
  async function waitFor(expression) {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (await evaluate(expression)) return;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw Error('Timed out waiting for ' + expression);
  }
  try {
    await call('Page.navigate', {url:'http://127.0.0.1:8782/apps/project-board/index.html'});
    await waitFor('typeof boardFiles !== "undefined" && document.querySelector(".lane") !== null');
    await evaluate(`
      $('add').click();
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
    await call('Page.reload');
    await waitFor("!!document.querySelector('.card')");
    await evaluate("document.querySelector('.card').click()");
    await waitFor("document.querySelectorAll('#fileList a').length === 4");
    assert.ok(await evaluate(`Promise.all([...document.querySelectorAll('#fileList a')].map(async link =>
      link.download === link.textContent && await (await fetch(link.href)).text() === 'contents of ' + link.download
    )).then(matches => matches.every(Boolean))`));
    await evaluate("document.querySelector('#fileList button').click(); $('editor').querySelector('[data-close]').click()");
    await evaluate("document.querySelector('.card').click()");
    await waitFor("document.querySelectorAll('#fileList a').length === 4");
    await evaluate("document.querySelector('#fileList button').click(); $('projectForm').requestSubmit()");
    await waitFor("!$('editor').open");
    await evaluate("document.querySelector('.card').click()");
    await waitFor("document.querySelectorAll('#fileList a').length === 3");
    assert.deepEqual(browser.errors, []);
    console.log('Attachment selection, rejection, persistence, downloads, cancellation and removal passed.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
