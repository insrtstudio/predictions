import test from 'node:test';
import assert from 'node:assert/strict';
import {nextClosing,dueReminders,notificationPreferences,drawStatus} from '../src/schedule.mjs';
import {validateTicket} from '../src/store.mjs';
test('Paris deadlines include today before closing and skip closed draws',()=>{
 assert.deepEqual(nextClosing('loto',new Date('2026-09-12T18:14:59Z')),{date:'2026-09-12',at:Date.parse('2026-09-12T18:15:00Z')});
 assert.equal(nextClosing('loto',new Date('2026-09-12T18:15:00Z')).date,'2026-09-14');
 assert.equal(nextClosing('euromillions',new Date('2026-09-12T12:00:00Z')).date,'2026-09-15');
});
test('Paris winter and summer offsets across DST weekends',()=>{
 assert.equal(nextClosing('eurodreams',new Date('2026-03-28T23:00:00Z')).at,Date.parse('2026-03-30T18:15:00Z'));
 assert.equal(nextClosing('eurodreams',new Date('2026-10-24T23:00:00Z')).at,Date.parse('2026-10-26T19:15:00Z'));
});
test('opt-in reminders, catch-up before closing, deduplication and no expired reminder',()=>{
 const p={reminders:true,minutes:30},now=new Date('2026-09-14T17:50:00Z');
 assert.equal(dueReminders({}, {},now).length,0);
 assert.equal(dueReminders(p,{},new Date('2026-09-14T17:44:59Z')).length,0);
 const due=dueReminders(p,{},now);assert.equal(due.length,2);
 assert.equal(dueReminders(p,Object.fromEntries(due.map(d=>[d.key,true])),now).length,0);
 assert.equal(dueReminders(p,{},new Date('2026-09-14T18:15:00Z')).length,0);
 assert.deepEqual(notificationPreferences({results:'true',minutes:-1}),{results:false,reminders:false,minutes:30});
});
test('manual tickets validate ranges and duplicates independently of generator methods',()=>{
 const t={id:'manual',game:'loto',date:'2026-09-12',numbers:[1,2,3,4,49],bonus:[10],method:'manual',cost:2.2,gain:null};
 assert.equal(validateTicket(t).method,'manual');
 assert.throws(()=>validateTicket({...t,numbers:[1,1,3,4,49]}));
 assert.throws(()=>validateTicket({...t,bonus:[11]}));
 assert.throws(()=>validateTicket({...t,cost:-1}));
});

test('12 September Loto stays on Saturday after closing; EuroDreams stays on Monday',()=>{
 for(const time of ['2026-09-12T18:14:59Z','2026-09-12T18:15:00Z','2026-09-12T18:18:00Z','2026-09-12T21:59:59Z']){
  const now=new Date(time),loto=drawStatus('loto',[],now),dreams=drawStatus('eurodreams',[],now);
  assert.equal(loto.date,'2026-09-12');assert.equal(dreams.date,'2026-09-14');assert.equal(dreams.phase,'open');
  assert.equal(loto.phase,time<'2026-09-12T18:15:00Z'?'open':'closed');
  assert.equal(drawStatus('euromillions',[],now).date,'2026-09-15');
 }
 const now=new Date('2026-09-12T19:00:00Z');assert.equal(drawStatus('loto',[{game:'eurodreams',date:'2026-09-12'}],now).phase,'closed');
 assert.equal(drawStatus('loto',[{game:'loto',date:'2026-09-12'}],now).phase,'published');
 assert.equal(drawStatus('loto',[],new Date('2026-09-12T22:00:00Z')).date,'2026-09-14');
});
