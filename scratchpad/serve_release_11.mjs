import http from 'node:http';
import { readFile } from 'node:fs/promises';
const files = {'/card.png':['发布文件/Ver.1.1/本格修仙 Ver.1.1.png','image/png'],'/preset.json':['发布文件/Ver.1.1/本格修仙preset-Ver.1.1.json','application/json']};
http.createServer(async(req,res)=>{
 const item=files[req.url];if(!item){res.writeHead(404).end();return;}
 res.writeHead(200,{'Content-Type':item[1],'Access-Control-Allow-Origin':'http://localhost:8000','Cache-Control':'no-store'});
 res.end(await readFile(new URL('../'+item[0],import.meta.url)));
}).listen(18749,'127.0.0.1');
