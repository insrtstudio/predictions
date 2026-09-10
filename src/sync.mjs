import {unzipSync} from 'fflate';
import {GAMES} from './engine.mjs';
import {importCSV} from './importer.mjs';
export const archiveURL=game=>'https://www.sto.api.fdj.fr/anonymous/service-draw-info/v3/documentations/'+GAMES[game].archive;
export async function fetchDraws(game,fetcher=fetch,url=archiveURL(game)){
  const response=await fetcher(url,{signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error(`FDJ répond HTTP ${response.status}`);
  if(Number(response.headers.get('content-length'))>10_000_000)throw Error('Archive trop volumineuse');
  const reader=response.body.getReader(),chunks=[];let size=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>10_000_000)throw Error('Archive trop volumineuse');chunks.push(value);}}finally{await reader.cancel();}
  const zip=unzipSync(Buffer.concat(chunks),{filter:e=>{if(e.originalSize>30_000_000)throw Error('Archive décompressée trop volumineuse');return e.name.endsWith('.csv');}}),entries=Object.values(zip);
  if(entries.length!==1)throw Error('Format archive FDJ inattendu');
  const raw=entries[0];let text=new TextDecoder().decode(raw);if(text.includes('\uFFFD'))text=new TextDecoder('windows-1252').decode(raw);
  const draws=importCSV(text,game,'FDJ').map(d=>({...d,sourceURL:url}));
  if(!draws.length)throw Error('Aucun tirage trouvé');
  const today=new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Paris'});
  if(draws.some(d=>d.date>today))throw Error('Archive contenant un tirage futur');
  return draws;
}
