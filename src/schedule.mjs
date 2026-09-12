import {GAMES} from './engine.mjs';
const paris=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
export function parisParts(now=new Date()){return Object.fromEntries(paris.formatToParts(now).map(x=>[x.type,x.value]));}
export function parisDate(now=new Date()){const p=parisParts(now);return `${p.year}-${p.month}-${p.day}`;}
function deadline(date){let t=Date.parse(date+'T20:15:00Z');for(let i=0;i<2;i++){const p=parisParts(new Date(t));t+=Date.parse(date+'T20:15:00Z')-Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00Z`);}return t;}
export function nextClosing(game,now=new Date()){
 if(!GAMES[game])throw Error('Jeu inconnu');const day=parisDate(now);
 for(let i=0;i<8;i++){const d=new Date(Date.parse(day+'T12:00:00Z')+i*86400000),date=d.toISOString().slice(0,10),at=deadline(date);if(GAMES[game].days.includes(d.getUTCDay())&&at>now.getTime())return {date,at};}
}
export function notificationPreferences(value={}){return {results:value.results===true,reminders:value.reminders===true,minutes:[15,30,60,120].includes(value.minutes)?value.minutes:30};}
export function dueReminders(preferences,sent={},now=new Date()){
 const p=notificationPreferences(preferences);if(!p.reminders)return [];
 return Object.keys(GAMES).flatMap(game=>{const next=nextClosing(game,now),key=`${game}:${next.date}`,left=next.at-now.getTime();return left<=p.minutes*60000&&!sent[key]?[{game,key,...next}]:[];});
}
