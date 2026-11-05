#!/usr/bin/env node
'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),readline=require('node:readline'),{Writable}=require('node:stream');
const {makePassphraseHash}=require('./application-review-auth');
function replaceSetting(contents,value){
  const lines=contents.split(/\r?\n/).filter(line=>!/^\s*(?:export\s+)?APPLICATION_REVIEW_PASSPHRASE_HASH\s*=/.test(line));
  while(lines.length&&!lines.at(-1).trim())lines.pop();
  // Single quotes prevent Docker Compose from expanding the hash's dollar signs.
  return lines.join('\n')+"\nAPPLICATION_REVIEW_PASSPHRASE_HASH='"+value+"'\n";
}
async function main(){
  const args=process.argv.slice(2);if(args.length&&!(args.length===2&&args[0]==='--settings-file'))throw Error('Usage: node set-application-review-passphrase.js [--settings-file /path/to/.env]');
  if(!process.stdin.isTTY)throw Error('Run this command in an interactive terminal. Passphrases are not accepted in command arguments or logs.');
  const envPath=path.resolve(args[1]||path.join(__dirname,'.env'));
  const silent=new Writable({write(chunk,encoding,callback){callback();}});silent.isTTY=true;
  const rl=readline.createInterface({input:process.stdin,output:silent,terminal:true});
  rl.on('SIGINT',()=>{rl.close();process.exitCode=1;});
  const ask=prompt=>new Promise(resolve=>{process.stdout.write(prompt);rl.question('',answer=>{process.stdout.write('\n');resolve(answer);});});
  let first,second;
  try{first=await ask('New passphrase or code (8+ characters, hidden): ');second=await ask('Enter it again (hidden): ');}finally{rl.close();}
  if(first!==second)throw Error('The entries did not match. No settings were changed.');
  const verifier=await makePassphraseHash(first);first='';second='';
  let previous;try{previous=await fs.readFile(envPath,'utf8');}catch(error){if(error.code!=='ENOENT')throw error;previous='';}
  // Write the mounted file in place: Docker bind-mounted files cannot be renamed.
  await fs.writeFile(envPath,replaceSetting(previous,verifier),{mode:0o600});await fs.chmod(envPath,0o600);
  process.stdout.write('Passphrase hash saved to '+envPath+'. Restart the suite container to apply it. Existing review sessions will then be invalidated.\n');
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={replaceSetting};
