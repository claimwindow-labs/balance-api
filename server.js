import http from 'node:http';
import {analyzeClaimants} from '../predicate-engine/index.js';
const port=Number(process.env.PORT||4780);
const json=(res,status,data)=>{res.writeHead(status,{'content-type':'application/json','access-control-allow-origin':'http://127.0.0.1:4781','cache-control':'no-store'});res.end(JSON.stringify(data))};
http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  try {
    if(url.pathname==='/health')return json(res,200,{status:'ok',network:'testnet',readOnly:true});
    if(req.method!=='GET'||!/^\/balances\/[a-f0-9]{72}$/.test(url.pathname))return json(res,404,{error:'Use GET /balances/<72-character hex balance ID>'});
    const upstream=await fetch('https://horizon-testnet.stellar.org/claimable_balances/'+url.pathname.split('/').at(-1),{signal:AbortSignal.timeout(10000)});
    if(!upstream.ok)return json(res,upstream.status===404?404:502,{error:'Balance unavailable',upstreamStatus:upstream.status});
    const b=await upstream.json();
    // Relative predicates require the creation ledger time. Never substitute last_modified_time.
    let analysis;try{analysis=analyzeClaimants(b.claimants)}catch(e){analysis={status:'needs-creation-time',reason:e.message}};
    return json(res,200,{id:b.id,asset:b.asset,amount:b.amount,claimants:b.claimants,lastModifiedLedger:b.last_modified_ledger,analysis});
  }catch(e){json(res,502,{error:e.message})}
}).listen(port,'127.0.0.1',()=>console.log(`ClaimWindow read-only API http://127.0.0.1:${port}`));
