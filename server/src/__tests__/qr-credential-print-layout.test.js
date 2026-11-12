import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {QR_CREDENTIAL_PRINT,paginateQrCredentials,qrCredentialPrintCss} from '../../../client/src/qrCredentialPrintLayout.js';

test('Medidas del diseño aprobado son invariables, verticales y con QR de 20 mm',()=>{
  const fixed=QR_CREDENTIAL_PRINT;
  assert.ok(Object.isFrozen(fixed));
  assert.equal(fixed.faceWidthMm,54);
  assert.equal(fixed.faceHeightMm,85);
  assert.equal(fixed.unfoldedWidthMm,108);
  assert.equal(fixed.unfoldedHeightMm,85);
  assert.equal(fixed.qrSizeMm,20);
  assert.equal(fixed.perSheet,4);
  const css=qrCredentialPrintCss();
  assert.match(css,/@page\{size:letter;margin:12mm\}/);
  assert.match(css,/\.qr-face\{[^}]*width:54mm;height:85mm;flex:0 0 54mm/);
  assert.match(css,/\.qr-pair\{[^}]*width:108mm;height:85mm/);
  assert.match(css,/\.qr-face-image\{[^}]*width:20mm;height:20mm/);
  assert.match(css,/transform:rotate\(90deg\)/);
  assert.match(css,/grid-template-columns:85mm 85mm;grid-template-rows:108mm 108mm/);
  assert.doesNotMatch(css,/size:A4|85\.6mm|width:45mm/i);
});

test('Hoja carta admite 4 credenciales plegables a tamaño real, con márgenes seguros',()=>{
  const m=QR_CREDENTIAL_PRINT;
  const printableWidth=m.letterWidthMm-2*m.printMarginMm;
  const printableHeight=m.letterHeightMm-2*m.printMarginMm;
  assert.ok(2*m.faceHeightMm+7<=printableWidth);
  assert.ok(2*m.unfoldedWidthMm+9<=printableHeight);
  assert.ok(printableWidth-(2*m.faceHeightMm+7)>=12);
  assert.ok(printableHeight-(2*m.unfoldedWidthMm+9)>=20);
  // La rotación reorganiza cada PAR; no rota ni distorsiona una cara por separado.
  assert.equal(m.faceWidthMm*2,m.unfoldedWidthMm);
});

test('1, 2, 3 y 4 credenciales usan 1 hoja carta; lotes grandes no escalan la ficha',()=>{
  for(const n of [1,2,3,4,5,8,9,20]){
    const cards=Array.from({length:n},(_,id)=>({id}));
    const pages=paginateQrCredentials(cards);
    assert.equal(pages.length,Math.ceil(n/4));
    assert.ok(pages.every(p=>p.length>=1&&p.length<=4));
    assert.deepEqual(pages.flat(),cards,'no debe duplicar ni perder credenciales');
  }
  for(const value of [[],Array(21).fill({}),null,{},'test'])
    assert.throws(()=>paginateQrCredentials(value));
});

test('Emisión individual y lote usan el mismo generador de impresión',()=>{
  const single=readFileSync(new URL('../../../client/src/printQrCard.js',import.meta.url),'utf8');
  const bulk=readFileSync(new URL('../../../client/src/printQrCards.js',import.meta.url),'utf8');
  assert.match(single,/return printQrCards\(\[card\]\)/);
  assert.match(bulk,/RED TAURUS/);
  assert.match(bulk,/qrCredentialPrintCss/);
  assert.match(bulk,/doc\.createElement\('img'\)/);
  assert.match(bulk,/textContent\s*=\s*String\(card\.name/);
});
