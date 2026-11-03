export async function migrateWorkerUppercase(db) {
  const id='20261011_017_worker_uppercase';
  if((await db.execute('SELECT id FROM schema_migrations WHERE id=?',[id]))[0].length)return;
  await db.execScript(`CREATE TABLE employee_standardization_history (
    employee_id INTEGER PRIMARY KEY REFERENCES employees(id) ON DELETE RESTRICT,
    previous_values_json TEXT NOT NULL,
    normalized_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );`);
  const columns=['full_name','first_name','second_name','other_names','first_last_name','second_last_name','email'];
  const [workers]=await db.execute('SELECT id,'+columns.join(',')+' FROM employees');
  for(const worker of workers) {
    const values=columns.map(key=>typeof worker[key]==='string'?worker[key].toLocaleUpperCase('es-CL'):worker[key]);
    if(columns.every((key,index)=>worker[key]===values[index]))continue;
    await db.execute('INSERT INTO employee_standardization_history(employee_id,previous_values_json) VALUES(?,?)',[worker.id,JSON.stringify(worker)]);
    await db.execute('UPDATE employees SET '+columns.map(key=>key+'=?').join(',')+' WHERE id=?',[...values,worker.id]);
    await db.execute('UPDATE employee_files SET revision=revision+1 WHERE employee_id=?',[worker.id]);
  }
  await db.execute('INSERT INTO schema_migrations(id) VALUES(?)',[id]);
}
