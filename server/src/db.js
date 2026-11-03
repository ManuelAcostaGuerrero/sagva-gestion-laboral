import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { resolveDatabasePath } from './databasePath.js';

// Mantiene el contrato de resultados usado por las rutas, con SQL nativo SQLite.
export function createSqlitePool(filename = resolveDatabasePath()) {
  if (filename !== ':memory:') fs.mkdirSync(path.dirname(filename), { recursive: true });
  const database = new DatabaseSync(filename, { timeout: 5000 });
  database.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;');
  database.function('local_timestamp', { deterministic: true }, (date, time) => date == null || time == null ? null : `${String(date).slice(0,10)} ${time}`);
  database.function('minutes_between', { deterministic: true }, (start, end) => {
    if (start == null || end == null) return null;
    // Fechas de marcacion son horas locales sin zona; UTC aqui evita aplicar DST dos veces.
    const stamp = value => Date.parse(String(value).replace(' ', 'T') + 'Z');
    const delta = stamp(end) - stamp(start);
    return Number.isFinite(delta) ? Math.trunc(delta / 60000) : null;
  });

  let queue = Promise.resolve();
  let closed = false;
  function acquire() {
    let unlock;
    const hold = new Promise(resolve => { unlock = resolve; });
    const ready = queue;
    queue = ready.then(() => hold);
    return ready.then(() => unlock);
  }
  function execute(sql, parameters) {
    if (closed) throw new Error('Base SQLite cerrada.');
    const statement = database.prepare(sql);
    const normalize = value => value === undefined ? null : typeof value === 'boolean' ? Number(value) : value instanceof Date ? value.toISOString().slice(0,19).replace('T',' ') : value;
    let args=[];
    if (Array.isArray(parameters)) args=parameters.map(normalize);
    else if (parameters) {
      // MySQL permitia parametros extra; SQLite requiere enlazar solamente los usados.
      statement.setAllowUnknownNamedParameters(true);
      args=[Object.fromEntries(Object.entries(parameters).map(([key,value])=>[key,normalize(value)]))];
    }
    if (statement.columns().length) return [statement.all(...args).map(row=>({...row})), []];
    const result=statement.run(...args);
    return [{ insertId: Number(result.lastInsertRowid), affectedRows: Number(result.changes) }, []];
  }
  async function query(sql, parameters) {
    const unlock=await acquire();
    try { return execute(sql,parameters); } finally { unlock(); }
  }
  return {
    execute: query, query,
    async getConnection() {
      let unlock=await acquire();
      let transaction=false;
      let restoreForeignKeys=false;
      const release=()=> { if (restoreForeignKeys) { database.exec('PRAGMA foreign_keys=ON'); restoreForeignKeys=false; } if (unlock) { unlock(); unlock=null; } };
      return {
        async beginTransaction({ foreignKeys=true }={}) { if (!unlock) throw new Error('Conexion liberada.'); if (!foreignKeys) { database.exec('PRAGMA foreign_keys=OFF'); restoreForeignKeys=true; } database.exec('BEGIN IMMEDIATE'); transaction=true; },
        async execute(sql, parameters) { return unlock ? execute(sql,parameters) : query(sql,parameters); },
        async execScript(sql) { if (!unlock) throw new Error('Conexion liberada.'); database.exec(sql); },
        async commit() { try { if (transaction) { database.exec('COMMIT'); transaction=false; } } finally { if (!transaction) release(); } },
        async rollback() { try { if (transaction) database.exec('ROLLBACK'); } finally { transaction=false; release(); } },
        release() { try { if (transaction) database.exec('ROLLBACK'); } finally { transaction=false; release(); } }
      };
    },
    async end() { const unlock=await acquire(); try { if (!closed) { database.close(); closed=true; } } finally { unlock(); } }
  };
}

// Abrir solo cuando se pide una consulta permite respaldar sin crear una base vacia.
let singleton;
export const pool = Object.fromEntries(['execute','query','getConnection','end'].map(method=>[
  method, (...args)=> {
    if (method === 'end' && !singleton) return Promise.resolve();
    singleton ??= createSqlitePool();
    return singleton[method](...args);
  }
]));
