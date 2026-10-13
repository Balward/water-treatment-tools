// Import a user-chosen direct image without searching for alternatives.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { imageExtension } = require('./scrape-images');
async function main() {
  const [id, link] = process.argv.slice(2);
  const item = require('./catalog.json').items.find(item => item.id === id);
  if (!item || !link) throw new Error('Usage: node import-image.js ITEM_ID HTTPS_IMAGE_URL');
  const url = new URL(link);
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Provide an HTTPS image link without credentials.');
  const response = await fetch(url, {signal:AbortSignal.timeout(30000)});
  if (!response.ok) throw new Error(`Image download failed: HTTP ${response.status}`);
  const chunks = []; let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > 5000000) throw new Error('Image must be smaller than 5 MB.');
    chunks.push(chunk);
  }
  const bytes = Buffer.concat(chunks), ext = imageExtension(bytes);
  if (!ext || bytes.length < 500) throw new Error('Link must return a JPEG, PNG, WebP, or GIF image.');
  const root = path.join(__dirname,'public','images');
  const manifestPath = path.join(root,'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath,'utf8'));
  const filename = `${item.id}.${ext}`;
  fs.writeFileSync(path.join(root,filename),bytes);
  manifest.items[item.id] = {description:item.description,itemNumber:item.itemNumber,src:`/images/${filename}`,productUrl:item.productUrl || link,imageUrl:response.url,sourceType:'user-provided',sourceUrl:link,fetchedAt:new Date().toISOString()};
  manifest.updatedAt = new Date().toISOString();
  fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
  console.log(`Imported user-provided photo for ${item.description}: public/images/${filename}`);
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
