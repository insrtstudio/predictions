import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {GAMES,METHODS,choose,jackpot,probability,generate,validateDraw,mergeDraws,compatible,seeded,backtest,stats,compareTicket} from '../src/engine.mjs';
import {deepDiagnostics} from '../src/diagnostics.mjs';
import {importCSV,parseCSV} from '../src/importer.mjs';
import {Store,validateTicket} from '../src/store.mjs';
import {fetchDraws} from '../src/sync.mjs';
import {zipSync,strToU8} from 'fflate';
const seed=JSON.parse(await readFile(new URL('../data/seed.json',import.meta.url),'utf8'));
test('exact jackpot counts and exhaustive probability mass',()=>{
 assert.equal(choose(50,5),2118760);assert.equal(jackpot('euromillions'),139838160);assert.equal(jackpot('loto'),19068840);assert.equal(jackpot('eurodreams'),19191900);
 for(const [game,g]of Object.entries(GAMES)){let sum=0;for(let m=0;m<=g.k;m++)for(let b=0;b<=g.j;b++)sum+=probability(game,m,b);assert.ok(Math.abs(sum-1)<1e-12);assert.equal(probability(game,g.k,g.j),1/jackpot(game));}
});
test('historical star regimes, invalid dates and duplicate balls',()=>{
 const d={game:'euromillions',date:'2010-01-01',numbers:[1,2,3,4,5],bonus:[1,10]};assert.throws(()=>validateDraw(d));assert.doesNotThrow(()=>validateDraw({...d,date:'2012-01-01'}));assert.throws(()=>validateDraw({...d,date:'2026-02-30'}));assert.throws(()=>validateDraw({...d,date:'2026-01-01',numbers:[1,1,3,4,5]}));
 assert.ok(compatible(seed,'euromillions').every(d=>d.date>='2016-09-27'));
});
test('all bundled draws valid and deduplicated',()=>{assert.ok(seed.length>3000);assert.equal(mergeDraws([],seed).length,seed.length);seed.forEach(validateDraw);});
test('all strategies produce valid unique grids for all games',()=>{for(const game of Object.keys(GAMES))for(const method of Object.keys(METHODS)){const ds=generate(seed,game,method,40,seeded(42));assert.equal(new Set(ds.map(d=>d.numbers+'|'+d.bonus)).size,40);ds.forEach(d=>validateDraw({...d,date:'2026-09-10'}));}assert.throws(()=>generate(seed,'loto','uniform',101));});
test('uniform sampler has expected marginal frequency',()=>{const rng=seeded(829),counts=Array(50).fill(0);for(let i=0;i<10000;i++)generate([],'euromillions','uniform',1,rng)[0].numbers.forEach(n=>counts[n-1]++);assert.ok(counts.every(v=>Math.abs(v-1000)<130));});
test('CSV supports quotes, CRLF and BOM; rejects malformed rows atomically',()=>{
 assert.deepEqual(parseCSV('\uFEFFa;b\r\n"x;y";"z"\r\n'),[{a:'x;y',b:'z'}]);assert.throws(()=>parseCSV('a;b\n"oops;b'));
 const csv='date;n1;n2;n3;n4;n5;b1\n09/09/2026;1;2;3;4;5;6';const d=importCSV(csv,'loto')[0];assert.equal(d.date,'2026-09-09');assert.deepEqual(d.bonus,[6]);assert.throws(()=>importCSV(csv+'\n10/09/2026;1;1;3;4;5;6','loto'));
});
test('FDJ records have precedence and corrections replace existing draws',()=>{const d=seed.find(d=>d.source==='FDJ'&&d.game==='loto');assert.equal(mergeDraws([d],[{...d,source:'CSV',numbers:[1,2,3,4,5]}])[0].source,'FDJ');const fixed={...d,numbers:[1,2,3,4,5]};assert.deepEqual(mergeDraws([d],[fixed])[0].numbers,[1,2,3,4,5]);});
test('backtest uses 100 training draws minimum and is reproducible',()=>{const rows=compatible(seed,'loto').slice(0,120),a=backtest(rows,'loto',{window:20,trials:3,seed:2}),b=backtest(rows,'loto',{window:20,trials:3,seed:2});assert.deepEqual(a,b);assert.equal(a.length,8);assert.ok(a.every(r=>r.draws===20&&r.from===rows[100].date&&r.mean>=0&&r.mean<=5));assert.throws(()=>backtest(rows.slice(0,100),'loto'));});
test('generation for a training prefix is unaffected by later draws',()=>{const rows=compatible(seed,'loto');for(const method of Object.keys(METHODS)){const train=rows.slice(0,100),copy=structuredClone(rows);copy[100].numbers=[1,2,3,4,5];assert.deepEqual(generate(train,'loto',method,3,seeded(2)),generate(copy.slice(0,100),'loto',method,3,seeded(2)));}});
test('simulation detects a deliberately biased history with corrected search',()=>{const rows=Array.from({length:100},(_,i)=>({game:'loto',date:new Date(Date.UTC(2020,0,i+1)).toISOString().slice(0,10),numbers:[1,2,3,4,5],bonus:[1]}));const d=deepDiagnostics(rows,'loto',{simulations:99});assert.equal(d.tests.length,8);assert.equal(d.tests[0].p,.01);assert.equal(d.tests[2].p,.01);assert.ok(d.tests.every(t=>Number.isFinite(t.value)&&t.p>0&&t.p<=1));});
test('known gaps, counts and ticket matching',()=>{const d={game:'loto',date:'2026-09-09',numbers:[1,2,3,4,5],bonus:[6]};const s=stats([d],'loto');assert.equal(s[0].count,1);assert.equal(s[0].gap,0);assert.equal(s[5].gap,1);assert.deepEqual(compareTicket({numbers:[1,2,6,7,8],bonus:[6]},d),{main:2,bonus:1});});
test('concurrent persistence updates survive a restart and invalid state is preserved',async()=>{
 const folder=await mkdtemp(path.join(tmpdir(),'predictions-store-')),file=path.join(folder,'state.json'),s=new Store(file);await s.init([]);await Promise.all(Array.from({length:10},()=>s.update(v=>({...v,counter:(v.counter||0)+1}))));const reopened=new Store(file);await reopened.init([]);assert.equal(reopened.state.counter,10);await writeFile(file,'broken');await assert.rejects(new Store(file).init([]));assert.equal(await readFile(file,'utf8'),'broken');
});
test('ticket gain validation distinguishes zero from unknown',()=>{const t={id:'test',game:'loto',date:'2026-09-09',numbers:[1,2,3,4,5],bonus:[1],method:'uniform',cost:2.2,gain:null};assert.equal(validateTicket(t).gain,null);assert.equal(validateTicket({...t,gain:0}).gain,0);assert.throws(()=>validateTicket({...t,gain:-1}));});
test('FDJ download parser accepts zip CSV; rejects network and schema failures',async()=>{const csv='date_de_tirage;boule_1;boule_2;boule_3;boule_4;boule_5;numero_chance\n09/09/2026;1;2;3;4;5;6',archive=zipSync({'loto.csv':strToU8(csv)});const result=await fetchDraws('loto',async()=>new Response(archive));assert.equal(result[0].source,'FDJ');await assert.rejects(fetchDraws('loto',async()=>new Response('',{status:503})));await assert.rejects(fetchDraws('loto',async()=>new Response(zipSync({'wrong.csv':strToU8('wrong;schema\n1;2')}))))});
