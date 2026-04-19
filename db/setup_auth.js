import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function setupAuth() {
  try {
    console.log('🔐 Setting up authentication tables...');

    // Read and execute auth schema
    const authSchema = readFileSync(join(__dirname, 'auth_schema.sql'), 'utf-8');
    await pool.query(authSchema);

    // Hash the default admin password
    const defaultPassword = 'admin123';
    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    // Update the admin user with proper hash
    await pool.query(`
      INSERT INTO users (username, password_hash, full_name, role, status)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (username)
      DO UPDATE SET password_hash = $2
    `, ['admin', passwordHash, 'System Administrator', 'super_admin', 'active']);

    console.log('✅ Authentication tables created');
    console.log('👤 Default admin user created');
    console.log('   Username: admin');
    console.log('   Password: admin123');
    console.log('   ⚠️  Please change the password after first login!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error setting up authentication:', error);
    process.exit(1);
  }
}

setupAuth();
