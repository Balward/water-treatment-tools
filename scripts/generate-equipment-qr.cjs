// Run from any directory: node scripts/generate-equipment-qr.cjs
const fs=require('node:fs'),path=require('node:path');
const qrcode=require('../apps/operator-inventory/public/vendor/qrcode.js');
const destination='https://water.gibbhub.io/live-operations-dashboard/';
const qr=qrcode(0,'M');
qr.addData(destination);qr.make();
// Four white modules on every side, square modules, no logo obscuring the data.
const svg=qr.createSvgTag({cellSize:2,margin:8,scalable:true,title:'Equipment Status Board Editor'}).replace('<svg ','<svg shape-rendering="crispEdges" ');
fs.writeFileSync(path.join(__dirname,'../assets/qrcodes/equipment-status-edit.svg'),svg+'\n');
console.log(`Equipment editor QR: ${destination} (${qr.getModuleCount()+8} modules including margin)`);
