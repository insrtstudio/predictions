export const GAMES = {
  euromillions: {name:'EuroMillions', n:50, k:5, b:12, j:2, bonus:'Étoiles', price:2.5, since:'2016-09-27', days:[2,5], slug:'euromillions-my-million', archive:'1a2b3c4d-9876-4562-b3fc-2c963f66afe6'},
  loto: {name:'Loto', n:49, k:5, b:10, j:1, bonus:'Chance', price:2.2, since:'2008-10-06', days:[1,3,6], slug:'loto', archive:'1a2b3c4d-9876-4562-b3fc-2c963f66afp6'},
  eurodreams: {name:'EuroDreams', n:40, k:6, b:5, j:1, bonus:'Dream', price:2.5, since:'2023-11-06', days:[1,4], slug:'eurodreams', archive:'1a2b3c4d-9876-4562-b3fc-2c963f66afa5'}
};
export const METHODS = {uniform:'Hasard uniforme', frequency:'Fréquences lissées', recent:'Tendance récente', overdue:'Écarts de sortie', markov:'Transitions de Markov', momentum:'Double tendance', pairs:'Cooccurrences conditionnelles', ensemble:'Ensemble régularisé'};
export function choose(n,k) { if(k<0||k>n)return 0; let r=1; for(let i=1;i<=Math.min(k,n-k);i++)r=r*(n-i+1)/i; return Math.round(r); }
export function probability(game,m,s) {const g=GAMES[game]; return choose(g.k,m)*choose(g.n-g.k,g.k-m)/choose(g.n,g.k)*choose(g.j,s)*choose(g.b-g.j,g.j-s)/choose(g.b,g.j);}
export function jackpot(game) {const g=GAMES[game];return choose(g.n,g.k)*choose(g.b,g.j);}
export function isISODate(d) {return typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d;}
export function validateDraw(d) {
  const g=GAMES[d?.game]; if(!g||!isISODate(d.date))throw Error('Jeu ou date invalide');
  const earliest=d.game==='euromillions'?'2004-02-13':g.since;if(d.date<earliest)throw Error('Date antérieure à la formule de jeu prise en charge');
  const b=d.game==='euromillions'?(d.date<'2011-05-10'?9:d.date<'2016-09-27'?11:12):g.b;
  for(const [a,k,n] of [[d.numbers,g.k,g.n],[d.bonus,g.j,b]]) if(!Array.isArray(a)||a.length!==k||new Set(a).size!==k||a.some(v=>!Number.isInteger(v)||v<1||v>n))throw Error('Combinaison invalide : '+d.date);
  return {...d,numbers:[...d.numbers].sort((a,b)=>a-b),bonus:[...d.bonus].sort((a,b)=>a-b)};
}
export function compatible(draws,game) {return draws.filter(d=>d.game===game&&d.date>=GAMES[game].since).sort((a,b)=>a.date.localeCompare(b.date));}
export function mergeDraws(old,incoming) {
  const map=new Map(old.map(d=>[d.game+':'+d.date,d]));
  for(const value of incoming){const d=validateDraw(value),key=d.game+':'+d.date,prior=map.get(key);if(prior?.source==='FDJ'&&d.source!=='FDJ')continue;map.set(key,{...prior,...d});}
  return [...map.values()].sort((a,b)=>b.date.localeCompare(a.date)||a.game.localeCompare(b.game));
}
export function stats(draws,game,field='numbers') {
  const g=GAMES[game],n=field==='numbers'?g.n:g.b,k=field==='numbers'?g.k:g.j;
  const counts=new Uint32Array(n+1),last=new Int32Array(n+1).fill(-1),recent=new Uint32Array(n+1);
  draws.forEach((d,i)=>d[field].forEach(v=>{counts[v]++;last[v]=i;if(i>=draws.length-100)recent[v]++;}));
  return Array.from({length:n},(_,i)=>{const v=i+1,expected=draws.length*k/n;return {number:v,count:counts[v],recent:recent[v],gap:draws.length-1-last[v],rate:draws.length?counts[v]/draws.length:0,z:expected?(counts[v]-expected)/Math.sqrt(draws.length*k/n*(1-k/n)):0};});
}
export function seeded(seed=12345) {return ()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
export function secureRandom() {const a=new Uint32Array(1);globalThis.crypto.getRandomValues(a);return a[0]/4294967296;}
function weights(draws,game,method,field){
  const g=GAMES[game],n=field==='numbers'?g.n:g.b;
  if(method==='uniform')return Array(n).fill(1);
  const ss=stats(draws,game,field);
  if(method==='frequency')return ss.map(s=>s.count+10);
  if(method==='recent'){const w=Array(n).fill(2);draws.slice(-300).reverse().forEach((d,i)=>d[field].forEach(v=>w[v-1]+=Math.exp(-i/50)));return w;}
  if(method==='overdue')return ss.map(s=>Math.sqrt(1+s.gap));
  if(method==='momentum'){const short=Array(n).fill(3),long=Array(n).fill(10);draws.slice(-500).reverse().forEach((d,i)=>d[field].forEach(v=>{short[v-1]+=Math.exp(-i/20);long[v-1]+=Math.exp(-i/100);}));return short.map((v,i)=>Math.max(.2,Math.min(5,v/long[i]*5)));}
  if(method==='pairs'){const prev=draws.at(-1)?.[field]||[],w=Array(n).fill(20);for(const d of draws){const hits=d[field].filter(v=>prev.includes(v)).length;d[field].forEach(v=>w[v-1]+=Math.max(0,hits-(prev.includes(v)?1:0)));}return w;}
  if(method==='ensemble'){const parts=['frequency','recent','markov','pairs'].map(m=>weights(draws,game,m,field)).map(w=>{const avg=w.reduce((s,v)=>s+v,0)/n;return w.map(v=>v/avg);});return Array.from({length:n},(_,i)=>.5+.5*Math.exp(parts.reduce((s,w)=>s+Math.log(w[i]),0)/parts.length));}
  if(method==='markov'){const w=Array(n).fill(10),prev=draws.at(-1)?.[field]||[];for(let i=1;i<draws.length;i++){const hits=draws[i-1][field].filter(v=>prev.includes(v)).length;draws[i][field].forEach(v=>w[v-1]+=hits);}return w;}
  throw Error('Stratégie inconnue');
}
export function sample(w,k,rng=secureRandom){const pool=w.map((weight,i)=>({weight,v:i+1})),out=[];while(out.length<k){let r=rng()*pool.reduce((s,v)=>s+v.weight,0),idx=pool.length-1;for(let i=0;i<pool.length;i++){r-=pool[i].weight;if(r<0){idx=i;break;}}out.push(pool.splice(idx,1)[0].v);}return out.sort((a,b)=>a-b);}
export function generate(draws,game,method='uniform',count=1,rng=secureRandom){
  if(!Number.isInteger(count)||count<1||count>100)throw Error('Choisir entre 1 et 100 grilles');
  const g=GAMES[game],history=compatible(draws,game),wn=weights(history,game,method,'numbers'),wb=weights(history,game,method,'bonus'),seen=new Set(),out=[];
  while(out.length<count){const d={game,numbers:sample(wn,g.k,rng),bonus:sample(wb,g.j,rng),method};const key=d.numbers+'|'+d.bonus;if(!seen.has(key)){seen.add(key);out.push(d);}}
  return out;
}
export function backtest(draws,game,{window=300,trials=30,seed=20260910}={}) {
  const history=compatible(draws,game),start=Math.max(100,history.length-Math.min(500,window)),g=GAMES[game];
  if(history.length<=start)throw Error('Il faut au moins 101 tirages compatibles pour le test.');
  return Object.keys(METHODS).map(method=>{
    const rng=seeded(seed),matches=[],bonusMatches=[];
    for(let i=start;i<history.length;i++){
      const train=history.slice(Math.max(0,i-500),i),actual=history[i],wn=weights(train,game,method,'numbers'),wb=weights(train,game,method,'bonus');
      let main=0,bonus=0;for(let t=0;t<trials;t++){main+=sample(wn,g.k,rng).filter(v=>actual.numbers.includes(v)).length;bonus+=sample(wb,g.j,rng).filter(v=>actual.bonus.includes(v)).length;}
      matches.push(main/trials);bonusMatches.push(bonus/trials);
    }
    const n=matches.length,mean=matches.reduce((a,b)=>a+b,0)/n,variance=matches.reduce((s,x)=>s+(x-mean)**2,0)/(n-1),se=Math.sqrt(variance/n);
    return {method,mean,bonusMean:bonusMatches.reduce((a,b)=>a+b,0)/n,expected:g.k*g.k/g.n,lo:mean-1.96*se,hi:mean+1.96*se,draws:n,trials,from:history[start].date,to:history.at(-1).date};
  });
}
export function diagnostics(draws,game,{simulations=499,seed=718}={}) {
  const history=compatible(draws,game),g=GAMES[game];if(history.length<30)throw Error('Au moins 30 tirages compatibles requis.');
  const rng=seeded(seed),n=history.length,counts=stats(history,game),expected=n*g.k/g.n;
  const score=c=>c.reduce((s,v)=>s+(v-expected)**2/expected,0),observed=score(counts.map(s=>s.count));
  const overlap=history.slice(1).reduce((s,d,i)=>s+d.numbers.filter(v=>history[i].numbers.includes(v)).length,0)/(n-1);
  let extremes=0,overlapExtremes=0;const nullOverlap=g.k*g.k/g.n;
  // Partial Fisher-Yates simulates sampling without replacement within every draw.
  for(let r=0;r<simulations;r++){
    const cs=new Uint32Array(g.n),pool=Array.from({length:g.n},(_,i)=>i);let last=new Set(),sum=0;
    for(let i=0;i<n;i++){const cur=new Set();for(let j=0;j<g.k;j++){const at=j+Math.floor(rng()*(g.n-j));[pool[j],pool[at]]=[pool[at],pool[j]];cs[pool[j]]++;cur.add(pool[j]);if(last.has(pool[j]))sum++;}last=cur;}
    if(score([...cs])>=observed)extremes++;if(Math.abs(sum/(n-1)-nullOverlap)>=Math.abs(overlap-nullOverlap))overlapExtremes++;
  }
  return {n,simulations,chi:observed,pUniform:(extremes+1)/(simulations+1),overlap,pSerial:(overlapExtremes+1)/(simulations+1),expectedOverlap:nullOverlap};
}
export function compareTicket(ticket,draw) {return {main:ticket.numbers.filter(v=>draw.numbers.includes(v)).length,bonus:ticket.bonus.filter(v=>draw.bonus.includes(v)).length};}
