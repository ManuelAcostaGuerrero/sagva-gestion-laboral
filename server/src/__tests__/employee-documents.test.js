import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SQLITE_PATH = ':memory:';
process.env.JWT_SECRET = 'employee-document-test-secret';
const { app } = await import('../app.js');
const { pool } = await import('../db.js');
const { runMigrations } = await import('../migrations.js');
const { signAdmin } = await import('../auth.js');
const { calculateDocumentExpiry } = await import('../employeeDocuments.js');

test('Vencimiento automático calcula meses de calendario, años y días correctamente', () => {
  assert.equal(calculateDocumentExpiry('2026-10-09', 3, 'MONTHS'), '2027-01-09');
  assert.equal(calculateDocumentExpiry('2026-01-31', 1, 'MONTHS'), '2026-02-28');
  assert.equal(calculateDocumentExpiry('2024-02-29', 1, 'YEARS'), '2025-02-28');
  assert.equal(calculateDocumentExpiry('2026-10-09', 7, 'DAYS'), '2026-10-16');
  assert.throws(() => calculateDocumentExpiry('2026-02-30', 3, 'MONTHS'));
});

test('Catálogo inicial y anexos financieros; administración crea tipos y cada renovación conserva fechas/PDF', async () => {
  await runMigrations();
  await runMigrations();
  const [initial] = await pool.execute('SELECT name,expiry_mode AS mode,period_value AS period FROM employee_document_types');
  assert.deepEqual(initial.find(type=>type.name==='PACTO DE HORAS'), { name:'PACTO DE HORAS',mode:'PERIOD',period:3 });
  assert.equal(initial.length,4);
  const [owner] = await pool.execute("INSERT INTO admins(username,password_hash,full_name,role) VALUES('docs-admin','hash','Documentos','admin')");
  const [operator] = await pool.execute("INSERT INTO admins(username,password_hash,full_name,role) VALUES('docs-operador','hash','Operador','operator')");
  const [worker] = await pool.execute("INSERT INTO employees(full_name,document_id) VALUES('Trabajador de pruebas','98.654.321-0')");
  const adminToken = signAdmin({ id:owner.insertId,username:'docs-admin',role:'admin' });
  const operatorToken = signAdmin({ id:operator.insertId,username:'docs-operador',role:'operator' });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = 'http://127.0.0.1:' + server.address().port + '/api';
  async function request(url, token, method='GET', body=null, expected=200, headers={}) {
    const response = await fetch(base+url, {
      method,
      headers:{ Authorization:'Bearer '+token, 'Content-Type':'application/json', ...headers },
      body:body == null ? undefined : (typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body))
    });
    const data = await response.json();
    assert.equal(response.status,expected,method+' '+url+': '+JSON.stringify(data));
    return data;
  }
  try {
    const catalog = await request('/employee-documents/types',operatorToken);
    assert.equal(catalog.types.length,4);
    const typeId = catalog.types.find(type=>type.name==='PACTO DE HORAS').id;
    await request('/employee-documents/types',operatorToken,'POST',{name:'ENTREGA DE CAMISAS',expiryMode:'NONE'},403);
    const custom = await request('/employee-documents/types',adminToken,'POST',{name:'entrega de camisas',expiryMode:'NONE'},201);
    assert.ok(custom.id);
    const first = await request('/employee-documents/workers/'+worker.insertId+'/entries',operatorToken,'POST',{
      typeId,deliveredOn:'2026-10-09',startOn:'2026-10-09'
    },201);
    let history = await request('/employee-documents/workers/'+worker.insertId,operatorToken);
    assert.equal(history.entries.length,1);
    assert.equal(history.entries[0].expiresOn,'2027-01-09');
    assert.equal(history.entries[0].attachments.length,0);
    const pdf=Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF');
    const upload=await fetch(base+'/employee-documents/entries/'+first.id+'/pdf',{
      method:'POST',
      headers:{Authorization:'Bearer '+operatorToken,'Content-Type':'application/pdf','X-Documento-Firmado':'si','X-Fecha-Firma':'2026-10-09'},
      body:pdf
    });
    assert.equal(upload.status,201,await upload.text());
    const renewal = await request('/employee-documents/workers/'+worker.insertId+'/entries',operatorToken,'POST',{
      typeId,deliveredOn:'2027-01-09',startOn:'2027-01-09'
    },201);
    history = await request('/employee-documents/workers/'+worker.insertId,adminToken);
    assert.equal(history.entries.length,2);
    assert.equal(history.entries[0].id,renewal.id);
    assert.equal(history.entries[0].expiresOn,'2027-04-09');
    assert.equal(history.entries[0].attachments.length,0);
    assert.equal(history.entries[1].id,first.id);
    assert.equal(history.entries[1].attachments.length,1);
    assert.equal(history.entries[1].attachments[0].signedPhysical,true);
    const archivedPDF=await fetch(base+'/employee-documents/attachments/'+history.entries[1].attachments[0].id+'/pdf',{
      headers:{Authorization:'Bearer '+adminToken}
    });
    assert.equal(archivedPDF.status,200);
    assert.deepEqual(Buffer.from(await archivedPDF.arrayBuffer()),pdf);
    await request('/employee-documents/workers/'+worker.insertId+'/entries',operatorToken,'POST',{
      typeId:custom.id,deliveredOn:'2026-10-09'
    },201);
    history=await request('/employee-documents/workers/'+worker.insertId,operatorToken);
    assert.equal(history.entries.filter(record=>record.typeId===custom.id).length,1);
    assert.equal(history.entries.find(record=>record.typeId===custom.id).expiresOn,null);
    const entryUrl = '/employee-documents/workers/'+worker.insertId+'/entries';
    for (const target of [typeId, custom.id]) {
      await request(entryUrl,operatorToken,'POST',{
        typeId:target,deliveredOn:'2026-10-10',startOn:'2026-10-10',expiryMode:'MANUAL',expiresOn:'2026-11-27'
      },201);
      await request(entryUrl,operatorToken,'POST',{
        typeId:target,deliveredOn:'2026-11-27',startOn:'2026-11-27',expiryMode:'MANUAL',expiresOn:'2027-02-14'
      },201);
    }
    for (const expiresOn of ['', '2026-02-30', '2026-10-09'])
      await request(entryUrl,operatorToken,'POST',{
        typeId,deliveredOn:'2026-10-10',startOn:'2026-10-10',expiryMode:'MANUAL',expiresOn
      },400);
    await request(entryUrl,operatorToken,'POST',{
      typeId,deliveredOn:'2026-10-10',expiryMode:'MANUAL',expiresOn:'2026-12-01'
    },400);
    history=await request('/employee-documents/workers/'+worker.insertId,operatorToken);
    const manual=history.entries.filter(entry=>entry.expiryMode==='MANUAL');
    assert.equal(manual.length,4);
    assert.deepEqual(manual.filter(entry=>entry.typeId===typeId).map(entry=>entry.expiresOn),['2027-02-14','2026-11-27']);
    assert.equal(history.entries.find(entry=>entry.id===first.id).expiresOn,'2027-01-09');
    assert.equal(history.entries.find(entry=>entry.id===first.id).attachments.length,1);
    assert.equal((await request('/employee-documents/types',operatorToken)).types.find(type=>type.id===typeId).expiryMode,'PERIOD');
    assert.deepEqual((await pool.execute('PRAGMA foreign_key_check'))[0],[]);
    const [audit]=await pool.execute("SELECT action,entity_type AS entityType FROM audit_logs WHERE entity_type LIKE 'employee_document_%'");
    assert.ok(audit.some(r=>r.entityType==='employee_document_attachment' && r.action==='upload'));
    assert.ok(audit.some(r=>r.entityType==='employee_document_entry' && r.action==='create'));
  } finally {
    await new Promise(resolve=>server.close(resolve));
    await pool.end();
  }
});
