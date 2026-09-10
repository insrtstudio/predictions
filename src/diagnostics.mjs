import {GAMES,compatible,seeded} from './engine.mjs';
// All searches are calibrated against complete independent draws, preserving
// the negative dependence between numbers sampled without replacement.
export function deepDiagnostics(draws,game,{simulations=499,seed=718}={}){
 const history=compatible(draws,game),g=GAMES[game],n=history.length;if(n<30)throw Error('Au moins 30 tirages compatibles requis.');
 const rng=seeded(seed),en=n*g.k/g.n,eb=n*g.j/g.b,pairP=g.k*(g.k-1)/(g.n*(g.n-1)),ep=n*pairP;
 const trig=Array.from({length:29},(_,p)=>({cos:Float64Array.from({length:n},(_,i)=>Math.cos(2*Math.PI*i/(p+2))),sin:Float64Array.from({length:n},(_,i)=>Math.sin(2*Math.PI*i/(p+2)))}));
 function measure(rows){
  const counts=new Uint32Array(g.n+1),bonuses=new Uint32Array(g.b+1),pairs=new Uint32Array((g.n+1)**2),sums=new Float64Array(n);let repeats=0;
  rows.forEach((d,i)=>{for(let a=0;a<g.k;a++){const v=d.numbers[a];counts[v]++;sums[i]+=v;for(let b=a+1;b<g.k;b++){const w=d.numbers[b];pairs[Math.min(v,w)*(g.n+1)+Math.max(v,w)]++;}}d.bonus.forEach(v=>bonuses[v]++);if(i)repeats+=d.numbers.filter(v=>rows[i-1].numbers.includes(v)).length;});
  let dispersion=0,maxNumber=0,bonusDispersion=0,maxPair=0;
  for(let v=1;v<=g.n;v++){dispersion+=(counts[v]-en)**2/en;maxNumber=Math.max(maxNumber,Math.abs(counts[v]-en)/Math.sqrt(en*(1-g.k/g.n)));for(let w=v+1;w<=g.n;w++)maxPair=Math.max(maxPair,Math.abs(pairs[v*(g.n+1)+w]-ep)/Math.sqrt(ep*(1-pairP)));}
  for(let v=1;v<=g.b;v++)bonusDispersion+=(bonuses[v]-eb)**2/eb;
  const mean=sums.reduce((s,v)=>s+v,0)/n,centered=sums.map(v=>v-mean),energy=centered.reduce((s,v)=>s+v*v,0);let maxLag=0,maxSpectrum=0;
  for(let lag=1;lag<=10;lag++){let c=0;for(let i=lag;i<n;i++)c+=centered[i]*centered[i-lag];maxLag=Math.max(maxLag,energy?Math.abs(c/energy):0);}
  for(const t of trig){let re=0,im=0;for(let i=0;i<n;i++){re+=centered[i]*t.cos[i];im+=centered[i]*t.sin[i];}maxSpectrum=Math.max(maxSpectrum,energy?(re*re+im*im)/energy:0);}
  const sumSE=Math.sqrt(g.k*(g.n-g.k)*(g.n+1)/12/n);
  return [dispersion,maxNumber,bonusDispersion,maxPair,Math.abs(repeats/(n-1)-g.k*g.k/g.n),maxLag,maxSpectrum,Math.abs(mean-g.k*(g.n+1)/2)/sumSE];
 }
 const observed=measure(history),extremes=Array(observed.length).fill(0),pool=Array.from({length:g.n},(_,i)=>i+1),bonusPool=Array.from({length:g.b},(_,i)=>i+1);
 function pick(a,k){const out=[];for(let i=0;i<k;i++){const j=i+Math.floor(rng()*(a.length-i));[a[i],a[j]]=[a[j],a[i]];out.push(a[i]);}return out;}
 for(let r=0;r<simulations;r++){const rows=Array.from({length:n},()=>({numbers:pick(pool,g.k),bonus:pick(bonusPool,g.j)})),nullStats=measure(rows);nullStats.forEach((v,i)=>{if(v>=observed[i]-1e-12)extremes[i]++;});}
 const names=['Dispersion des fréquences des numéros','Numéro le plus atypique (maximum global)','Dispersion des fréquences des bonus','Paire la plus atypique (maximum global)','Répétitions entre tirages consécutifs','Autocorrélation des sommes (retards 1 à 10)','Périodicités des sommes (périodes 2 à 30)','Décalage de la somme moyenne'];
 return {n,simulations,tests:names.map((name,i)=>({name,value:observed[i],p:(extremes[i]+1)/(simulations+1)}))};
}
