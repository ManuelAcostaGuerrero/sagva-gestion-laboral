// Ensayo aislado de reconstrucción, NO importador ni sustituto de producción.
// Crea una base nueva en .local con nombre aleatorio. Nunca edita server/.env.
import fs from 'node:fs';
import path from 'node:path';
import {projectRoot} from '../server/src/databasePath.js';

const local=path.join(projectRoot,'.local');
fs.mkdirSync(local,{recursive:true});
const folder=fs.mkdtempSync(path.join(local,'dt-ensayo-'));
const destination=path.join(folder,'asistencia-ensayo.db');
const relative=path.relative(projectRoot,destination).replaceAll('\\','/');
if(!relative.startsWith('.local/dt-ensayo-')||fs.existsSync(destination))
  throw new Error('Destino de ensayo inválido o existente. No se tocaron datos.');
// Se anula cualquier Root y clave bancaria para el proceso transitorio de prueba.
// Nunca se modifican variables ni archivos del sistema operativo del usuario.
process.env.SQLITE_PATH=relative;
process.env.SAGVA_ROOT_USER_ID='';
process.env.SAGVA_BANK_DATA_KEY='';
process.env.JWT_SECRET='solo-pruebas-base-limpia-nunca-produccion-2026';
const {runMigrations}=await import('../server/src/migrations.js');
const {pool}=await import('../server/src/db.js');

try{
  await runMigrations();
  const [integrity]=await pool.execute('PRAGMA integrity_check');
  const [foreignKeys]=await pool.execute('PRAGMA foreign_key_check');
  const [workers]=await pool.execute('SELECT COUNT(*) AS n FROM employees');
  const [history]=await pool.execute('SELECT COUNT(*) AS n FROM employment_relationships');
  const [prevision]=await pool.execute('SELECT COUNT(*) AS n FROM employee_prevision_versions');
  const [marks]=await pool.execute('SELECT COUNT(*) AS n FROM attendance_records');
  if(integrity[0]?.integrity_check!=='ok'||foreignKeys.length||workers[0].n||
     history[0].n||prevision[0].n||marks[0].n)
    throw new Error('La base de ensayo no está limpia o íntegra. Revisar sin copiar datos reales.');
  fs.writeFileSync(path.join(folder,'SOLO_ENSAYO_NO_PRODUCCION.txt'),
    'Base generada con migraciones de prueba. No migrar trabajadores o marcaciones sin autorización.\n');
  console.log(JSON.stringify({
    purpose:'DT_TEST_ONLY',database:relative,workers:0,relationships:0,attendanceMarks:0,
    integrity:'ok',foreignKeyViolations:0,productionModified:false
  },null,2));
}catch(error){
  console.error('No se generó un entorno de ensayo válido: '+error.message);
  throw error;
}finally{
  await pool.end();
}
