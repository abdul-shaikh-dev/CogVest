import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = new URL('./', import.meta.url);
const allowed = new Map([['/', 'index.html'], ...['index.html','style.css','app.js','Ionicons.ttf'].map(x=>['/'+x,x])]);
const types={html:'text/html; charset=utf-8',css:'text/css',js:'text/javascript',ttf:'font/ttf'};
const server=http.createServer(async(req,res)=>{
  const name=allowed.get(new URL(req.url,'http://localhost').pathname);
  if(!name){res.writeHead(404);res.end('Not found');return}
  try{const body=await readFile(new URL(name,root));res.writeHead(200,{'Content-Type':types[name.split('.').at(-1)],'Cache-Control':'no-store'});res.end(body)}catch{res.writeHead(500);res.end('Preview file unavailable')}
});
server.on('error',error=>{console.error(`Preview server: ${error.message}`);process.exitCode=1});
server.listen(4178,'127.0.0.1',()=>console.log(`CogVest design preview: http://127.0.0.1:4178/ (${fileURLToPath(root)})`));
