import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SQLITE_PATH=':memory:';
process.env.JWT_SECRET='catalogo-documentos-tests-secret';
const {app}=await import('../app.js');
const {pool}=await import('../db.js');
const {runMigrations}=await import('../migrations.js');
const {signAdmin}=await import('../auth.js');

test('Catálogo de documentos: roles, asignación, corrección de reglas, bloqueo de borrado e historial',async()=>{
  await runMigrations();
  await runMigrations(); // Sin repetir columnas ni tipos
  const [admin]=await pool.execute("INSERT INTO admins(username,password_hash,full_name,role) VALUES('doc-cat-admin','hash','Admin','admin')");
  const [operator]=await pool.execute("INSERT INTO admins(username,password_hash,full_name,role) VALUES('doc-cat-oper','hash','Operador','operator')");
  const [employeeA]=await pool.execute("INSERT INTO employees(full_name) VALUES('Persona A')");
  const [employeeB]=await pool.execute("INSERT INTO employees(full_name) VALUES('Persona B')");
  const adminToken=signAdmin({id:admin.insertId,username:'doc-cat-admin',role:'admin'});
  const operatorToken=signAdmin({id:operator.insertId,username:'doc-cat-oper',role:'operator'});
  const server=app.listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  const base='http://127.0.0.1:'+server.address().port+'/api';
  async function req(path,token=adminToken,method='GET',body,expected=200) {
    const response=await fetch(base+path,{method,headers:{
      'Authorization':'Bearer '+token,'Content-Type':'application/json'
    },body:body===undefined?undefined:JSON.stringify(body)});
    const data=await response.json();
    assert.equal(response.status,expected,method+' '+path+': '+JSON.stringify(data));
    return data;
  }
  try {
    let catalog=(await req('/document-catalog')).types;
    assert.equal(catalog.length,4);
    const pactId=catalog.find(type=>type.name==='PACTO DE HORAS').id;
    await req('/document-catalog',operatorToken,'POST',{name:'Prohibido',expiryMode:'NONE'},403);
    const created=await req('/document-catalog',adminToken,'POST',{
      name:'Entrega de camisas',expiryMode:'NONE',applicability:'SELECTED',employeeIds:[employeeB.insertId]
    },201);
    await req('/document-catalog',adminToken,'POST',{
      name:'ENTREGA DE CAMISAS',expiryMode:'EVENT'
    },409);
    let a=(await req('/employee-documents/types?workerId='+employeeA.insertId,operatorToken)).types;
    let b=(await req('/employee-documents/types?workerId='+employeeB.insertId,operatorToken)).types;
    assert.equal(a.some(t=>t.id===created.id),false);
    assert.equal(b.some(t=>t.id===created.id),true);
    await req('/employee-documents/workers/'+employeeA.insertId+'/entries',operatorToken,'POST',{
      typeId:created.id,deliveredOn:'2026-10-09'
    },403);
    const entry=await req('/employee-documents/workers/'+employeeB.insertId+'/entries',operatorToken,'POST',{
      typeId:created.id,deliveredOn:'2026-10-09'
    },201);
    assert.ok(entry.id);
    const original=await req('/employee-documents/workers/'+employeeB.insertId,operatorToken);
    assert.equal(original.entries[0].documentName,'ENTREGA DE CAMISAS');
    const linked=await req('/document-catalog/'+created.id+'/workers');
    assert.equal(linked.workers.length,1);
    assert.equal(linked.workers[0].id,employeeB.insertId);
    assert.equal(linked.workers[0].historyCount,1);
    const rejected=await req('/document-catalog/'+created.id+'/permanent',adminToken,'DELETE',undefined,409);
    assert.equal(rejected.assignedEmployees.length,1);
    assert.equal(rejected.historyCount,1);
    await req('/document-catalog/'+created.id,adminToken,'PUT',{
      name:'ENTREGA DE UNIFORME',expiryMode:'EVENT',applicability:'ALL',employeeIds:[]
    });
    const old=await req('/employee-documents/workers/'+employeeB.insertId,operatorToken);
    assert.equal(old.entries[0].documentName,'ENTREGA DE CAMISAS');
    assert.equal(old.entries[0].deliveredOn,'2026-10-09');
    a=(await req('/employee-documents/types?workerId='+employeeA.insertId,operatorToken)).types;
    assert.equal(a.some(t=>t.id===created.id),true);
    await req('/document-catalog/'+created.id+'/deactivate',adminToken,'POST',{reason:'Modelo cambiado'},200);
    a=(await req('/employee-documents/types?workerId='+employeeA.insertId,operatorToken)).types;
    b=(await req('/employee-documents/types?workerId='+employeeB.insertId,operatorToken)).types;
    assert.equal(a.some(t=>t.id===created.id),false);
    assert.equal(b.find(t=>t.id===created.id).canRegister,false);
    await req('/employee-documents/workers/'+employeeB.insertId+'/entries',operatorToken,'POST',{
      typeId:created.id,deliveredOn:'2026-10-10'
    },409);
    await req('/document-catalog/'+created.id+'/reactivate',adminToken,'POST',{});
    // Cambio de regla del pacto no recalcula ni altera entregas anteriores.
    const oldPact=await req('/employee-documents/workers/'+employeeA.insertId+'/entries',operatorToken,'POST',{
      typeId:pactId,deliveredOn:'2026-10-09',startOn:'2026-10-09'
    },201);
    await req('/document-catalog/'+pactId,adminToken,'PUT',{
      name:'PACTO DE HORAS',expiryMode:'PERIOD',periodValue:4,periodUnit:'MONTHS',applicability:'ALL',employeeIds:[]
    });
    const newPact=await req('/employee-documents/workers/'+employeeA.insertId+'/entries',operatorToken,'POST',{
      typeId:pactId,deliveredOn:'2027-01-09',startOn:'2027-01-09'
    },201);
    const records=await req('/employee-documents/workers/'+employeeA.insertId,operatorToken);
    assert.equal(records.entries.find(e=>e.id===oldPact.id).expiresOn,'2027-01-09');
    assert.equal(records.entries.find(e=>e.id===newPact.id).expiresOn,'2027-05-09');
    const unlinked=await req('/document-catalog',adminToken,'POST',{
      name:'Prueba sin uso',expiryMode:'NONE'
    },201);
    await req('/document-catalog/'+unlinked.id+'/permanent',adminToken,'DELETE');
    const selected=await req('/document-catalog',adminToken,'POST',{
      name:'Prueba asignada',expiryMode:'NONE',applicability:'SELECTED',employeeIds:[employeeA.insertId]
    },201);
    await req('/document-catalog/'+selected.id+'/permanent',adminToken,'DELETE',undefined,409);
    await req('/document-catalog/'+selected.id,adminToken,'PUT',{
      name:'PRUEBA ASIGNADA',expiryMode:'NONE',applicability:'SELECTED',employeeIds:[]
    });
    await req('/document-catalog/'+selected.id+'/permanent',adminToken,'DELETE');
    assert.deepEqual((await pool.execute('PRAGMA foreign_key_check'))[0],[]);
    assert.ok((await pool.execute("SELECT * FROM audit_logs WHERE entity_type='employee_document_type'"))[0].length>=6);
  } finally {
    await new Promise(resolve=>server.close(resolve));
    await pool.end();
  }
});
