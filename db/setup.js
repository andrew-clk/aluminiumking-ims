import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Client } = pg;

async function setupDatabase() {
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

    // Read and execute schema
    console.log('\n📋 Creating database schema...');
    const schemaSQL = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await client.query(schemaSQL);
    console.log('✅ Schema created successfully!');

    // Read and execute seed data
    console.log('\n🌱 Seeding database with sample data...');
    const seedSQL = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf8');
    await client.query(seedSQL);
    console.log('✅ Sample data inserted successfully!');

    // Verify data
    console.log('\n🔍 Verifying data...');
    const counts = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM products) as products,
        (SELECT COUNT(*) FROM purchase_orders) as purchase_orders,
        (SELECT COUNT(*) FROM po_items) as po_items,
        (SELECT COUNT(*) FROM requisitions) as requisitions,
        (SELECT COUNT(*) FROM requisition_items) as requisition_items,
        (SELECT COUNT(*) FROM transactions) as transactions
    `);

    console.log('\n📊 Database Summary:');
    console.log('  Products:', counts.rows[0].products);
    console.log('  Purchase Orders:', counts.rows[0].purchase_orders);
    console.log('  PO Items:', counts.rows[0].po_items);
    console.log('  Requisitions:', counts.rows[0].requisitions);
    console.log('  Requisition Items:', counts.rows[0].requisition_items);
    console.log('  Transactions:', counts.rows[0].transactions);

    console.log('\n✨ Database setup complete!');
  } catch (error) {
    console.error('❌ Error setting up database:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

setupDatabase();
