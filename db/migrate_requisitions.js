import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function migrate() {
  try {
    console.log('🔄 Running requisitions migration...');

    const sql = readFileSync(join(__dirname, 'add_user_to_requisitions.sql'), 'utf-8');
    await pool.query(sql);

    console.log('✅ Migration complete: Added user_id and job_order_id columns to requisitions table');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  }
}

migrate();
