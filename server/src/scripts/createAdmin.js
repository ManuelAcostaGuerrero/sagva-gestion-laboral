import { runMigrations } from '../migrations.js';
import { bootstrapAdmin } from '../bootstrapAdmin.js';
import { pool } from '../db.js';

try { await runMigrations(); await bootstrapAdmin(); }
finally { await pool.end(); }
