import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Client } = pg;

async function updateDefaultImages() {
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

    console.log('\n📋 Setting default images for all products...');
    const sql = fs.readFileSync(path.join(__dirname, 'set_default_images.sql'), 'utf8');
    const result = await client.query(sql);
    console.log(`✅ Updated ${result.rowCount} products with default image!`);

    console.log('\n✨ Update complete!');
  } catch (error) {
    console.error('❌ Error updating:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

updateDefaultImages();
