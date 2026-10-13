const { test } = require('node:test');
const assert = require('node:assert/strict');
const { findImage } = require('../scrape-images');

test('image importer rejects missing identifiers, unrelated product metadata, and placeholders', () => {
  const page = '<script type="application/ld+json">' + JSON.stringify({ '@type':'Product', sku:'16001-186', image:'https://supplier.test/pipette.jpg' }) + '</script>';
  assert.deepEqual(findImage(page,'16001-186'),['https://supplier.test/pipette.jpg']);
  assert.deepEqual(findImage(page,'89094-096'),[]);
  assert.deepEqual(findImage(page,''),[]);
  assert.deepEqual(findImage(page,'N/A'),[]);
  const placeholder = '<p>16001-186</p><meta property="og:image" content="https://supplier.test/photo-coming-soon.jpg">';
  assert.deepEqual(findImage(placeholder,'16001-186'),[]);
});
