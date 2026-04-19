import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

async function checkAllData() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('📊 Checking all data in database...\n');

        // Check products
        const products = await pool.query('SELECT COUNT(*) FROM products');
        console.log(`✅ Products: ${products.rows[0].count}`);

        // Check purchase orders
        const pos = await pool.query('SELECT COUNT(*) FROM purchase_orders');
        console.log(`📦 Purchase Orders: ${pos.rows[0].count}`);

        // Check PO items
        const poItems = await pool.query('SELECT COUNT(*) FROM po_items');
        console.log(`   - PO Items: ${poItems.rows[0].count}`);

        // Check requisitions
        const reqs = await pool.query('SELECT COUNT(*) FROM requisitions');
        console.log(`📋 Requisitions: ${reqs.rows[0].count}`);

        // Check requisition items
        const reqItems = await pool.query('SELECT COUNT(*) FROM requisition_items');
        console.log(`   - Requisition Items: ${reqItems.rows[0].count}`);

        // Check transactions
        const txns = await pool.query('SELECT COUNT(*) FROM transactions');
        console.log(`💱 Transactions: ${txns.rows[0].count}`);

        // Check job orders
        const jos = await pool.query('SELECT COUNT(*) FROM job_orders');
        console.log(`🔨 Job Orders: ${jos.rows[0].count}`);

        // Check job order materials
        const joMats = await pool.query('SELECT COUNT(*) FROM job_order_materials');
        console.log(`   - Job Order Materials: ${joMats.rows[0].count}`);

        console.log('\n=== SAMPLE DATA ===\n');

        // Sample products
        const sampleProducts = await pool.query('SELECT sku, name FROM products LIMIT 3');
        console.log('Sample Products:');
        sampleProducts.rows.forEach(p => console.log(`  - ${p.sku}: ${p.name}`));

        // Sample POs
        const samplePOs = await pool.query('SELECT po_number, supplier, status FROM purchase_orders LIMIT 3');
        console.log('\nSample Purchase Orders:');
        if (samplePOs.rows.length === 0) {
            console.log('  (No purchase orders found)');
        } else {
            samplePOs.rows.forEach(po => console.log(`  - ${po.po_number}: ${po.supplier} (${po.status})`));
        }

        // Sample Requisitions
        const sampleReqs = await pool.query('SELECT req_number, requested_by, status FROM requisitions LIMIT 3');
        console.log('\nSample Requisitions:');
        if (sampleReqs.rows.length === 0) {
            console.log('  (No requisitions found)');
        } else {
            sampleReqs.rows.forEach(req => console.log(`  - ${req.req_number}: ${req.requested_by} (${req.status})`));
        }

        await pool.end();
    } catch (err) {
        console.error('Database error:', err.message);
        await pool.end();
    }
}

checkAllData().catch(console.error);