import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createWebApp} from '../../../tools/start-web.mjs';
import {resolveApiUrl} from '../../../client/src/services/apiUrl.js';

test('URL API: localhost, red y HTTPS usan el mismo enlace aunque el .env conserve direcciones antiguas',()=>{
  assert.equal(resolveApiUrl({hostname:'demo.trycloudflare.com',protocol:'https:'},'http://localhost:4000/api'),'/api');
  assert.equal(resolveApiUrl({hostname:'192.168.1.25',protocol:'http:'},'http://localhost:4000/api'),'/api');
  assert.equal(resolveApiUrl({hostname:'localhost',protocol:'http:'},'http://localhost:4000/api'),'/api');
  assert.equal(resolveApiUrl({hostname:'localhost',protocol:'http:'},'https://anterior.trycloudflare.com/api'),'/api');
  assert.equal(resolveApiUrl({hostname:'localhost',protocol:'http:'},'//anterior.trycloudflare.com/api'),'/api');
  assert.equal(resolveApiUrl({hostname:'localhost',protocol:'http:'},'/api/'),'/api');
});
test('Web publica: API conserva autenticación/cuerpo y no publica fuentes ni archivos privados',async()=>{
  const backend=http.createServer((req,res)=>{
    let body='';req.on('data',part=>body+=part);req.on('end',()=>{
      res.setHeader('Content-Type','application/json');res.end(JSON.stringify({url:req.url,auth:req.headers.authorization,terminal:req.headers['x-terminal-token'],body,origin:req.headers.origin || null}));
    });
  }).listen(0,'127.0.0.1');await new Promise(resolve=>backend.once('listening',resolve));
  const web=createWebApp({apiTarget:`http://127.0.0.1:${backend.address().port}`}).listen(0,'127.0.0.1');await new Promise(resolve=>web.once('listening',resolve));
  const base=`http://127.0.0.1:${web.address().port}`;
  try {
    const response=await fetch(`${base}/api/test?q=1`,{method:'POST',headers:{Authorization:'Bearer synthetic','X-Terminal-Token':'synthetic-terminal',Origin:'https://demo.trycloudflare.com','Content-Type':'application/json'},body:'{"hello":1}'});
    const data=await response.json();assert.equal(data.url,'/api/test?q=1');assert.equal(data.auth,'Bearer synthetic');assert.equal(data.terminal,'synthetic-terminal');assert.equal(data.body,'{"hello":1}');assert.equal(data.origin,null);
    assert.equal(response.headers.get('access-control-allow-origin'),null);
    for(const route of ['/.local/acceso-inicial.txt','/server/.env','/@fs/C:/Users/Admin/Documents/Codex/asistencia-huella-digital/server/.env','/data/asistencia.db','/tools/control-local.ps1','/src/main.jsx']) assert.equal((await fetch(base+route)).status,404);
  }finally{await new Promise(resolve=>web.close(resolve));await new Promise(resolve=>backend.close(resolve));}
});
