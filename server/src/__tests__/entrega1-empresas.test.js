import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SQLITE_PATH = ':memory:';
process.env.JWT_SECRET = 'entrega1-prueba-local-sintetica';
const {app} = await import('../app.js');
const {pool} = await import('../db.js');
const {runMigrations} = await import('../migrations.js');
const {signAdmin} = await import('../auth.js');
const {getRegions} = await import('../../../shared/chileTerritory.js');

test('Entrega 1: empresas y domicilios encadenados, RUT y fichas históricas',async()=>{
 await runMigrations(); await runMigrations();
 const [admin]=await pool.execute("INSERT INTO admins(username,password_hash,full_name,role) VALUES('e1a','hash','Admin','admin')");
 const token=signAdmin({id:admin.insertId,username:'e1a',role:'admin'});
 const server=app.listen(0,'127.0.0.1');
 await new Promise(resolve=>server.once('listening',resolve));
 const base='http://127.0.0.1:'+server.address().port+'/api';
 async function req(path,method='GET',body,status=200){
   const response=await fetch(base+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
   const json=await response.json();
   assert.equal(response.status,status,path+' '+JSON.stringify(json));
   return json;
 }
 try{
   const region=getRegions().find(r=>r.includes('BIOBÍO'));
   assert.ok(region);
   const created=await req('/companies','POST',{
     legalName:'Empresa territorio',tradeName:'RED TAURUS',
     taxId:'77.376.536-7',representativeRut:'12.345.678-5',
     address:'Pasaje inventado 123',region,province:'CONCEPCIÓN',commune:'TALCAHUANO',
     city:'HUALPÉN',defaultBranch:'GASTRO-BAR'
   },201);
   const company=(await req('/companies')).companies.find(x=>x.id===created.id);
   assert.equal(company.region,region);
   assert.equal(company.province,'CONCEPCIÓN');
   assert.equal(company.commune,'TALCAHUANO');
   assert.equal(company.city,'HUALPÉN');
   assert.equal(company.defaultBranch,'GASTRO-BAR');
   await req('/companies','POST',{legalName:'RUT duplicado',taxId:'773765367'},409);
   await req('/companies','POST',{
     legalName:'Localidad inconsistente',region,province:'ARICA',commune:'TALCAHUANO'
   },400);
   const worker=await req('/employee-files','POST',{
     firstName:'Ana',firstLastName:'Ensayo',documentId:'12.345.678-5',companyId:created.id,
     extra:{region,province:'CONCEPCIÓN',commune:'TALCAHUANO',city:'HUALPÉN'}
   },201);
   assert.equal(worker.file.extra.region,region);
   assert.equal(worker.file.extra.commune,'TALCAHUANO');
   await req('/employee-files/'+worker.file.id,'PUT',{
     ...worker.file,extra:{...worker.file.extra,province:'ARICA'}
   },400);
   const updated=await req('/employee-files/'+worker.file.id,'PUT',{
     ...worker.file,extra:{...worker.file.extra,region:'',province:'',commune:'',city:''}
   });
   assert.equal(updated.file.extra.region,null);
   assert.equal(updated.file.extra.commune,null);
   const old=await req('/companies','POST',{legalName:'Empresa con comuna anterior',commune:'COMUNA LEGADA'},201);
   assert.ok(old.id);
   const [migrated]=await pool.execute('SELECT id FROM schema_migrations WHERE id=?',['20261108_016_company_territory']);
   assert.equal(migrated.length,1);
   assert.deepEqual((await pool.execute('PRAGMA foreign_key_check'))[0],[]);
 }finally{
   await new Promise(resolve=>server.close(resolve));
   await pool.end();
 }
});
