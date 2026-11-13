import test from 'node:test';import assert from 'node:assert/strict';
process.env.SQLITE_PATH=':memory:';process.env.JWT_SECRET='bank-purge-test-secret';
process.env.SAGVA_BANK_DATA_KEY='c'.repeat(64);
const {pool}=await import('../db.js');const {runMigrations}=await import('../migrations.js');
const {encryptBank,decryptBank}=await import('../benefitSecurity.js');
const {migrateBankRequestedOn,BANK_PURGE_REQUESTED_ON}=await import('../bankAuthorization.js');
test('Retira fecha bancaria de datos cifrados vigentes e históricos sin borrar cuentas',async()=>{
 await runMigrations();
 const [worker]=await pool.execute("INSERT INTO employees(full_name) VALUES('PERSONA FICTICIA')");
 const id=worker.insertId;const old=encryptBank({bankId:1,accountNumber:'01234',requestedOn:'2026-11-10'});
 await pool.execute('INSERT INTO employee_bank_accounts(employee_id,payload_ciphertext,revision) VALUES(?,?,1)',[id,old]);
 await pool.execute('INSERT INTO employee_bank_account_history(employee_id,revision,payload_ciphertext) VALUES(?,?,?)',[id,0,old]);
 await pool.execute('DELETE FROM schema_migrations WHERE id=?',[BANK_PURGE_REQUESTED_ON]);
 const db=await pool.getConnection();
 try{await db.beginTransaction();await migrateBankRequestedOn(db);await migrateBankRequestedOn(db);await db.commit();}
 catch(err){await db.rollback();throw err;}finally{db.release();}
 for(const table of ['employee_bank_accounts','employee_bank_account_history']){
  const [rows]=await pool.execute('SELECT payload_ciphertext AS payload FROM '+table);
  assert.equal(rows.length,1);const data=decryptBank(rows[0].payload);
  assert.equal(data.accountNumber,'01234');assert.equal(Object.hasOwn(data,'requestedOn'),false);
 }
});
