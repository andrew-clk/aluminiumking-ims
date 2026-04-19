import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function syncSuppliers() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get distinct suppliers from products table
    const productsResult = await client.query(`
      SELECT DISTINCT supplier
      FROM products
      WHERE supplier IS NOT NULL
        AND supplier != ''
        AND status = 'active'
      ORDER BY supplier
    `);

    console.log('\n📋 Found suppliers in products table:');
    productsResult.rows.forEach(row => console.log('  -', row.supplier));

    // Get existing suppliers from suppliers table
    const existingResult = await client.query(`
      SELECT name FROM suppliers
    `);
    const existingNames = new Set(existingResult.rows.map(s => s.name));

    console.log('\n✅ Existing suppliers in suppliers table:');
    existingResult.rows.forEach(row => console.log('  -', row.name));

    // Find suppliers that need to be added
    const missingSuppliers = productsResult.rows
      .map(r => r.supplier)
      .filter(name => !existingNames.has(name));

    if (missingSuppliers.length === 0) {
      console.log('\n✓ All suppliers already exist in suppliers table!');
    } else {
      console.log('\n➕ Adding missing suppliers:');

      for (const supplierName of missingSuppliers) {
        await client.query(`
          INSERT INTO suppliers (name, contact_person, phone, email, address, lead_time_days, status)
          VALUES ($1, '', '', '', '', 7, 'active')
        `, [supplierName]);
        console.log('  ✓ Added:', supplierName);
      }
    }

    await client.query('COMMIT');
    console.log('\n🎉 Supplier sync completed successfully!');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error syncing suppliers:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

syncSuppliers().catch(console.error);
