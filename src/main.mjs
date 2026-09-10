import {app,BrowserWindow,ipcMain,dialog,Menu,powerMonitor,Notification} from 'electron';
import updaterPackage from 'electron-updater';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {GAMES,mergeDraws} from './engine.mjs';
import {Store,validateTicket} from './store.mjs';
import {fetchDraws} from './sync.mjs';
import {importCSV} from './importer.mjs';
const {autoUpdater}=updaterPackage,dir=path.dirname(fileURLToPath(import.meta.url));
const testMode=process.env.PREDICTIONS_TEST==='1';
app.setName('Predictions');
if(testMode&&process.env.PREDICTIONS_DATA_DIR)app.setPath('userData',process.env.PREDICTIONS_DATA_DIR);
let win,store,syncing=false,updateState={status:'idle',message:'Aucune vérification effectuée.'},updateAvailable=false,updateReady=false;
function emit(type,payload={}){if(win&&!win.isDestroyed())win.webContents.send('event',{type,...payload});}
function setUpdate(status,message){updateState={status,message};emit('update',updateState);}
function handle(name,fn){ipcMain.handle(name,async(event,...args)=>{if(event.sender!==win?.webContents||event.senderFrame!==win.webContents.mainFrame)throw Error('Origine refusée');try{return {ok:true,value:await fn(...args)};}catch(e){return {ok:false,error:e.message};}});}
async function sync(){
  if(syncing)return {busy:true};syncing=true;emit('sync-start');const results=[];
  try{for(const game of Object.keys(GAMES)){
    try{const incoming=await fetchDraws(game),prior=new Set(store.state.draws.filter(d=>d.game===game).map(d=>d.date)),added=incoming.filter(d=>!prior.has(d.date)).length;
      const status={at:new Date().toISOString(),ok:true,added};await store.update(s=>({...s,draws:mergeDraws(s.draws,incoming),sync:{...s.sync,[game]:status}}));results.push({game,...status});
      if(added>0&&Notification.isSupported()&&!testMode)new Notification({title:GAMES[game].name,body:`${added} nouveau(x) tirage(s) enregistré(s).`}).show();
    }catch(e){const status={at:new Date().toISOString(),ok:false,error:e.message};await store.update(s=>({...s,sync:{...s.sync,[game]:status}}));results.push({game,...status});}
  }return results;}finally{syncing=false;emit('state-changed');emit('sync-end',{results});}
}
function createWindow(){
  win=new BrowserWindow({width:1380,height:940,minWidth:1024,minHeight:720,title:'Predictions',backgroundColor:'#0c111b',titleBarStyle:'hiddenInset',trafficLightPosition:{x:22,y:23},webPreferences:{preload:path.join(dir,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',e=>e.preventDefault());
  win.loadFile(path.join(dir,'index.html'));
}
if(!app.requestSingleInstanceLock())app.quit();else {
app.on('second-instance',()=>{if(win?.isMinimized())win.restore();win?.focus();});
app.whenReady().then(async()=>{
  try{const seed=mergeDraws([],JSON.parse(await readFile(path.join(dir,'../data/seed.json'),'utf8')));store=new Store(path.join(app.getPath('userData'),'predictions.json'));await store.init(seed);}catch(e){dialog.showErrorBox('Données indisponibles',e.message);app.quit();return;}
  handle('state',()=>({...store.state,version:app.getVersion(),packaged:app.isPackaged,update:updateState}));
  handle('sync',sync);
  handle('import',async game=>{if(!GAMES[game])throw Error('Jeu inconnu');const result=await dialog.showOpenDialog(win,{filters:[{name:'Historique CSV',extensions:['csv']}],properties:['openFile']});if(result.canceled)return null;const raw=await readFile(result.filePaths[0]);if(raw.length>30_000_000)throw Error('Fichier trop volumineux');const rows=importCSV(new TextDecoder('utf-8').decode(raw),game);await store.update(s=>({...s,draws:mergeDraws(s.draws,rows)}));emit('state-changed');return rows.length;});
  handle('export',async game=>{if(!GAMES[game])throw Error('Jeu inconnu');const g=GAMES[game],result=await dialog.showSaveDialog(win,{defaultPath:game+'-tirages.csv',filters:[{name:'CSV',extensions:['csv']}]});if(result.canceled)return null;const header=['date',...Array.from({length:g.k},(_,i)=>'n'+(i+1)),...Array.from({length:g.j},(_,i)=>'b'+(i+1))];await writeFile(result.filePath,[header.join(';'),...store.state.draws.filter(d=>d.game===game).map(d=>[d.date,...d.numbers,...d.bonus].join(';'))].join('\n'));return true;});
  handle('backup',async()=>{const r=await dialog.showSaveDialog(win,{defaultPath:'predictions-sauvegarde.json'});if(r.canceled)return null;await store.backup(r.filePath);return true;});
  handle('restore',async()=>{const r=await dialog.showOpenDialog(win,{filters:[{name:'Sauvegarde Predictions',extensions:['json']}],properties:['openFile']});if(r.canceled)return null;const raw=await readFile(r.filePaths[0],'utf8');if(raw.length>50_000_000)throw Error('Sauvegarde trop volumineuse');const data=JSON.parse(raw);if(data.schema!==1||!Array.isArray(data.tickets)||!Array.isArray(data.draws))throw Error('Sauvegarde invalide');const draws=mergeDraws([],data.draws),tickets=data.tickets.map(validateTicket);await store.update(s=>({...s,draws:mergeDraws(s.draws,draws),tickets:[...new Map([...s.tickets,...tickets].map(t=>[t.id,t])).values()]}));emit('state-changed');return true;});
  handle('ticket',async t=>{const ticket=validateTicket(t);await store.update(s=>({...s,tickets:[...s.tickets.filter(t=>t.id!==ticket.id),ticket]}));emit('state-changed');return true;});
  handle('remove-ticket',async id=>{await store.update(s=>({...s,tickets:s.tickets.filter(t=>t.id!==id)}));emit('state-changed');return true;});
  handle('check-update',async()=>{if(!app.isPackaged){setUpdate('dev','Vérification disponible dans la version installée.');return null;}setUpdate('checking','Vérification sur GitHub…');return await autoUpdater.checkForUpdates().then(()=>true);});
  handle('download-update',async()=>{if(!updateAvailable)throw Error('Aucune version disponible');await autoUpdater.downloadUpdate();return true;});
  handle('install-update',()=>{if(!updateReady)throw Error('La mise à jour n’est pas prête');setImmediate(()=>autoUpdater.quitAndInstall());return true;});
  autoUpdater.autoDownload=false;autoUpdater.autoInstallOnAppQuit=false;
  autoUpdater.on('error',e=>setUpdate('error','Mise à jour indisponible : '+e.message));
  autoUpdater.on('update-available',info=>{updateAvailable=true;setUpdate('available',`Version ${info.version} disponible.`);});
  autoUpdater.on('update-not-available',()=>{updateAvailable=false;setUpdate('current','Vous utilisez la dernière version publiée.');});
  autoUpdater.on('download-progress',p=>setUpdate('downloading',`Téléchargement : ${Math.round(p.percent)} %`));
  autoUpdater.on('update-downloaded',()=>{updateReady=true;setUpdate('ready','Mise à jour prête. Redémarrez pour l’installer.');});
  Menu.setApplicationMenu(Menu.buildFromTemplate([{label:'Predictions',submenu:[{role:'about'},{type:'separator'},{role:'hide'},{role:'hideOthers'},{role:'unhide'},{type:'separator'},{role:'quit'}]},{label:'Édition',submenu:[{role:'undo'},{role:'redo'},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'selectAll'}]},{label:'Affichage',submenu:[{role:'reload'},{role:'resetZoom'},{role:'zoomIn'},{role:'zoomOut'},{role:'togglefullscreen'}]}]));
  createWindow();
  if(!testMode){setTimeout(()=>sync().catch(e=>emit('error',{message:e.message})),2000);setInterval(()=>sync().catch(e=>emit('error',{message:e.message})),15*60*1000).unref();powerMonitor.on('resume',()=>sync().catch(e=>emit('error',{message:e.message})));if(app.isPackaged)setTimeout(()=>autoUpdater.checkForUpdates().catch(()=>{}),10000);}
  app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow();});
});
app.on('window-all-closed',()=>{if(process.platform!=='darwin'||testMode)app.quit();});
}
