const {contextBridge,ipcRenderer}=require('electron');
const call=(name)=>(...args)=>ipcRenderer.invoke(name,...args);
contextBridge.exposeInMainWorld('desktop',{
  state:call('state'),sync:call('sync'),importCSV:call('import'),exportCSV:call('export'),backup:call('backup'),restore:call('restore'),saveTicket:call('ticket'),removeTicket:call('remove-ticket'),checkUpdate:call('check-update'),downloadUpdate:call('download-update'),installUpdate:call('install-update'),
  onEvent:callback=>{const listener=(_e,value)=>callback(value);ipcRenderer.on('event',listener);return ()=>ipcRenderer.removeListener('event',listener);}
});
