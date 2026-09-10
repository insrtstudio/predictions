import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
const dir=await mkdtemp(path.join(tmpdir(),'predictions-smoke-')),errors=[];
await mkdir('test-results',{recursive:true});
async function launch(){return electron.launch({args:['.'],env:{...process.env,PREDICTIONS_TEST:'1',PREDICTIONS_DATA_DIR:dir}});}
let app;
try{
 app=await launch();let w=await app.firstWindow();w.on('pageerror',e=>errors.push(e.message));await w.waitForSelector('.heatmap');
 assert.equal(await w.locator('.heat').count(),50);await w.screenshot({path:'test-results/dashboard.png',fullPage:true});
 await w.getByRole('button',{name:'Loto',exact:true}).click();assert.equal(await w.locator('.heat').count(),49);
 await w.getByRole('button',{name:'EuroDreams',exact:true}).click();assert.equal(await w.locator('.heat').count(),40);
 await w.getByRole('button',{name:'Mes grilles'}).click();await w.locator('#count').fill('3');await w.locator('#ticket-date').fill('2026-09-07');await w.locator('#generate').click();assert.equal(await w.locator('[data-save]').count(),3);
 await w.locator('[data-save]').first().click();await w.waitForSelector('[data-gain]');await w.locator('[data-gain]').fill('0');await w.locator('[data-gain]').press('Tab');await w.waitForFunction(()=>document.querySelector('.card:nth-child(2) .metric')?.textContent.includes('2,50'));
 assert.equal(JSON.parse(await readFile(path.join(dir,'predictions.json'),'utf8')).tickets[0].gain,0);
 await w.getByRole('button',{name:'Laboratoire'}).click();await w.waitForSelector('tbody tr',{timeout:120000});await w.getByRole('button',{name:'Analyser les motifs'}).waitFor({state:'visible',timeout:120000});await w.screenshot({path:'test-results/lab.png',fullPage:true});
 await w.getByRole('button',{name:'Probabilités'}).click();await w.locator('#coverage').fill('10');assert.ok((await w.locator('#coverage-result').textContent()).includes('%'));
 await w.getByRole('button',{name:'Historique',exact:false}).click();await w.locator('#search').fill('2026-09-07');await w.locator('#search').press('Tab');assert.equal(await w.locator('tbody tr').count(),1);
 await w.getByRole('button',{name:'Sources & mises à jour',exact:false}).click();await w.locator('#check-update').click();await w.waitForFunction(()=>document.querySelector('#update-status')?.textContent.includes('version installée'));
 await app.close();app=await launch();w=await app.firstWindow();await w.waitForSelector('.heatmap');await w.getByRole('button',{name:'EuroDreams',exact:true}).click();await w.getByRole('button',{name:'Mes grilles'}).click();await w.waitForSelector('[data-gain]');assert.equal(await w.locator('[data-gain]').inputValue(),'0');
 assert.deepEqual(errors,[]);console.log('PASS: navigation, grids, persisted zero gains, probabilities, search, workers, updater development state, restart.');
}finally{await app?.close();}
