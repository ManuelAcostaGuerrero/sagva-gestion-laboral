import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=new URL('../../../',import.meta.url);
const read=p=>readFileSync(new URL(p,root),'utf8');
test('La tablet fija usa siempre cámara frontal y no ofrece cámara trasera',()=>{
 const screen=read('client/src/TabletAttendanceKiosk.jsx');
 assert.match(screen,/CameraIdentityPreview autoStart facingMode="user"/);
 assert.doesNotMatch(screen,/setFront|Cambiar a cámara|facingMode=\{front\?/);
});
test('PWA puede pedir fullscreen inmersivo y botón del kiosco lo solicita por gesto',()=>{
 const manifest=JSON.parse(read('client/public/manifest.webmanifest'));
 assert.equal(manifest.display,'fullscreen');
 const kiosk=read('client/src/TokenKiosk.jsx');
 assert.match(kiosk,/document\.documentElement\.requestFullscreen\(\)/);
 assert.match(kiosk,/document\.exitFullscreen\?\.\(\)/);
});
