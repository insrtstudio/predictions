import {execFileSync} from 'node:child_process';
import {readdir} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

// Check the actual delivered bundle, not merely builder configuration.
const target=process.argv[2];
if(!target)throw Error('Usage: node scripts/verify-macos-signature.mjs <Predictions.app> [--release]');
const release=process.argv.includes('--release');
execFileSync('codesign',['--verify','--deep','--strict',target],{stdio:'inherit'});
const bundles=[path.resolve(target)];
async function scan(dir){for(const item of await readdir(dir,{withFileTypes:true})){if(!item.isDirectory())continue;const p=path.join(dir,item.name);if(item.name.endsWith('.app'))bundles.push(p);await scan(p);}}
await scan(path.join(target,'Contents','Frameworks'));
for(const bundle of bundles){
 const plist=execFileSync('codesign',['-d','--entitlements',':-',bundle],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
 const rights=JSON.parse(execFileSync('plutil',['-convert','json','-o','-','-'],{input:plist,encoding:'utf8',stdio:['pipe','pipe','pipe']}));
 const entitlement=key=>rights[key]===true;
 assert.ok(entitlement('com.apple.security.cs.allow-jit'),`Missing JIT entitlement: ${bundle}`);
 assert.equal(entitlement('com.apple.security.cs.disable-library-validation'),!release,`Incorrect library validation entitlement (${release?'release':'ad-hoc'}): ${bundle}`);
 console.log('PASS entitlements:',bundle);
}
console.log(`PASS: bundle signature and ${bundles.length} executable bundles checked (${release?'release':'ad-hoc test'} profile).`);
