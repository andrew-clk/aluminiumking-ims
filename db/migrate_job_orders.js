import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Client } = pg;

async function migrateJobOrders() {
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

    // Create job orders schema
    console.log('\n📋 Creating job orders schema...');
    const schemaSQL = fs.readFileSync(path.join(__dirname, 'job_orders_schema.sql'), 'utf8');
    await client.query(schemaSQL);
    console.log('✅ Job orders schema created!');

    // Insert sample data
    console.log('\n🌱 Inserting sample job orders...');
    const seedSQL = fs.readFileSync(path.join(__dirname, 'job_orders_seed.sql'), 'utf8');
    await client.query(seedSQL);
    console.log('✅ Sample job orders inserted!');

    // Verify data
    console.log('\n🔍 Verifying data...');
    const counts = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM job_orders) as job_orders,
        (SELECT COUNT(*) FROM job_order_materials) as materials
    `);

    console.log('\n📊 Job Orders Summary:');
    console.log('  Job Orders:', counts.rows[0].job_orders);
    console.log('  Materials:', counts.rows[0].materials);

    const statusCount = await client.query(`
      SELECT status, COUNT(*) as count
      FROM job_orders
      GROUP BY status
      ORDER BY status
    `);

    console.log('\n📊 By Status:');
    statusCount.rows.forEach(row => {
      console.log(`  ${row.status}: ${row.count}`);
    });

    console.log('\n✨ Job orders migration complete!');
  } catch (error) {
    console.error('❌ Error migrating job orders:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrateJobOrders();
