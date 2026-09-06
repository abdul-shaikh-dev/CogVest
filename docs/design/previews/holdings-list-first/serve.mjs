import http from 'node:http';
import {readFile} from 'node:fs/promises';
const allowed=new Map([['/','index.html'],...['index.html','style.css','app.js'].map(name=>['/'+name,name])]);
const types={html:'text/html; charset=utf-8',css:'text/css; charset=utf-8',js:'text/javascript; charset=utf-8'};
const server=http.createServer(async(req,res)=>{
  const file=allowed.get(new URL(req.url,'http://localhost').pathname);
  if(!file){res.writeHead(404);res.end('Not found');return;}
  try {const body=await readFile(new URL(file,import.meta.url));res.writeHead(200,{'Content-Type':types[file.split('.').at(-1)],'Cache-Control':'no-store'});res.end(body);}
  catch {res.writeHead(500);res.end('Preview unavailable');}
});
server.on('error',error=>{console.error(`Preview: ${error.message}`);process.exitCode=1;});
server.listen(4179,'127.0.0.1',()=>console.log('Holdings preview: http://127.0.0.1:4179/'));
