import test from 'node:test';
import assert from 'node:assert/strict';
import {saveEmployeeSections} from '../../../client/src/saveEmployeeSections.js';

test('Guardar ficha persiste todas las secciones modificadas, en orden',async()=>{
  const calls=[];
  const completed=await saveEmployeeSections({
    generalDirty:true,medicalDirty:true,contractDirty:true,
    saveGeneral:async()=>calls.push('general'),
    saveMedical:async()=>calls.push('medical'),
    saveContract:async()=>calls.push('contract')
  });
  assert.deepEqual(calls,['general','medical','contract']);
  assert.deepEqual(completed,['Ficha general','Ficha médica','Condiciones contractuales']);
});
test('Desde cualquier pestaña guarda solo los datos que cambiaron',async()=>{
  const calls=[];
  const result=await saveEmployeeSections({
    medicalDirty:true,saveGeneral:()=>{throw Error('No guardar general sin cambios');},
    saveMedical:async()=>calls.push('medical'),
    saveContract:()=>{throw Error('No guardar contrato sin cambios');}
  });
  assert.deepEqual(calls,['medical']);
  assert.deepEqual(result,['Ficha médica']);
});
test('Al validar guarda primero ficha general y luego datos pendientes',async()=>{
  const calls=[];
  await saveEmployeeSections({completing:true,contractDirty:true,
    saveGeneral:async()=>calls.push('general'),
    saveMedical:()=>{throw Error('No requerido');},
    saveContract:async()=>calls.push('contract')
  });
  assert.deepEqual(calls,['general','contract']);
});
test('Error parcial detiene las secciones siguientes y conserva aviso de lo ya guardado',async()=>{
  const calls=[];
  await assert.rejects(
    saveEmployeeSections({generalDirty:true,medicalDirty:true,contractDirty:true,
      saveGeneral:async()=>calls.push('general'),
      saveMedical:async()=>{calls.push('medical');throw new Error('Conflicto 409');},
      saveContract:async()=>calls.push('contract')
    }),
    error=>{
      assert.deepEqual(error.completedSections,['Ficha general']);
      assert.match(error.message,/Se guardó: Ficha general/);
      assert.match(error.message,/Conflicto 409/);
      return true;
    }
  );
  assert.deepEqual(calls,['general','medical']);
});
test('Un formulario sin cambios no emite escrituras',async()=>{
 const completed=await saveEmployeeSections({});
 assert.deepEqual(completed,[]);
});
