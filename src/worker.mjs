import {backtest} from './engine.mjs';
import {deepDiagnostics} from './diagnostics.mjs';
self.onmessage=({data})=>{try{const result=data.type==='backtest'?backtest(data.draws,data.game):deepDiagnostics(data.draws,data.game);self.postMessage({id:data.id,result});}catch(e){self.postMessage({id:data.id,error:e.message});}};
