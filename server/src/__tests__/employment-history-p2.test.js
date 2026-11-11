import test from 'node:test';
import assert from 'node:assert/strict';
process.env.SQLITE_PATH=':memory:';
process.env.JWT_SECRET='p2-test-only-synthetic-secret';
const {pool}=await import('../db.js');
const {runMigrations}=await import('../migrations.js');
const {migrateEmploymentHistory,employmentContextAsOf,EMPLOYMENT_HISTORY_MIGRATION}=await import('../employmentHistory.js');

test('P2: esquema vacio, multiempresa, recontratacion, vigencias, integridad y rollback',async()=>{
  await runMigrations();await runMigrations();
  const [migration]=await pool.execute('SELECT id FROM schema_migrations WHERE id=?',[EMPLOYMENT_HISTORY_MIGRATION]);
  assert.equal(migration.length,1);
  const [empty]=await pool.execute('SELECT COUNT(*) n FROM employment_relationships');
  assert.equal(empty[0].n,0,'No convertir datos previos en relaciones inventadas');
  const [admin]=await pool.execute("INSERT INTO admins(username,password_hash,full_name,role) VALUES('p2-admin','hash','Admin sintético','admin')");
  const [worker]=await pool.execute("INSERT INTO employees(full_name) VALUES('Trabajador sintético P2')");
  const [worker2]=await pool.execute("INSERT INTO employees(full_name) VALUES('Trabajador secundario sintético')");
  const [company]=await pool.execute("INSERT INTO company_profiles(legal_name) VALUES('EMPRESA SINTÉTICA')");
  const [other]=await pool.execute("INSERT INTO company_profiles(legal_name) VALUES('OTRA EMPRESA SINTÉTICA')");
  const [area]=await pool.execute("INSERT INTO work_areas(name) VALUES('AREA P2')");
  const [position]=await pool.execute("INSERT INTO work_positions(name) VALUES('CARGO P2')");
  const [branch]=await pool.execute("INSERT INTO company_branches(company_id,code,name,created_by) VALUES(?,?,?,?)",
    [company.insertId,'CENTRO','LOCAL CENTRO',admin.insertId]);
  const [otherBranch]=await pool.execute("INSERT INTO company_branches(company_id,code,name,created_by) VALUES(?,?,?,?)",
    [other.insertId,'CENTRO','LOCAL OTRA EMPRESA',admin.insertId]);
  await assert.rejects(pool.execute("INSERT INTO company_branches(company_id,code,name) VALUES(?,?,?)",
    [company.insertId,'centro','NOMBRE DUPLICADO']));
  const newEmployment=async(eid,cid,start,end,status='ACTIVE')=>{
    const [result]=await pool.execute(
      "INSERT INTO employment_relationships(employee_id,company_id,started_on,ended_on,status,review_status,review_reason,reviewed_by,reviewed_at) VALUES(?,?,?,?,?,'CONFIRMED','Contrato comprobado',?,CURRENT_TIMESTAMP)",
      [eid,cid,start,end,status,admin.insertId]);return result.insertId;
  };
  const first=await newEmployment(worker.insertId,company.insertId,'2026-01-01','2026-06-30','ENDED');
  await assert.rejects(newEmployment(worker.insertId,company.insertId,'2026-06-30','2026-08-31'));
  const second=await newEmployment(worker.insertId,company.insertId,'2026-07-01',null);
  const multi=await newEmployment(worker.insertId,other.insertId,'2026-07-01',null);
  assert.notEqual(first,second);assert.notEqual(second,multi);
  await assert.rejects(pool.execute(
    "INSERT INTO employment_relationships(employee_id,company_id,started_on,status,review_reason) VALUES(?,?,'2026-09-01','ACTIVE','sin aprobacion')",
    [worker.insertId,company.insertId]));
  // No asociar sucursal de empresa ajena ni superponer asignaciones.
  await assert.rejects(pool.execute(
    "INSERT INTO employment_assignments(employment_id,branch_id,valid_from,evidence_ref,confirmed_by) VALUES(?,?,?,'Documento revisado',?)",
    [second,otherBranch.insertId,'2026-07-01',admin.insertId]));
  const [assignment1]=await pool.execute(
    "INSERT INTO employment_assignments(employment_id,branch_id,work_area_id,position_id,valid_from,valid_until,evidence_ref,confirmed_by) VALUES(?,?,?,?,?,?,?,?)",
    [second,branch.insertId,area.insertId,position.insertId,'2026-07-01','2026-08-01','Documento revisado',admin.insertId]);
  await assert.rejects(pool.execute(
    "INSERT INTO employment_assignments(employment_id,branch_id,valid_from,evidence_ref,confirmed_by) VALUES(?,?,?,'Documento revisado',?)",
    [second,branch.insertId,'2026-07-20',admin.insertId]));
  await pool.execute(
    "INSERT INTO employment_assignments(employment_id,branch_id,valid_from,evidence_ref,confirmed_by) VALUES(?,?,?,'Documento revisado',?)",
    [second,branch.insertId,'2026-08-01',admin.insertId]);
  await assert.rejects(pool.execute('DELETE FROM employment_assignments WHERE id=?',[assignment1.insertId]));
  const [terms1]=await pool.execute(
    "INSERT INTO employment_terms_versions(employment_id,effective_from,effective_until,monthly_base_salary_clp,weekly_hours,terms_snapshot_json,source_document_ref,confirmed_by) VALUES(?,?,?,?,?,?,?,?)",
    [second,'2026-07-01','2026-09-01',500000,42,JSON.stringify({revision:1,gratification:'ART_50'}),'CONTRATO-REVISADO',admin.insertId]);
  await assert.rejects(pool.execute(
    "INSERT INTO employment_terms_versions(employment_id,effective_from,monthly_base_salary_clp,source_document_ref,confirmed_by) VALUES(?,?,?,'ERR',?)",
    [second,'2026-08-01',550000,admin.insertId]));
  await pool.execute(
    "INSERT INTO employment_terms_versions(employment_id,effective_from,monthly_base_salary_clp,weekly_hours,terms_snapshot_json,source_document_ref,confirmed_by) VALUES(?,?,?,?,?,?,?)",
    [second,'2026-09-01',550000,42,'{}','ANEXO-REVISADO',admin.insertId]);
  await assert.rejects(pool.execute('UPDATE employment_terms_versions SET monthly_base_salary_clp=1 WHERE id=?',[terms1.insertId]));
  const before=await employmentContextAsOf(pool,worker.insertId,'2026-06-01');
  assert.equal(before.length,1);assert.equal(before[0].employmentId,first);
  const july=await employmentContextAsOf(pool,worker.insertId,'2026-07-20');
  assert.equal(july.length,2,'Puede tener empleos en empresas distintas');
  assert.equal(july.find(x=>x.employmentId===second).monthlyBaseSalaryClp,500000);
  assert.equal(july.find(x=>x.employmentId===second).branchId,branch.insertId);
  const september=await employmentContextAsOf(pool,worker.insertId,'2026-09-02');
  assert.equal(september.find(x=>x.employmentId===second).monthlyBaseSalaryClp,550000);
  assert.equal(september.find(x=>x.employmentId===second).workAreaId,null);
  // No marcar ni alterar registros preexistentes: la vinculacion requiere coincidencia por persona y fecha.
  const [mark]=await pool.execute(
    "INSERT INTO attendance_records(employee_id,record_type,registered_at) VALUES(?,'entrada','2026-07-25 09:00:00')",[worker.insertId]);
  const [wrong]=await pool.execute(
    "INSERT INTO attendance_records(employee_id,record_type,registered_at) VALUES(?,'entrada','2026-07-25 09:00:00')",[worker2.insertId]);
  await assert.rejects(pool.execute(
    "INSERT INTO attendance_employment_links(record_id,employment_id,evidence_ref,confirmed_by) VALUES(?,?,?,?)",
    [wrong.insertId,second,'Declaracion revisada',admin.insertId]));
  await assert.rejects(pool.execute(
    "INSERT INTO attendance_employment_links(record_id,employment_id,evidence_ref,confirmed_by) VALUES(?,?,?,?)",
    [mark.insertId,first,'Declaracion revisada',admin.insertId]));
  await pool.execute(
    "INSERT INTO attendance_employment_links(record_id,employment_id,evidence_ref,confirmed_by) VALUES(?,?,?,?)",
    [mark.insertId,second,'Declaracion revisada',admin.insertId]);
  await assert.rejects(pool.execute('DELETE FROM attendance_employment_links WHERE record_id=?',[mark.insertId]));
  const [original]=await pool.execute('SELECT employee_id,record_type,registered_at,is_void FROM attendance_records WHERE id=?',[mark.insertId]);
  assert.equal(original[0].registered_at,'2026-07-25 09:00:00');
  assert.equal(original[0].employee_id,worker.insertId);
  // Rollback total, ninguna entidad huérfana.
  const db=await pool.getConnection();
  try {
    await db.beginTransaction();
    await db.execute("INSERT INTO company_branches(company_id,code,name) VALUES(?,?,?)",[company.insertId,'ROLLBACK','LOCAL PRUEBA']);
    await assert.rejects(db.execute(
      "INSERT INTO employment_assignments(employment_id,branch_id,valid_from,evidence_ref,confirmed_by) VALUES(?,?,?,'SIN',?)",
      [second,otherBranch.insertId,'2026-09-01',admin.insertId]));
    await db.rollback();
  } finally {db.release();}
  const [rollbackRows]=await pool.execute("SELECT COUNT(*) AS n FROM company_branches WHERE code='ROLLBACK'");
  assert.equal(rollbackRows[0].n,0);
  assert.deepEqual((await pool.execute('PRAGMA foreign_key_check'))[0],[]);
  await pool.end();
});
