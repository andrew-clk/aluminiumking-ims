import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

async function listUsers() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('🔍 Checking for existing users in database...\n');

        // Check if users table exists
        const tableCheck = await pool.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_name = 'users'
        `);

        if (tableCheck.rows.length === 0) {
            console.log('❌ Users table does not exist.');
            console.log('   Run: node db/setup_auth.js to create it.\n');
            await pool.end();
            return;
        }

        // Get all users
        const users = await pool.query(`
            SELECT id, username, full_name, email, role, status, created_at
            FROM users
            ORDER BY created_at
        `);

        if (users.rows.length === 0) {
            console.log('❌ No users found in database.');
            console.log('   Run the following commands to create test users:');
            console.log('   1. node db/setup_auth.js (creates admin user)');
            console.log('   2. node db/create_test_users.js (creates test users)\n');
        } else {
            console.log(`✅ Found ${users.rows.length} user(s) in database:\n`);

            console.log('═══════════════════════════════════════════════════════════════════');
            console.log('                    EXISTING USER ACCOUNTS                         ');
            console.log('═══════════════════════════════════════════════════════════════════\n');

            users.rows.forEach((user, index) => {
                console.log(`${index + 1}. Username: ${user.username}`);
                console.log(`   Full Name: ${user.full_name}`);
                console.log(`   Email: ${user.email || 'Not set'}`);
                console.log(`   Role: ${user.role}`);
                console.log(`   Status: ${user.status}`);
                console.log(`   Created: ${new Date(user.created_at).toLocaleDateString()}`);
                console.log('   ---');
            });

            console.log('\n═══════════════════════════════════════════════════════════════════');
            console.log('                      TEST ACCOUNT CREDENTIALS                      ');
            console.log('═══════════════════════════════════════════════════════════════════\n');
            console.log('┌─────────────┬─────────────────────┬────────────────────────────┐');
            console.log('│ Username    │ Password            │ Role                       │');
            console.log('├─────────────┼─────────────────────┼────────────────────────────┤');
            console.log('│ admin       │ admin123            │ Super Admin (Full Access)  │');
            console.log('│ stockkeeper │ stockkeeper123      │ Stock Keeper               │');
            console.log('│ production  │ production123       │ Production                 │');
            console.log('└─────────────┴─────────────────────┴────────────────────────────┘');

            console.log('\n⚠️  Note: These are the default passwords. They should be changed');
            console.log('   after first login in a production environment.');

            // Check which users exist
            const existingUsernames = users.rows.map(u => u.username);
            const expectedUsers = ['admin', 'stockkeeper', 'production'];
            const missingUsers = expectedUsers.filter(u => !existingUsernames.includes(u));

            if (missingUsers.length > 0) {
                console.log(`\n⚠️  Missing users: ${missingUsers.join(', ')}`);
                console.log('   To create missing users, run:');
                if (missingUsers.includes('admin')) {
                    console.log('   - node db/setup_auth.js (for admin user)');
                }
                if (missingUsers.includes('stockkeeper') || missingUsers.includes('production')) {
                    console.log('   - node db/create_test_users.js (for test users)');
                }
            }
        }

        await pool.end();
    } catch (err) {
        console.error('Database error:', err.message);
        await pool.end();
    }
}

listUsers().catch(console.error);