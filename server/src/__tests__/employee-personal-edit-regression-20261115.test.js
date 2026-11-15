import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {changeEmployeeDraft,unconfirmedEmployeeClears,unpersistedPersonalEdits} from '../../../client/src/employeeFileEdits.js';
import {bankPayloadForSave} from '../../../client/src/bankAccountPayload.js';

const base=()=>({
  id:7,firstName:'ANA',secondName:'MARÍA',otherNames:'',
  firstLastName:'PÉREZ',secondLastName:'DÍAZ',
  fullName:'ANA MARÍA PÉREZ DÍAZ',legalFullName:'ANA MARÍA PÉREZ DÍAZ',
  documentId:'12.345.678-5',email:'PRUEBA@EXAMPLE.COM',address:'CALLE UNO',
  clearFields:[],phone:'',mobile:''
});

test('Nombre completo se recalcula y nombre legal espejo no queda obsoleto',()=>{
  const start=base();
  const changed=changeEmployeeDraft(start,'secondName','MARÍA JOSÉ');
  assert.equal(changed.secondName,'MARÍA JOSÉ');
  assert.equal(changed.fullName,'ANA MARÍA JOSÉ PÉREZ DÍAZ');
  assert.equal(changed.legalFullName,changed.fullName);
  assert.equal(start.fullName,'ANA MARÍA PÉREZ DÍAZ','no mutar el guardado original');
});

test('Nombres compuestos no pierden el espacio mientras se escriben',()=>{
  const result=changeEmployeeDraft(base(),'firstName','ANA ');
  assert.equal(result.firstName,'ANA ','no recortar espacio de cada pulsación');
  const next=changeEmployeeDraft(result,'firstName','ANA SOFÍA');
  assert.equal(next.firstName,'ANA SOFÍA');
  assert.equal(next.fullName,'ANA SOFÍA MARÍA PÉREZ DÍAZ');
});

test('Nombre legal expresamente diferente no se altera al editar nombres individuales',()=>{
  const person={...base(),legalFullName:'ANA MARÍA PÉREZ DÍAZ DE PRUEBA'};
  const next=changeEmployeeDraft(person,'firstLastName','PÉREZ GÓMEZ');
  assert.equal(next.legalFullName,person.legalFullName);
  assert.equal(next.fullName,'ANA MARÍA PÉREZ GÓMEZ DÍAZ');
  const corrected=changeEmployeeDraft(next,'legalFullName','ANA MARÍA PÉREZ GÓMEZ DÍAZ');
  assert.equal(corrected.legalFullName,'ANA MARÍA PÉREZ GÓMEZ DÍAZ');
});

test('No anunciar éxito si el servidor retiene un dato editado',()=>{
  const prev=base(),draft={...prev,firstLastName:'GARCÍA'};
  const reverted={...prev,revision:2};
  assert.deepEqual(unpersistedPersonalEdits(prev,draft,reverted),['firstLastName']);
  assert.deepEqual(unpersistedPersonalEdits(prev,draft,{...draft,revision:2}),[]);
  assert.deepEqual(unpersistedPersonalEdits(prev,{...prev,documentId:'12.345.678-5'},{...prev,documentId:'123456785'}),[]);
});

test('Intento de borrar dato existente exige confirmación y no se ignora silenciosamente',()=>{
  const prev=base(),draft={...prev,secondName:'',email:''};
  assert.deepEqual(unconfirmedEmployeeClears(draft,prev),['email','secondName']);
  assert.deepEqual(unconfirmedEmployeeClears({...draft,clearFields:['email','secondName']},prev),[]);
});

test('Cuenta del propio trabajador siempre usa titular actualizado; terceros requieren datos propios',()=>{
  const data={revision:2,bankId:3,accountType:'VISTA',accountNumber:'000000111',
    holderName:'NOMBRE ANTIGUO',holderRut:'12.345.678-5',authorizationRef:''};
  const own=bankPayloadForSave(data,{thirdParty:false,workerName:'NOMBRE ACTUAL',workerRut:'18.765.432-1'});
  assert.equal(own.holderName,'NOMBRE ACTUAL');
  assert.equal(own.holderRut,'18.765.432-1');
  assert.equal(own.bankId,3);
  const third=bankPayloadForSave({...data,holderName:'TERCERO AUTORIZADO',holderRut:'9.876.543-2',authorizationRef:'BANCARIA-9'},{
    thirdParty:true,workerName:'NOMBRE ACTUAL',workerRut:'18.765.432-1'
  });
  assert.equal(third.holderName,'TERCERO AUTORIZADO');
  assert.equal(third.holderRut,'9.876.543-2');
  assert.equal(third.authorizationRef,'BANCARIA-9');
});

test('Ficha tiene campo legal editable, nombre derivado y navegación desde titular propio',()=>{
  const file=readFileSync(new URL('../../../client/src/EmployeeFile.jsx',import.meta.url),'utf8');
  const bank=readFileSync(new URL('../../../client/src/EmployeeBankDetails.jsx',import.meta.url),'utf8');
  assert.match(file,/\["legalFullName", "Nombre legal registrado"\]/);
  assert.match(file,/readOnly=\{key==='fullName'\}/);
  assert.match(file,/unconfirmedEmployeeClears\(draft/);
  assert.match(file,/unpersistedPersonalEdits\(/);
  assert.match(file,/onEditOwner=\{\(\)=>\{/);
  assert.match(bank,/bankPayloadForSave\(data,\{thirdParty,workerName,workerRut\}\)/);
  assert.match(bank,/Corregir nombre o RUT en Datos personales/);
});
