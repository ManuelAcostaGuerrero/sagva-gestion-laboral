import { app } from './app.js';
import { runMigrations } from './migrations.js';
import { pool } from './db.js';

const port=Number(process.env.PORT || 4000);
try {
  await runMigrations();
  const server=app.listen(port,process.env.HOST || '0.0.0.0',()=>console.log(`API lista en http://localhost:${port}`));
  let closing=false;
  const close=()=> {
    if (closing) return;
    closing=true;
    const timeout=setTimeout(()=>process.exit(1),5000).unref();
    server.close(async()=> { await pool.end(); clearTimeout(timeout); process.exit(0); });
  };
  process.on('SIGINT',close);
  process.on('SIGTERM',close);
  server.on('error',async error=> { console.error('No se pudo abrir el puerto:',error.message); await pool.end(); process.exit(1); });
} catch (error) {
  console.error('No se pudieron ejecutar las migraciones:',error.message);
  await pool.end();
  process.exit(1);
}
