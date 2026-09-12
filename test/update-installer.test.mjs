import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,access,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {installScript,digest,supportsArchitecture} from '../src/update-installer.mjs';
const exec=promisify(execFile);
async function fixture(){const root=await mkdtemp(path.join(tmpdir(),"predictions ' spaces $-")),target=path.join(root,'Predictions.app'),stage=path.join(root,'stage'),status=path.join(root,'status.json');await mkdir(target);await mkdir(stage);await writeFile(path.join(target,'old'),'old');await writeFile(path.join(stage,'install.sh'),installScript);return {root,target,stage,status};}
test('installer replaces only bundle, preserves backup and handles literal shell characters',async()=>{const f=await fixture();try{await mkdir(path.join(f.stage,'Predictions.app'));await writeFile(path.join(f.stage,'Predictions.app','new'),'new');await exec('/bin/bash',[path.join(f.stage,'install.sh'),'99999999',f.target,f.stage,f.status,'no']);assert.equal(await readFile(path.join(f.target,'new'),'utf8'),'new');assert.equal(await readFile(path.join(f.stage,'previous.app','old'),'utf8'),'old');assert.equal(JSON.parse(await readFile(f.status,'utf8')).status,'installed');}finally{await rm(f.root,{recursive:true,force:true});}});
test('failed replacement restores original bundle',async()=>{const f=await fixture();try{await assert.rejects(exec('/bin/bash',[path.join(f.stage,'install.sh'),'99999999',f.target,f.stage,f.status,'no']));await access(path.join(f.target,'old'));assert.equal(JSON.parse(await readFile(f.status,'utf8')).status,'error');}finally{await rm(f.root,{recursive:true,force:true});}});
test('SHA512 detects altered downloads',async()=>{const f=await fixture();try{const file=path.join(f.root,'zip');await writeFile(file,'one');const first=await digest(file);await writeFile(file,'two');assert.notEqual(await digest(file),first);}finally{await rm(f.root,{recursive:true,force:true});}});

test('Mach-O architecture checks require no Xcode tools',()=>{const thin=Buffer.alloc(32);thin.writeUInt32LE(0xfeedfacf,0);thin.writeUInt32LE(0x01000007,4);assert.equal(supportsArchitecture(thin,'x64'),true);assert.equal(supportsArchitecture(thin,'arm64'),false);const fat=Buffer.alloc(48);fat.writeUInt32BE(0xcafebabe,0);fat.writeUInt32BE(2,4);fat.writeUInt32BE(0x01000007,8);fat.writeUInt32BE(0x0100000c,28);assert.equal(supportsArchitecture(fat,'arm64'),true);assert.equal(supportsArchitecture(fat.subarray(0,10),'arm64'),false);});
