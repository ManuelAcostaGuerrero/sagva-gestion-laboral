import test from 'node:test';
import assert from 'node:assert/strict';
import {familyAllowancePreview} from '../../../shared/familyAllowance.js';

process.env.SQLITE_PATH=':memory:';
process.env.JWT_SECRET='test-integrado-ajustes-laborales';
process.env.SAGVA_BANK_DATA_KEY='b'.repeat(64);
const {app}=await import('../app.js');
const {pool}=await import('../db.js');
const {runMigrations}=await import('../migrations.js');
const {signAdmin}=await import('../auth.js');
const {decryptBank}=await import('../benefitSecurity.js');

test('asignación familiar: renta acreditada, vigencia y montos oficiales no editables',()=>{
 const bands=[{tier:1,incomeFrom:0,incomeTo:649039,amountClp:22601},{tier:2,incomeFrom:649040,incomeTo:947990,amountClp:13870},{tier:3,incomeFrom:947991,incomeTo:1478539,amountClp:4382},{tier:4,incomeFrom:1478540,incomeTo:null,amountClp:0}];
 const dependents=[{recognitionStatus:'RECOGNIZED',validFrom:'2026-10-01',validUntil:''},{recognitionStatus:'PENDING'}, {recognitionStatus:'RECOGNIZED',validUntil:'2026-09-30'}];
 assert.equal(familyAllowancePreview({status:'RECOGNIZED',dependents,averageIncomeClp:600000,incomeVerified:true,brackets:bands,on:'2026-11-10'}).totalClp,22601);
 assert.equal(familyAllowancePreview({status:'RECOGNIZED',dependents,averageIncomeClp:600000,incomeVerified:false,brackets:bands,on:'2026-11-10'}).totalClp,null);
 assert.equal(familyAllowancePreview({status:'RECOGNIZED',dependents,averageIncomeClp:700000,incomeVerified:true,brackets:bands,on:'2026-11-10'}).totalClp,13870);
});

test('pruebas integradas: funciones, jornada, pago mixto, renta y autorización de cuenta de tercero',async t=>{
 await runMigrations();await runMigrations();
 const [admin]=await pool.execute("INSERT INTO admins(username,password_hash,full_name,role) VALUES('sagva-root-test','hash','Root de prueba','admin')");
 await pool.execute("INSERT INTO security_user_profiles(user_id,profile) VALUES(?,'root')",[admin.insertId]);
 const [employee]=await pool.execute("INSERT INTO employees(full_name,document_id) VALUES('Trabajador Ficticio','12.345.678-5')");
 const [areas]=await pool.execute('SELECT id FROM work_areas ORDER BY id LIMIT 1');
 assert.ok(areas.length>0);
 const areaId=areas[0].id,workerId=employee.insertId;
 await pool.execute("INSERT INTO work_positions(name,description) VALUES('CARGO SINTETICO','')");
 const token=signAdmin({id:admin.insertId,username:'sagva-root-test',role:'admin'});
 const server=app.listen(0,'127.0.0.1');
 await new Promise(resolve=>server.once('listening',resolve));
 t.after(()=>{server.close();delete process.env.SAGVA_BANK_DATA_KEY;});
 const url='http://127.0.0.1:'+server.address().port+'/api';
 async function call(path,method='GET',body){
  const response=await fetch(url+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  const data=await response.json().catch(()=>({}));
  return {status:response.status,data};
 }
 const duties={areaId,positionName:'CARGO SINTETICO',duties:'Gestionar turnos del local y verificar cierres.',revision:0,reason:'Nueva plantilla sintética de pruebas'};
 const saved=await call('/labor-job-duties','PUT',duties);
 assert.equal(saved.status,200,JSON.stringify(saved.data));
 assert.equal((await call('/labor-job-duties')).data.templates.find(x=>x.positionName==='CARGO SINTETICO').duties,duties.duties);
 assert.equal((await call('/labor-job-duties','PUT',duties)).status,409);
 const terms={revision:0,monthlyBaseSalary:650000,gratification:'ART_50',weeklyHours:42,shiftDistribution:'LUNES: 09:00–18:00',breakMinutes:30,workplace:'LOCAL PRINCIPAL',
 paymentMethod:'MIXTO',paymentDetails:'Transferencia parcial y efectivo restante',jobDuties:duties.duties,additionalTerms:'',
 shiftPlan:[{day:'LUNES',enabled:true,shifts:[{id:1,name:'Turno de prueba',startTime:'09:00',endTime:'18:00'}]}]};
 const contract=await call('/contract-terms/workers/'+workerId,'PUT',terms);
 assert.equal(contract.status,200,JSON.stringify(contract.data));
 assert.equal((await call('/contract-terms/workers/'+workerId)).data.terms.shiftPlan[0].day,'LUNES');
 const family={revision:0,status:'RECOGNIZED',dependents:[
  {fullName:'Causante Ficticio',relationship:'HIJO',recognitionStatus:'RECOGNIZED',institution:'IPS',recognitionDate:'2026-11-01',validFrom:'2026-11-01',validUntil:'',referenceCode:'TEST'}],
  averageIncomeClp:600000,incomePeriod:'enero a junio de 2026',incomeVerified:true};
 const f=await call('/employee-benefits/'+workerId+'/family','PUT',family);
 assert.equal(f.status,200,JSON.stringify(f.data));
 const familyRead=(await call('/employee-benefits/'+workerId+'/family')).data;
 assert.equal(familyRead.averageIncomeClp,600000);assert.equal(familyRead.incomeVerified,true);
 const current=(await call('/labor-benefits/family-brackets?on=2026-11-10')).data.current;
 assert.equal(familyAllowancePreview({...familyRead,brackets:current,on:'2026-11-10'}).totalClp,22601);
 const [banks]=await pool.execute("SELECT id FROM labor_banks WHERE code='012'");
 const bank={revision:0,bankId:banks[0].id,accountType:'VISTA',accountNumber:'000123456789',holderName:'Tercero Ficticio',holderRut:'11.111.111-1',authorizationRef:'BANCARIA-999'};
 assert.equal((await call('/employee-benefits/'+workerId+'/bank','PUT',bank)).status,400);
 const pdf=Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF');
 const upload=await fetch(url+'/employee-benefits/'+workerId+'/bank-authorization',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/pdf'},body:pdf});
 const uploaded=await upload.json();
 assert.equal(upload.status,201,JSON.stringify(uploaded));
 assert.match(uploaded.authorizationRef,/^BANCARIA-/);
 const account=await call('/employee-benefits/'+workerId+'/bank','PUT',{...bank,authorizationRef:uploaded.authorizationRef});
 assert.equal(account.status,200,JSON.stringify(account.data));
 const [encrypted]=await pool.execute('SELECT pdf_ciphertext AS ciphertext FROM employee_bank_authorizations WHERE id=?',[uploaded.id]);
 assert.ok(!encrypted[0].ciphertext.includes('%PDF-'));assert.ok(decryptBank(encrypted[0].ciphertext).pdfBase64);
 const document=await fetch(url+'/employee-benefits/'+workerId+'/bank-authorizations/'+uploaded.id+'/pdf',{headers:{Authorization:'Bearer '+token}});
 assert.equal(document.status,200);
 assert.equal(Buffer.from(await document.arrayBuffer()).toString('latin1'),pdf.toString('latin1'));
});
