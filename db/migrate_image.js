import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Client } = pg;

async function migrateImageColumn() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('🔌 Connecting to Neon database...');
    await client.connect();
    console.log('✅ Connected successfully!');

    console.log('\n📋 Adding image_url column...');
    const sql = fs.readFileSync(path.join(__dirname, 'add_image_column.sql'), 'utf8');
    await client.query(sql);
    console.log('✅ Image column added and default images set!');

    console.log('\n✨ Migration complete!');
  } catch (error) {
    console.error('❌ Error migrating:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrateImageColumn();
