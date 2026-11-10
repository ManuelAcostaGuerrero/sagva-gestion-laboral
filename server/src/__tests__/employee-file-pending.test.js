import test from 'node:test';
import assert from 'node:assert/strict';
import {completeFileMissing} from '../workerFileStandards.js';
import {pendingTarget,fieldPending} from '../../../client/src/employeeFilePending.js';
test('La lista visible usa la misma validación que el servidor y apunta a campos reales',()=>{
 const record={firstName:'Uno',firstLastName:'Apellido',documentId:'12.345.678-5',birthDate:'1990-01-01',address:'Calle 1',company:'Empresa',positionName:'',workAreaId:'1',workSchedule:'FULL_TIME',contractType:'INDEFINIDO',hireDate:'',email:'uno@example.com',phone:'',mobile:''};
 const missing=completeFileMissing(record);
 assert.deepEqual(missing,['Cargo','Fecha de inicio','Teléfono o celular']);
 assert.equal(missing.length,3);
 assert.deepEqual(pendingTarget('Cargo'),['laboral','positionName']);
 assert.equal(fieldPending(missing,'positionName'),true);
 assert.equal(fieldPending(missing,'mobile'),true);
 assert.equal(fieldPending(missing,'documentId'),false);
 for(const label of missing)assert.ok(pendingTarget(label),label);
});
