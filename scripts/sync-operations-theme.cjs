const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=path.join(root,'shared','operations');
const destination=path.join(root,'apps','operator-inventory','public','shared','operations');
fs.mkdirSync(destination,{recursive:true});
for(const name of fs.readdirSync(source))if(fs.statSync(path.join(source,name)).isFile())fs.copyFileSync(path.join(source,name),path.join(destination,name));
console.log('Shared Operations theme synchronized into the standalone inventory package.');
