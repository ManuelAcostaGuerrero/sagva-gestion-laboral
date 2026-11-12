import test from 'node:test';
import assert from 'node:assert/strict';
import {matchesEmployeeSearch} from '../../../client/src/employeeSearch.js';
import {canCloseAfterSuccessfulSave} from '../../../client/src/employeeFileReview.js';

// Regresiones de issues #2 y #3: datos exclusivamente sintéticos.
test('issue #2: RUT encuentra la misma ficha con o sin separadores y por búsqueda parcial',()=>{
 const file={fullName:'Trabajador Sintético',company:'Empresa Ficticia',documentId:'12.345.678-9'};
 for(const q of ['12.345.678-9','12345678-9','12.345.6789','123456789','12 345 678-9','1234567']){
  assert.equal(matchesEmployeeSearch(file,q),true,`Búsqueda por ${q}`);
 }
 assert.equal(matchesEmployeeSearch(file,'999999999'),false);
 assert.equal(matchesEmployeeSearch(file,'trabajador'),true,'Mantener búsqueda por nombre');
 assert.equal(matchesEmployeeSearch(file,'empresa'),true,'Mantener búsqueda por empresa');
 assert.equal(matchesEmployeeSearch(file,''),true,'Filtro vacío muestra fichas');
});

test('issue #3: cerrar ficha solo cuando una sección fue guardada con éxito',()=>{
 assert.equal(canCloseAfterSuccessfulSave({savedSections:['Ficha general'],documents:false}),true);
 assert.equal(canCloseAfterSuccessfulSave({savedSections:['Condiciones contractuales'],documents:false}),true);
 assert.equal(canCloseAfterSuccessfulSave({savedSections:[],documents:false}),false,'Sin persistencia no debe cerrar');
 assert.equal(canCloseAfterSuccessfulSave({savedSections:['Ficha general'],documents:true}),false,'Borrador documental bloquea cierre');
 assert.equal(canCloseAfterSuccessfulSave(),false,'Sin contexto no cerrar');
});
