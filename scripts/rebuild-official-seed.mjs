import {writeFile} from 'node:fs/promises';
import {GAMES,mergeDraws} from '../src/engine.mjs';
import {fetchDraws} from '../src/sync.mjs';
const historical={euromillions:['1a2b3c4d-9876-4562-b3fc-2c963f66afd6','1a2b3c4d-9876-4562-b3fc-2c963f66afc6','1a2b3c4d-9876-4562-b3fc-2c963f66afb6','1a2b3c4d-9876-4562-b3fc-2c963f66afa9','1a2b3c4d-9876-4562-b3fc-2c963f66afa8'],loto:["1a2b3c4d-9876-4562-b3fc-2c963f66afo6","1a2b3c4d-9876-4562-b3fc-2c963f66afn6","1a2b3c4d-9876-4562-b3fc-2c963f66afm6"],eurodreams:[]};
let all=[];for(const game of Object.keys(GAMES)){for(const id of [...historical[game],GAMES[game].archive]){const url='https://www.sto.api.fdj.fr/anonymous/service-draw-info/v3/documentations/'+id;const draws=await fetchDraws(game,fetch,url);all=mergeDraws(all,draws);console.log(game,id,draws.length,draws.at(-1)?.date);}}
await writeFile(new URL('../data/seed.json',import.meta.url),JSON.stringify(all));console.log('Total officiel :',all.length);
