import pg from 'pg';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function createTestUsers() {
  try {
    console.log('🔐 Creating test users...');

    // Hash passwords
    const stockKeeperPassword = await bcrypt.hash('stockkeeper123', 10);
    const productionPassword = await bcrypt.hash('production123', 10);

    // Create stock keeper user
    await pool.query(`
      INSERT INTO users (username, password_hash, full_name, email, role, status)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (username) DO UPDATE
      SET password_hash = $2, full_name = $3, email = $4, role = $5, status = $6
    `, ['stockkeeper', stockKeeperPassword, 'Stock Keeper User', 'stockkeeper@aluminiumking.com', 'stock_keeper', 'active']);

    console.log('✅ Stock Keeper user created/updated');
    console.log('   Username: stockkeeper');
    console.log('   Password: stockkeeper123');
    console.log('   Role: Stock Keeper');

    // Create production user
    await pool.query(`
      INSERT INTO users (username, password_hash, full_name, email, role, status)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (username) DO UPDATE
      SET password_hash = $2, full_name = $3, email = $4, role = $5, status = $6
    `, ['production', productionPassword, 'Production User', 'production@aluminiumking.com', 'production', 'active']);

    console.log('✅ Production user created/updated');
    console.log('   Username: production');
    console.log('   Password: production123');
    console.log('   Role: Production');

    console.log('\n📋 Summary of all test users:');
    console.log('┌─────────────┬─────────────────────┬────────────────┐');
    console.log('│ Username    │ Password            │ Role           │');
    console.log('├─────────────┼─────────────────────┼────────────────┤');
    console.log('│ admin       │ admin123            │ Super Admin    │');
    console.log('│ stockkeeper │ stockkeeper123      │ Stock Keeper   │');
    console.log('│ production  │ production123       │ Production     │');
    console.log('└─────────────┴─────────────────────┴────────────────┘');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating test users:', error);
    process.exit(1);
  }
}

createTestUsers();
