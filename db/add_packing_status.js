import pool from './index.js';

async function addPackingStatus() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check if column already exists
    const checkColumn = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name='job_orders' AND column_name='packing_status'
    `);

    if (checkColumn.rows.length === 0) {
      console.log('Adding packing_status column to job_orders table...');
      await client.query(`
        ALTER TABLE job_orders
        ADD COLUMN packing_status VARCHAR(30) DEFAULT 'not_started'
      `);
      console.log('✓ Added packing_status column');

      // Add comment for documentation
      await client.query(`
        COMMENT ON COLUMN job_orders.packing_status IS
        'Packing status: not_started, in_progress, completed'
      `);
      console.log('✓ Added column comment');
    } else {
      console.log('✓ packing_status column already exists');
    }

    await client.query('COMMIT');
    console.log('✓ Migration completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('✗ Error adding packing status:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

addPackingStatus();
