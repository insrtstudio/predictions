import {readFile,writeFile} from 'node:fs/promises';
import {GAMES,mergeDraws} from '../src/engine.mjs';
import {fetchDraws} from '../src/sync.mjs';
const url=new URL('../data/seed.json',import.meta.url);let draws=[];try{draws=JSON.parse(await readFile(url,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
for(const game of Object.keys(GAMES)){const rows=await fetchDraws(game);draws=mergeDraws(draws,rows);console.log(game,rows.length,rows.map(d=>d.date).sort().at(-1));}
await writeFile(url,JSON.stringify(draws));
