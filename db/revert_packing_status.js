import pool from './index.js';

async function revertPackingStatus() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('Removing packing_status column from job_orders table...');
    await client.query(`
      ALTER TABLE job_orders
      DROP COLUMN IF EXISTS packing_status
    `);
    console.log('✓ Removed packing_status column');

    await client.query('COMMIT');
    console.log('✓ Revert completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('✗ Error reverting packing status:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

revertPackingStatus();
