import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {access,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile);
export async function digest(file){const h=createHash('sha512');for await(const chunk of createReadStream(file))h.update(chunk);return h.digest('base64');}
export function supportsArchitecture(bytes,arch){
 const cpu=arch==='x64'?0x01000007:arch==='arm64'?0x0100000c:0;if(!cpu||bytes.length<8)return false;
 const magic=bytes.readUInt32BE(0);
 if(magic===0xcffaedfe||magic===0xcefaedfe)return bytes.readUInt32LE(4)===cpu;
 if(magic===0xfeedfacf||magic===0xfeedface)return bytes.readUInt32BE(4)===cpu;
 const fat64=magic===0xcafebabf||magic===0xbfbafeca,little=magic===0xbebafeca||magic===0xbfbafeca;
 if(!fat64&&magic!==0xcafebabe&&magic!==0xbebafeca)return false;
 const read=offset=>little?bytes.readUInt32LE(offset):bytes.readUInt32BE(offset),count=read(4),stride=fat64?32:20;
 if(count>32||bytes.length<8+count*stride)return false;
 for(let i=0;i<count;i++)if(read(8+i*stride)===cpu)return true;return false;
}
export const installScript=`#!/bin/bash
set -eu
parent_pid="$1"
target="$2"
stage="$3"
status="$4"
relaunch="$5"
backup="$stage/previous.app"
moved=0
installed=0
rollback() {
  code=$?
  if [ "$code" -ne 0 ]; then
    if [ "$moved" -eq 1 ]; then
      if [ "$installed" -eq 1 ]; then mv "$target" "$stage/failed.app" || true; fi
      mv "$backup" "$target" || true
    fi
    printf '{"status":"error"}' > "$status"
  fi
}
trap rollback EXIT
for ((i=0; i<120; i++)); do
  if ! kill -0 "$parent_pid" 2>/dev/null; then break; fi
  sleep 0.5
done
if kill -0 "$parent_pid" 2>/dev/null; then exit 1; fi
mv "$target" "$backup"
moved=1
mv "$stage/Predictions.app" "$target"
installed=1
if [ "$relaunch" = yes ]; then /usr/bin/open -n "$target"; fi
printf '{"status":"installed"}' > "$status"
`;
export async function prepareUpdate({zip,sha512,target,version,arch=process.arch}){
 if(process.platform!=='darwin')throw Error('Installation réservée à macOS');
 if(!path.isAbsolute(target)||!target.endsWith('/Predictions.app')||target.startsWith('/Volumes/')||target.includes('/AppTranslocation/'))throw Error('Placez Predictions dans Applications avant de la mettre à jour.');
 if(!/^\d+\.\d+\.\d+$/.test(version)||!['x64','arm64'].includes(arch))throw Error('Version ou architecture invalide');
 if(!sha512||await digest(zip)!==sha512)throw Error('Le téléchargement ne correspond pas à son empreinte GitHub.');
 await access(path.dirname(target),constants.W_OK);await access(target,constants.W_OK);
 const stage=await mkdtemp(path.join(path.dirname(target),'.predictions-update-'));
 try{
  // Extract into a sibling directory: moving the bundle is then atomic on this volume.
  await exec('/usr/bin/ditto',['-x','-k',zip,stage]);
  const bundle=path.join(stage,'Predictions.app'),plist=path.join(bundle,'Contents/Info.plist');
  const readKey=async key=>(await exec('/usr/libexec/PlistBuddy',['-c','Print '+key,plist])).stdout.trim();
  if(await readKey('CFBundleIdentifier')!=='studio.insrt.predictions'||await readKey('CFBundleShortVersionString')!==version)throw Error('Identité ou version du paquet incorrecte.');
  await exec('/usr/bin/codesign',['--verify','--deep','--strict',bundle]);
  if(!supportsArchitecture(await readFile(path.join(bundle,'Contents/MacOS/Predictions')),arch))throw Error('Architecture du paquet incompatible.');
  const script=path.join(stage,'install.sh');await writeFile(script,installScript,{mode:0o700});
  return {stage,script,target};
 }catch(error){await rm(stage,{recursive:true,force:true});throw error;}
}
export async function launchInstaller(prepared,status,pid=process.pid,relaunch=true){
 await writeFile(status,JSON.stringify({status:'installing',backup:path.join(prepared.stage,'previous.app')}));
 const child=spawn('/bin/bash',[prepared.script,String(pid),prepared.target,prepared.stage,status,relaunch?'yes':'no'],{detached:true,stdio:'ignore'});
 await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});child.unref();
}
export async function previousUpdateStatus(file){try{return JSON.parse(await readFile(file,'utf8'));}catch{return null;}}
