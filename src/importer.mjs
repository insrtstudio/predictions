import {GAMES,isISODate,validateDraw} from './engine.mjs';
export function parseCSV(text){
  const lines=[],row=[];let cell='',quoted=false;const delimiter=text.split(/\r?\n/)[0].includes(';')?';':',';
  text=text.replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===delimiter&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v.trim()))lines.push([...row]);row.length=0;cell='';}else cell+=c;}
  if(quoted)throw Error('CSV incomplet : guillemets non fermés');if(cell||row.length){row.push(cell);lines.push(row);}
  if(lines.length<2)throw Error('CSV vide');const headers=lines.shift().map(s=>s.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase());
  return lines.map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]?.trim()??''])));
}
function date(s){s=s?.trim();if(/^\d{2}\/\d{2}\/\d{2}$/.test(s)){const [d,m,y]=s.split("/");s=d+"/"+m+"/"+(Number(y)>=70?"19":"20")+y;}if(/^\d{2}\/\d{2}\/\d{4}$/.test(s)){const [d,m,y]=s.split('/');s=`${y}-${m}-${d}`;}else if(/^\d{8}$/.test(s))s=`${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6)}`;if(!isISODate(s))throw Error('Date de tirage invalide : '+s);return s;}
export function importCSV(text,game,source='Import CSV') {
  const g=GAMES[game];if(!g)throw Error('Jeu inconnu');
  return parseCSV(text).map((r,i)=>{
    try {
      const d=date(r.date_de_tirage||r.date),numbers=Array.from({length:g.k},(_,i)=>Number(r['boule_'+(i+1)]??r['n'+(i+1)]));
      const bonus=game==='euromillions'?[Number(r.etoile_1??r.b1),Number(r.etoile_2??r.b2)]:[Number(r.numero_chance??r.numero_dream??r.b1)];
      const suffix=game==='euromillions'?'_euro_millions':game==='eurodreams'?'_euro_dreams':'';
      const value=r['nombre_de_gagnant_au_rang1'+suffix+(suffix?'_en_europe':'')];
      const winners=value!==undefined&&value!==''?Number(value):null;
      return validateDraw({game,date:d,numbers,bonus,source,...(Number.isFinite(winners)?{winners}:{} )});
    }catch(e){throw Error(`Ligne ${i+2} : ${e.message}`);}
  });
}
