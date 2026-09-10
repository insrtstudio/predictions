import {readFile,writeFile,rename,mkdir,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {mergeDraws,GAMES,validateDraw,isISODate,METHODS} from './engine.mjs';
export class Store {
  constructor(file){this.file=file;this.queue=Promise.resolve();}
  async init(seed){await mkdir(path.dirname(this.file),{recursive:true});try{this.state=JSON.parse(await readFile(this.file,'utf8'));if(this.state.schema!==1||!Array.isArray(this.state.draws)||!Array.isArray(this.state.tickets))throw Error('Base locale non reconnue');this.state.draws=mergeDraws([],this.state.draws);this.state.tickets=this.state.tickets.map(t=>validateTicket(t));}catch(e){if(e.code!=='ENOENT')throw Error('Base locale illisible. Fichier conservé : '+this.file+' — '+e.message);this.state={schema:1,draws:seed,tickets:[],sync:{}};await this.persist(this.state);}return this.state;}
  async persist(next){const tmp=this.file+'.tmp';await writeFile(tmp,JSON.stringify(next),'utf8');await rename(tmp,this.file);}
  update(fn){const job=this.queue.then(async()=>{const next=fn(structuredClone(this.state));await this.persist(next);this.state=next;return next;});this.queue=job.catch(()=>{});return job;}
  async backup(target){await this.queue;await copyFile(this.file,target);}
}
export function validateTicket(t){
  const d=validateDraw(t);if(!isISODate(t.date)||!METHODS[t.method]||typeof t.id!=='string'||t.id.length>100||!Number.isFinite(t.cost)||t.cost<0||t.cost>10000||(t.gain!==null&&(!Number.isFinite(t.gain)||t.gain<0||t.gain>1e10)))throw Error('Grille invalide');
  return {id:t.id,game:d.game,date:d.date,numbers:d.numbers,bonus:d.bonus,method:t.method,cost:t.cost,gain:t.gain};
}
