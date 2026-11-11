// Laboratorio 38: API HTTP real → proxy web → Express → SQLite beta aislada.
// Sólo datos sintéticos. Nunca ejecutar en la carpeta de producción.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

if(process.env.SAGVA_LABOR_BETA_CI!=='1')throw Error('Solo habilitado para runner CI beta explícito.');
const cfg=JSON.parse(fs.readFileSync('.local/beta-dt.json','utf8'));
const context=JSON.parse(fs.readFileSync('.local/beta-context.json','utf8'));
assert.equal(cfg.purpose,'DT_TEST_ONLY');
assert.equal(cfg.webPort,5195);
assert.match(cfg.database,/^\.local\/dt-ensayo-[A-Za-z0-9]+\/asistencia-ensayo\.db$/);
assert.ok(fs.existsSync(cfg.database));
assert.ok(fs.existsSync('.local/beta-access.txt'));
const base='http://127.0.0.1:5195/api';
const reports=[];
async function call(route,method='GET',body,token=context.token){
 const response=await fetch(base+route,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},
 body:body===undefined?undefined:JSON.stringify(body)});
 return {status:response.status,data:await response.json()};
}
async function check(label,fn){
 try{await fn();reports.push({label,status:'PASS'});console.log('PASS:',label);}
 catch(e){reports.push({label,status:'FAIL',message:e.message});console.error('FAIL:',label,e.message);throw e;}
}
const evidence=name=>'DOCUMENTO SINTETICO '+name+' '+crypto.randomBytes(2).toString('hex');
let work,ids,company1,company2;
try{
 await check('1A catálogos y lectura Root protegida',async()=>{
   assert.equal((await call('/labor-structure/catalog','GET',undefined,null)).status,401);
   const r=await call('/labor-structure/catalog');
   assert.equal(r.status,200);
   work=r.data;
   ids={company:context.company,otherCompany:context.otherCompany};
   assert.ok(work.workers.some(x=>x.id===context.worker));
   assert.ok(work.companies.some(x=>x.id===ids.company));
   assert.ok(work.shifts.some(x=>x.id===context.shift));
   // Evita colisiones con pruebas P2/DT previas, que ya crean relaciones en context.worker.
   const fresh=await call('/employee-files','POST',{firstName:'LABOR',firstLastName:'CICLO',
    companyId:ids.company,employmentStatus:'ACTIVO'});
   assert.equal(fresh.status,201,JSON.stringify(fresh.data));
   ids.worker=fresh.data.file.id;
 });
 await check('1A sucursales por empresa, revisión optimista y duplicado bloqueado',async()=>{
  const suffix=crypto.randomBytes(3).toString('hex');
  const created=await call('/labor-structure/branches','POST',{companyId:ids.company,code:'BETA-'+suffix,name:'LOCAL FICTICIO ALFA',address:'CALLE SINTETICA 01'});
  assert.equal(created.status,201,JSON.stringify(created.data));company1=created.data.result.id;
  const other=await call('/labor-structure/branches','POST',{companyId:ids.otherCompany,code:'BETA-'+suffix,name:'LOCAL FICTICIO BETA',address:'CALLE SINTETICA 02'});
  assert.equal(other.status,201,JSON.stringify(other.data));company2=other.data.result.id;
  assert.equal((await call('/labor-structure/branches','POST',{companyId:ids.company,code:'BETA-'+suffix,name:'DUPLICADO'})).status,409);
  const changed=await call('/labor-structure/branches/'+company1,'PUT',{name:'LOCAL FICTICIO ALFA ACTUALIZADO',address:'DIR ACTUALIZADA',revision:1,active:true});
  assert.equal(changed.status,200,JSON.stringify(changed.data));
  assert.equal((await call('/labor-structure/branches/'+company1,'PUT',{name:'OTRA VERSION',address:'',revision:1,active:true})).status,409);
 });
 await check('1B contratar, evitar solapamiento y no duplicar persona',async()=>{
  assert.equal((await call('/labor-structure/employments','POST',{employeeId:ids.worker,companyId:ids.company,startedOn:'2026-02-30',evidenceRef:evidence('FECHA')})).status,400);
  const hired=await call('/labor-structure/employments','POST',{employeeId:ids.worker,companyId:ids.company,startedOn:'2026-01-01',evidenceRef:evidence('CONTRATACION')});
  assert.equal(hired.status,201,JSON.stringify(hired.data));ids.employment=hired.data.result.id;
  assert.equal((await call('/labor-structure/employments','POST',{employeeId:ids.worker,companyId:ids.company,startedOn:'2026-05-01',evidenceRef:evidence('SOLAPAMIENTO')})).status,409);
  const detail=await call('/labor-structure/workers/'+ids.worker);
  assert.equal(detail.status,200);assert.equal(detail.data.relations.length,1);
 });
 await check('1C acceso cruzado local-empresa denegado y traslado con vigencia',async()=>{
  let r=await call('/labor-structure/employments/'+ids.employment+'/assignments','POST',
   {validFrom:'2026-01-01',branchId:company2,areaId:context.area,positionId:null,evidenceRef:evidence('LOCAL AJENO')});
  assert.equal(r.status,403,JSON.stringify(r.data));
  const p=work.positions.find(x=>x.name===context.position);
  assert.ok(p);
  r=await call('/labor-structure/employments/'+ids.employment+'/assignments','POST',
   {validFrom:'2026-01-01',branchId:company1,areaId:context.area,positionId:p.id,evidenceRef:evidence('ASIGNACION INICIAL')});
  assert.equal(r.status,201,JSON.stringify(r.data));
  const moved=await call('/labor-structure/employments/'+ids.employment+'/assignments','POST',
   {validFrom:'2026-07-01',branchId:null,areaId:context.area,positionId:p.id,evidenceRef:evidence('TRASLADO')});
  assert.equal(moved.status,201,JSON.stringify(moved.data));
  const asOf=await call('/labor-structure/workers/'+ids.worker+'/as-of?on=2026-03-01');
  assert.equal(asOf.data.relationships[0].branchId,company1);
 });
 await check('1C sueldo y condiciones históricas, fechas y régimen legal',async()=>{
   const baseTerms={weeklyHours:42,breakMinutes:60,contractType:'INDEFINIDO',regime:'GENERAL',description:'CONTRATO FICTICIO'};
   const first=await call('/labor-structure/employments/'+ids.employment+'/conditions','POST',
     {...baseTerms,effectiveFrom:'2026-01-01',monthlyBaseSalaryClp:500000,evidenceRef:evidence('SUELDO 1')});
   assert.equal(first.status,201,JSON.stringify(first.data));
   const second=await call('/labor-structure/employments/'+ids.employment+'/conditions','POST',
     {...baseTerms,effectiveFrom:'2026-07-01',monthlyBaseSalaryClp:600000,evidenceRef:evidence('ANEXO SUELDO 2')});
   assert.equal(second.status,201,JSON.stringify(second.data));
   const before=await call('/labor-structure/workers/'+ids.worker+'/as-of?on=2026-05-01');
   const after=await call('/labor-structure/workers/'+ids.worker+'/as-of?on=2026-08-01');
   assert.equal(before.data.relationships[0].monthlyBaseSalaryClp,500000);
   assert.equal(after.data.relationships[0].monthlyBaseSalaryClp,600000);
   assert.equal((await call('/labor-structure/employments/'+ids.employment+'/conditions','POST',
     {...baseTerms,effectiveFrom:'2026-07-01',monthlyBaseSalaryClp:1,evidenceRef:evidence('DUPLICADO')})).status,409);
 });
 await check('1D turno contractual por fecha sin alterar marcaciones',async()=>{
   const first=await call('/labor-structure/employments/'+ids.employment+'/shifts','POST',
    {validFrom:'2026-01-01',shiftId:context.shift,evidenceRef:evidence('HORARIO 1')});
   assert.equal(first.status,201,JSON.stringify(first.data));
   const later=await call('/labor-structure/employments/'+ids.employment+'/shifts','POST',
    {validFrom:'2026-05-01',shiftId:context.shift,evidenceRef:evidence('HORARIO 2')});
   assert.equal(later.status,201,JSON.stringify(later.data));
   const before=await call('/labor-structure/workers/'+ids.worker+'/as-of?on=2026-04-01');
   assert.equal(before.data.shifts[0].shiftId,context.shift);
 });
 await check('1D AFP y salud por vigencia',async()=>{
   const afp=work.entities.find(x=>x.kind==='AFP'),health=work.entities.find(x=>x.kind==='FONASA'),isapre=work.entities.find(x=>x.kind==='ISAPRE');
   assert.ok(afp&&health&&isapre);
   const first=await call('/labor-structure/workers/'+ids.worker+'/prevision','POST',
     {validFrom:'2026-01-01',afpEntityId:afp.id,healthEntityId:health.id,planAmountHundredths:null,planUnit:null,evidenceRef:evidence('FONASA')});
   assert.equal(first.status,201,JSON.stringify(first.data));
   const second=await call('/labor-structure/workers/'+ids.worker+'/prevision','POST',
     {validFrom:'2026-07-01',afpEntityId:afp.id,healthEntityId:isapre.id,planAmountHundredths:200,planUnit:'UF',evidenceRef:evidence('ISAPRE')});
   assert.equal(second.status,201,JSON.stringify(second.data));
   const before=await call('/labor-structure/workers/'+ids.worker+'/as-of?on=2026-03-01');
   const after=await call('/labor-structure/workers/'+ids.worker+'/as-of?on=2026-08-01');
   assert.equal(before.data.prevision.healthEntityId,health.id);
   assert.equal(after.data.prevision.healthEntityId,isapre.id);
 });
 await check('1E término, recontratación, fuente y bitácora histórica',async()=>{
   const ended=await call('/labor-structure/employments/'+ids.employment+'/finish','POST',
     {endedOn:'2026-12-31',reason:evidence('MOTIVO DE TERMINO'),evidenceRef:evidence('TERMINO')});
   assert.equal(ended.status,200,JSON.stringify(ended.data));
   assert.equal((await call('/labor-structure/employments','POST',
     {employeeId:ids.worker,companyId:ids.company,startedOn:'2026-12-31',evidenceRef:evidence('SOLAPAMIENTO DIA FINAL')})).status,409);
   const hired=await call('/labor-structure/employments','POST',
     {employeeId:ids.worker,companyId:ids.company,startedOn:'2027-01-01',evidenceRef:evidence('RECONTRATACION')});
   assert.equal(hired.status,201,JSON.stringify(hired.data));
   const history=await call('/labor-structure/workers/'+ids.worker);
   assert.equal(history.data.relations.length,2);
   assert.ok(history.data.events.length>=7);
   assert.equal(history.data.terms.length,2);
   assert.equal(history.data.prevision.length,2);
 });
} finally {
 fs.writeFileSync('.local/beta-labor-api-results.json',JSON.stringify(reports,null,2));
 console.log('VALIDACION LABORAL:',reports.filter(x=>x.status==='PASS').length,'APROBADOS /',reports.filter(x=>x.status==='FAIL').length,'FALLIDOS');
}
