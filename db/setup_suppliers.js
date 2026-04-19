import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

async function setupSuppliers() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('🔧 Setting up supplier system...\n');

        // Check if suppliers table exists
        const tableCheck = await pool.query(`
            SELECT table_name FROM information_schema.tables
            WHERE table_schema='public' AND table_name='suppliers'
        `);

        if (tableCheck.rows.length === 0) {
            console.log('Creating suppliers table...');
            await pool.query(`
                CREATE TABLE suppliers (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) UNIQUE NOT NULL,
                    contact_person VARCHAR(255),
                    phone VARCHAR(50),
                    email VARCHAR(255),
                    address TEXT,
                    lead_time_days INTEGER DEFAULT 7,
                    notes TEXT,
                    status VARCHAR(20) DEFAULT 'active',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            console.log('✅ Suppliers table created');
        } else {
            console.log('✅ Suppliers table already exists');

            // Check if lead_time_days column exists
            const columnCheck = await pool.query(`
                SELECT column_name FROM information_schema.columns
                WHERE table_name='suppliers' AND column_name='lead_time_days'
            `);

            if (columnCheck.rows.length === 0) {
                console.log('Adding lead_time_days column...');
                await pool.query(`
                    ALTER TABLE suppliers ADD COLUMN lead_time_days INTEGER DEFAULT 7
                `);
                console.log('✅ Added lead_time_days column');
            }
        }

        // Get unique suppliers from products
        const uniqueSuppliers = await pool.query(`
            SELECT DISTINCT supplier
            FROM products
            WHERE supplier IS NOT NULL
            ORDER BY supplier
        `);

        console.log(`\n📋 Found ${uniqueSuppliers.rows.length} unique suppliers in products\n`);

        // Insert suppliers into suppliers table
        let inserted = 0;
        let existing = 0;

        for (const row of uniqueSuppliers.rows) {
            const supplierName = row.supplier;

            try {
                await pool.query(`
                    INSERT INTO suppliers (name, lead_time_days, status)
                    VALUES ($1, 7, 'active')
                    ON CONFLICT (name) DO NOTHING
                    RETURNING id
                `, [supplierName]);

                const result = await pool.query('SELECT id FROM suppliers WHERE name = $1', [supplierName]);
                if (result.rows.length > 0) {
                    console.log(`  ✅ ${supplierName}`);
                    inserted++;
                }
            } catch (err) {
                existing++;
            }
        }

        console.log(`\n📊 Summary:`);
        console.log(`   Created: ${inserted} new suppliers`);
        console.log(`   Existing: ${existing} suppliers already in database`);

        // Show all suppliers
        const allSuppliers = await pool.query(`
            SELECT id, name, phone, email, lead_time_days, status
            FROM suppliers
            ORDER BY name
        `);

        console.log(`\n📦 Total suppliers in database: ${allSuppliers.rows.length}\n`);
        allSuppliers.rows.forEach(s => {
            console.log(`   ${s.id}. ${s.name}`);
            console.log(`      Lead Time: ${s.lead_time_days} days`);
            console.log(`      Phone: ${s.phone || 'Not set'}`);
            console.log(`      Email: ${s.email || 'Not set'}`);
            console.log(`      Status: ${s.status}`);
            console.log('');
        });

        await pool.end();
    } catch (err) {
        console.error('❌ Error:', err.message);
        await pool.end();
    }
}

setupSuppliers().catch(console.error);