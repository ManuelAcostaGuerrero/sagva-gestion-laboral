import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {auditDataModel} from '../../../tools/auditar-modelo-datos.mjs';

test('P0: auditoría cuenta discrepancias sin devolver RUT, nombres, rutas ni modificar tablas',()=>{
 const db=new DatabaseSync(':memory:');
 try{
  db.exec(`
   CREATE TABLE employees(id INTEGER PRIMARY KEY,document_id TEXT,full_name TEXT,is_active INTEGER,position_name TEXT);
   CREATE TABLE employee_files(employee_id INTEGER PRIMARY KEY,employment_status TEXT,company_id INTEGER,company TEXT,extra_json TEXT);
   CREATE TABLE company_profiles(id INTEGER PRIMARY KEY,legal_name TEXT);
   CREATE TABLE work_positions(id INTEGER PRIMARY KEY,name TEXT);
   CREATE TABLE employee_contract_terms(employee_id INTEGER PRIMARY KEY,terms_json TEXT);
   INSERT INTO company_profiles VALUES(1,'EMPRESA VIGENTE');
   INSERT INTO work_positions VALUES(1,'CAJA');
   INSERT INTO employees VALUES(1,'RUT-SINTETICO','NOMBRE SINTETICO',1,'CAJA');
   INSERT INTO employees VALUES(2,NULL,'OTRO SINTETICO',0,'CARGO SIN CATALOGO');
   INSERT INTO employee_files VALUES(1,'INACTIVO',1,'RAZON SOCIAL HISTORICA','{}');
   INSERT INTO employee_files VALUES(2,'ACTIVO',NULL,'LEGADO SIN ID','{"legacy":true}');
   INSERT INTO employee_contract_terms VALUES(1,'{"monthlyBaseSalary":100}');
  `);
  db.exec('PRAGMA query_only=ON');
  const before=db.prepare('SELECT COUNT(*) n FROM employees').get().n;
  const result=auditDataModel(db);
  assert.equal(result.integrity,'ok');
  assert.equal(result.foreignKeyViolations,0);
  assert.equal(result.totals.workers,2);
  assert.equal(result.indicators.activeWithNonActiveStatus,1);
  assert.equal(result.indicators.inactiveWithActiveStatus,1);
  assert.equal(result.indicators.companyTextWithoutCompanyId,1);
  assert.equal(result.indicators.companyLabelDifferentFromCurrentCatalog,1);
  assert.equal(result.indicators.positionNotInCatalog,1);
  assert.equal(result.indicators.extraJsonInvalid,0);
  assert.equal(result.indicators.contractTermsJsonInvalid,0);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM employees').get().n,before);
  assert.equal(db.prepare('PRAGMA query_only').get().query_only,1);
  const output=JSON.stringify(result);
  assert.doesNotMatch(output,/RUT-SINTETICO|NOMBRE SINTETICO|RAZON SOCIAL HISTORICA|LEGADO SIN ID/);
 }finally{db.close();}
});

test('P0: una base sin schema laboral devuelve diagnóstico claro sin migrarla',()=>{
 const db=new DatabaseSync(':memory:');
 try {assert.throws(()=>auditDataModel(db),/employees/);} finally {db.close();}
});
