import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

async function cleanupMockData() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('🧹 Starting database cleanup...\n');

        // First, let's see what we have
        const beforeStats = await pool.query(`
            SELECT
                (SELECT COUNT(*) FROM products) as total_products,
                (SELECT COUNT(*) FROM products WHERE sku LIKE 'ALU%') as stock_sample_products,
                (SELECT COUNT(*) FROM products WHERE sku NOT LIKE 'ALU%') as mock_products
        `);

        console.log('=== BEFORE CLEANUP ===');
        console.log(`Total products: ${beforeStats.rows[0].total_products}`);
        console.log(`Stock Sample products (ALU SKUs): ${beforeStats.rows[0].stock_sample_products}`);
        console.log(`Mock products to remove: ${beforeStats.rows[0].mock_products}\n`);

        // List mock products that will be deleted
        const mockProducts = await pool.query(`
            SELECT sku, name, category, supplier
            FROM products
            WHERE sku NOT LIKE 'ALU%'
            ORDER BY sku
        `);

        if (mockProducts.rows.length > 0) {
            console.log('Products to be removed:');
            mockProducts.rows.forEach(p => {
                console.log(`  - ${p.sku}: ${p.name} (${p.category}) - Supplier: ${p.supplier || 'N/A'}`);
            });
            console.log('');
        }

        // Delete related data first (due to foreign key constraints)
        console.log('Cleaning up related data...');

        // Delete job order materials for mock products
        const deletedJobMaterials = await pool.query(`
            DELETE FROM job_order_materials
            WHERE sku IN (SELECT sku FROM products WHERE sku NOT LIKE 'ALU%')
        `);
        console.log(`✅ Deleted ${deletedJobMaterials.rowCount} mock job order materials`);

        // Delete transactions for mock products
        const deletedTxns = await pool.query(`
            DELETE FROM transactions
            WHERE sku IN (SELECT sku FROM products WHERE sku NOT LIKE 'ALU%')
        `);
        console.log(`✅ Deleted ${deletedTxns.rowCount} mock transactions`);

        // Delete requisition items for mock products
        const deletedReqItems = await pool.query(`
            DELETE FROM requisition_items
            WHERE sku IN (SELECT sku FROM products WHERE sku NOT LIKE 'ALU%')
        `);
        console.log(`✅ Deleted ${deletedReqItems.rowCount} mock requisition items`);

        // Delete PO items for mock products
        const deletedPOItems = await pool.query(`
            DELETE FROM po_items
            WHERE sku IN (SELECT sku FROM products WHERE sku NOT LIKE 'ALU%')
        `);
        console.log(`✅ Deleted ${deletedPOItems.rowCount} mock PO items`);

        // Now delete the mock products
        const deletedProducts = await pool.query(`
            DELETE FROM products
            WHERE sku NOT LIKE 'ALU%'
        `);
        console.log(`✅ Deleted ${deletedProducts.rowCount} mock products\n`);

        // Clean up requisitions with no items
        const deletedReqs = await pool.query(`
            DELETE FROM requisitions
            WHERE id NOT IN (SELECT DISTINCT req_id FROM requisition_items)
        `);
        console.log(`✅ Deleted ${deletedReqs.rowCount} empty requisitions`);

        // Clean up purchase orders with no items
        const deletedPOs = await pool.query(`
            DELETE FROM purchase_orders
            WHERE id NOT IN (SELECT DISTINCT po_id FROM po_items)
        `);
        console.log(`✅ Deleted ${deletedPOs.rowCount} empty purchase orders\n`);

        // Now handle suppliers - we'll keep only suppliers from Stock Sample products
        console.log('=== CLEANING UP SUPPLIERS ===');

        // Get unique suppliers from Stock Sample products
        const validSuppliers = await pool.query(`
            SELECT DISTINCT supplier
            FROM products
            WHERE sku LIKE 'ALU%' AND supplier IS NOT NULL
            ORDER BY supplier
        `);

        console.log('Suppliers to keep (from Stock Sample):');
        validSuppliers.rows.forEach(s => {
            console.log(`  ✅ ${s.supplier}`);
        });

        // Check if there's a suppliers table (might not exist)
        const hasSupplierTable = await pool.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_name = 'suppliers'
        `);

        if (hasSupplierTable.rows.length > 0) {
            // If suppliers table exists, clean it up
            const deletedSuppliers = await pool.query(`
                DELETE FROM suppliers
                WHERE name NOT IN (
                    SELECT DISTINCT supplier
                    FROM products
                    WHERE supplier IS NOT NULL
                )
            `);
            console.log(`\n✅ Deleted ${deletedSuppliers.rowCount} irrelevant suppliers from suppliers table`);
        }

        // Final statistics
        const afterStats = await pool.query(`
            SELECT
                (SELECT COUNT(*) FROM products) as total_products,
                (SELECT COUNT(*) FROM product_variants) as total_variants,
                (SELECT COUNT(DISTINCT supplier) FROM products WHERE supplier IS NOT NULL) as total_suppliers,
                (SELECT COUNT(*) FROM purchase_orders) as total_pos,
                (SELECT COUNT(*) FROM requisitions) as total_reqs
        `);

        console.log('\n=== AFTER CLEANUP ===');
        console.log(`Total products: ${afterStats.rows[0].total_products}`);
        console.log(`Total variants: ${afterStats.rows[0].total_variants}`);
        console.log(`Total suppliers: ${afterStats.rows[0].total_suppliers}`);
        console.log(`Total POs: ${afterStats.rows[0].total_pos}`);
        console.log(`Total requisitions: ${afterStats.rows[0].total_reqs}`);

        // Show sample of remaining products
        const sampleProducts = await pool.query(`
            SELECT sku, name, supplier, current_stock
            FROM products
            ORDER BY sku
            LIMIT 5
        `);

        console.log('\n=== SAMPLE REMAINING PRODUCTS ===');
        sampleProducts.rows.forEach(p => {
            console.log(`${p.sku}: ${p.name} - ${p.supplier} (Stock: ${p.current_stock})`);
        });

        console.log('\n✨ Cleanup complete! Database now contains only Stock Sample data.');

        await pool.end();
    } catch (err) {
        console.error('❌ Error during cleanup:', err.message);
        await pool.end();
    }
}

cleanupMockData().catch(console.error);