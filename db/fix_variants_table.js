import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

async function fixVariantsTable() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('Fixing product_variants table...');

        // Drop the old table if it exists
        await pool.query('DROP TABLE IF EXISTS product_variants CASCADE');
        console.log('Dropped old product_variants table');

        // Create the correct table structure
        await pool.query(`
            CREATE TABLE product_variants (
                id SERIAL PRIMARY KEY,
                sku VARCHAR(50) REFERENCES products(sku) ON DELETE CASCADE,
                variant_name VARCHAR(255) NOT NULL,
                color VARCHAR(100),
                quantity INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(sku, variant_name)
            )
        `);
        console.log('Created new product_variants table with correct schema');

        // Now add variants for products that need them
        const products = await pool.query(`
            SELECT sku, name, supplier, current_stock
            FROM products
            WHERE sku LIKE 'ALU%'
            ORDER BY sku
        `);

        console.log(`\nFound ${products.rows.length} imported products`);

        // Import variants based on the Excel data
        // For most products, we'll create a single variant with the color info from the Excel
        const variantsToAdd = [
            { sku: 'ALU1000', color: 'MF', quantity: 35 },
            { sku: 'ALU1001', color: 'MF', quantity: 20 },
            { sku: 'ALU1002', color: 'P.C BLACK', quantity: 19 },
            { sku: 'ALU1003', color: 'MF', quantity: 48 },
            { sku: 'ALU1004', color: 'P.C WHITE', quantity: 76 },
            { sku: 'ALU1005', color: 'P.C GREY', quantity: 32 },
            { sku: 'ALU1011', color: 'BLACK', quantity: 10 },
            { sku: 'ALU1012', color: 'BLACK', quantity: 5 },
            { sku: 'ALU1012', color: 'WHITE', quantity: 7 },
            { sku: 'ALU1013', color: 'WHITE', quantity: 1 },
            { sku: 'ALU1014', color: 'BLACK', quantity: 3 },
            { sku: 'ALU1015', color: 'BLACK', quantity: 65 },
            { sku: 'ALU1016', color: 'BLACK', quantity: 70 },
            { sku: 'ALU1017', color: 'WHITE', quantity: 32 },
            { sku: 'ALU1018', color: 'WHITE', quantity: 25 },
            { sku: 'ALU1019', color: 'BLACK', quantity: 105 },
            { sku: 'ALU1020', color: 'WHITE', quantity: 87 },
            { sku: 'ALU1021', color: 'BLACK', quantity: 62 },
            { sku: 'ALU1022', color: 'BLACK', quantity: 72 }
        ];

        let variantsInserted = 0;
        for (const variant of variantsToAdd) {
            try {
                await pool.query(
                    `INSERT INTO product_variants (sku, variant_name, color, quantity)
                     VALUES ($1, $2, $3, $4)
                     ON CONFLICT (sku, variant_name) DO NOTHING`,
                    [variant.sku, variant.color, variant.color, variant.quantity]
                );
                variantsInserted++;
            } catch (err) {
                // SKU might not exist, skip
            }
        }

        console.log(`Inserted ${variantsInserted} variants`);

        // Check the results
        const variantCount = await pool.query('SELECT COUNT(*) FROM product_variants');
        console.log(`Total variants in table: ${variantCount.rows[0].count}`);

        // Show sample data
        const sampleVariants = await pool.query(`
            SELECT p.name, pv.variant_name, pv.color, pv.quantity
            FROM products p
            JOIN product_variants pv ON p.sku = pv.sku
            LIMIT 5
        `);

        if (sampleVariants.rows.length > 0) {
            console.log('\nSample product variants:');
            sampleVariants.rows.forEach(row => {
                console.log(`- ${row.name}: ${row.color} variant with ${row.quantity} units`);
            });
        }

        await pool.end();
    } catch (err) {
        console.error('Error:', err.message);
        await pool.end();
    }
}

fixVariantsTable().catch(console.error);