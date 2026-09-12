import {readFile,writeFile,stat} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {digest} from '../src/update-installer.mjs';
const repo='insrtstudio/predictions',{version}=JSON.parse(await readFile('package.json','utf8')),tag='v'+version;
if(!/^\d+\.\d+\.\d+$/.test(version))throw Error('Invalid release version');
const gh=(...args)=>execFileSync('gh',args,{encoding:'utf8'});
// Never mutate an already published version. Increment package.json for the next release.
const releases=JSON.parse(gh('api',`repos/${repo}/releases?per_page=100`));
if(releases.some(r=>r.tag_name===tag&&!r.draft)){console.log(tag+' already published');process.exit(0);}
const assets=[],files=[];
for(const arch of ['x64','arm64'])for(const extension of ['zip','dmg']){const name=`Predictions-${version}-${arch}.${extension}`,file='release-assets/'+name;const size=(await stat(file)).size;assets.push(file);if(extension==='zip')files.push({url:name,sha512:await digest(file),size});}
const manifest='release-assets/latest-mac.yml';await writeFile(manifest,JSON.stringify({version,files,path:files[0].url,sha512:files[0].sha512,releaseDate:new Date().toISOString()},null,2));assets.push(manifest);
const body='release-assets/notes.md';await writeFile(body,`Predictions ${version}\n\nGrilles manuelles, comptes à rebours et notifications facultatives. Téléchargement automatique des prochaines versions via GitHub, puis remplacement de l’application au clic sur « Redémarrer et installer ». Données conservées ; ancien programme sauvegardé.\n\nPour les versions 0.1.0 à 0.1.2 : installez une fois cette version via le DMG pour activer le nouveau mécanisme. Choisissez x64 pour un Mac Intel ou arm64 pour Apple Silicon.\n\nPaquets signés localement (ad hoc), sans notarisation Apple. Installation, remplacement, démarrage et parcours testés sur Intel et Apple Silicon.\n`);
if(!releases.some(r=>r.tag_name===tag))gh('release','create',tag,'--repo',repo,'--target',process.env.RELEASE_COMMIT,'--draft','--title',`Predictions ${version}`,'--notes-file',body);
gh('release','upload',tag,...assets,'--repo',repo,'--clobber');
gh('release','edit',tag,'--repo',repo,'--draft=false','--latest','--notes-file',body);
console.log(`Published ${tag} with both architectures and latest-mac.yml`);
