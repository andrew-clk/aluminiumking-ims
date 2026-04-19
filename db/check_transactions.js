import pool from './index.js';

async function checkTransactions() {
  try {
    // Check if table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'transactions'
      );
    `);
    console.log('Transactions table exists:', tableCheck.rows[0].exists);

    if (tableCheck.rows[0].exists) {
      // Count transactions
      const count = await pool.query('SELECT COUNT(*) FROM transactions');
      console.log('Total transactions:', count.rows[0].count);

      // Get sample transactions
      const sample = await pool.query('SELECT * FROM transactions ORDER BY created_at DESC LIMIT 5');
      console.log('\nSample transactions:', JSON.stringify(sample.rows, null, 2));
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkTransactions();
