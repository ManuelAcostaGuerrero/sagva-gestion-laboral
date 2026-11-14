import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sortEquipmentItems} from '../../../client/src/equipmentSorting.js';
import {printBankAuthorization} from '../../../client/src/printBankAuthorization.js';
import {checkRut,formatRut} from '../rut.js';
import {QR_CREDENTIAL_PRINT,qrCredentialPrintCss} from '../../../client/src/qrCredentialPrintLayout.js';

const file=relative=>readFileSync(new URL(relative,import.meta.url),'utf8');
const validRut=body=>{for(const c of '0123456789K')if(checkRut(body+c).valid)return body+c;throw Error('Sin dígito verificador de prueba');};

test('Catálogo y ficha usan orden alfabético estable sin cambiar IDs ni lista original',()=>{
 const input=[{id:4,name:'POLERÓN'},{id:5,name:'CUELLO DE POLAR'},{id:3,name:'MANDIL'}];
 assert.deepEqual(sortEquipmentItems(input).map(x=>x.id),[5,3,4]);
 assert.deepEqual(input.map(x=>x.id),[4,5,3]);
 assert.deepEqual(sortEquipmentItems(['ZAPATO','MANDIL','CUELLO DE POLAR']),['CUELLO DE POLAR','MANDIL','ZAPATO']);
});

test('Solicitud bancaria imprime ambos RUT normalizados y no acepta dígitos incorrectos',()=>{
 const workerRut=validRut('12345678');
 const holderRut=validRut('9876543');
 const info={workerName:'TRABAJADOR SINTETICO',workerRut,holderName:'TITULAR SINTETICO',holderRut,
  bankName:'BANCO DE PRUEBA',accountType:'VISTA',accountNumber:'12345678'};
 assert.throws(()=>printBankAuthorization({...info,workerRut:'11.111.111-9'}),/RUT del trabajador es inválido/);
 assert.throws(()=>printBankAuthorization({...info,holderRut:'11.111.111-9'}),/RUT del titular de la cuenta es inválido/);
 let printed='';
 const previous=globalThis.window;
 globalThis.window={open:()=>({opener:null,document:{open(){},write(text){printed=text;},close(){}}})};
 try{printBankAuthorization(info);}
 finally{globalThis.window=previous;}
 assert.ok(printed.includes('RUT:</b> '+formatRut(workerRut)));
 assert.ok(printed.includes('RUT del titular:</b> '+formatRut(holderRut)));
});

test('Plantilla única contiene la marca auténtica sin duplicar el nombre del local y mantiene QR 30mm',()=>{
 const svg=file('../../../client/public/red-taurus-logo.svg');
 const print=file('../../../client/src/printQrCards.js');
 assert.match(svg,/viewBox="0 0 700 394"/);
 assert.match(svg,/fill="#f60916"/);
 assert.match(svg,/fill="#ffffff"/);
 assert.match(print,/red-taurus-logo\.svg/);
 assert.doesNotMatch(print,/brand\.textContent = 'RED TAURUS'/);
 assert.doesNotMatch(print,/M162 67Q192 98/);
 assert.equal(QR_CREDENTIAL_PRINT.qrSizeMm,30);
 assert.match(qrCredentialPrintCss(),/width:30mm;height:30mm/);
});

test('Reimpresión permite seleccionar lote o recuperar original y guardar sin cerrar ficha',()=>{
 const tokens=file('../../../client/src/TokenCredentials.jsx');
 const form=file('../../../client/src/EmployeeFile.jsx');
 assert.match(tokens,/Seleccionar todos los recuperables/);
 assert.match(tokens,/restoreIssued/);
 assert.match(tokens,/prepareReprint/);
 assert.match(form,/Guardar y cambiar/);
 assert.match(form,/const changingWorker=Boolean\(next\)/);
});
