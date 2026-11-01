import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
// Evita heredar PORT o DB_* pertenecientes a otro proyecto de esta computadora.
Object.assign(process.env, dotenv.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../server/.env'))));
process.env.PORT = '4000';
process.env.HOST = '127.0.0.1';
await import('../server/src/index.js');
