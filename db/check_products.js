import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

async function checkProducts() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('Connecting to database...');

        // Check if product_variants table exists
        const tableCheck = await pool.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_name = 'product_variants'
        `);

        console.log('\n=== TABLE CHECK ===');
        if (tableCheck.rows.length > 0) {
            console.log('✅ product_variants table exists');

            // Count variants
            const variantCount = await pool.query('SELECT COUNT(*) FROM product_variants');
            console.log(`Variants in table: ${variantCount.rows[0].count}`);
        } else {
            console.log('❌ product_variants table does not exist');
        }

        // Check current products
        const productCount = await pool.query('SELECT COUNT(*) FROM products');
        console.log(`\n=== CURRENT PRODUCTS ===`);
        console.log(`Total products in database: ${productCount.rows[0].count}`);

        // List first 10 products
        const products = await pool.query(`
            SELECT sku, name, category, supplier, current_stock
            FROM products
            ORDER BY id
            LIMIT 10
        `);

        if (products.rows.length > 0) {
            console.log('\nFirst 10 products:');
            products.rows.forEach(p => {
                console.log(`- ${p.sku}: ${p.name} (${p.category}) - Stock: ${p.current_stock}`);
            });
        }

        // Check for products from Stock Sample (they would have SKUs starting with ALU)
        const aluProducts = await pool.query(`
            SELECT COUNT(*) as count
            FROM products
            WHERE sku LIKE 'ALU%'
        `);

        console.log(`\n=== IMPORTED PRODUCTS CHECK ===`);
        console.log(`Products with ALU SKUs: ${aluProducts.rows[0].count}`);

        if (aluProducts.rows[0].count > 0) {
            const aluList = await pool.query(`
                SELECT sku, name, supplier, current_stock
                FROM products
                WHERE sku LIKE 'ALU%'
                LIMIT 5
            `);
            console.log('\nSample ALU products:');
            aluList.rows.forEach(p => {
                console.log(`- ${p.sku}: ${p.name} from ${p.supplier} - Stock: ${p.current_stock}`);
            });
        }

        await pool.end();
    } catch (err) {
        console.error('Database error:', err.message);
        await pool.end();
    }
}

checkProducts().catch(console.error);