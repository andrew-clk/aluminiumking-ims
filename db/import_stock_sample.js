import XLSX from 'xlsx';
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function importStockSample() {
    // Read the Excel file
    const workbook = XLSX.readFile('STOCK SAMPLE.xls');
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Read with proper column mapping - the actual structure is:
    // Col 0: Supplier | Col 1: Description | Col 2-3: (empty) | Col 4: Colour | Col 5: Unit | Col 6: Quantity
    const data = XLSX.utils.sheet_to_json(worksheet, {
        header: ['supplier', 'description', 'empty1', 'empty2', 'colour', 'unit', 'quantity'],
        range: 2 // Skip first two rows (title and header)
    });

    console.log('Excel file loaded. Found', data.length, 'rows');
    console.log('\nFirst few rows for analysis:');
    console.log(data.slice(0, 5));

    // Analyze the structure
    console.log('\n=== ANALYZING DATA STRUCTURE ===');
    if (data.length > 0) {
        console.log('Columns found:', Object.keys(data[0]));

        // Group by product description to identify variants
        const productGroups = {};
        data.forEach(row => {
            const productName = row.description || '';
            const color = row.colour || '';
            const supplier = row.supplier || '';
            const quantity = parseInt(row.quantity) || 0;

            // Skip invalid rows
            if (!productName || productName === 'DESCRIPTION' || !supplier || supplier === 'SUPPLIER') {
                return;
            }

            // Determine category based on supplier
            let category = 'Aluminium Products';
            if (supplier.toLowerCase().includes('glass') || supplier.toLowerCase().includes('tempered')) {
                category = 'Glass Products';
            }

            // For products with same name but different colors, treat as variants
            // Extract base product name (without color info if it's in the description)
            const baseProductName = productName;

            if (!productGroups[baseProductName]) {
                productGroups[baseProductName] = {
                    name: baseProductName,
                    variants: [],
                    supplier: supplier,
                    category: category,
                    unit: row.unit || 'PC'
                };
            }

            // Add variant (color determines the variant)
            const variantName = color || 'Default';
            productGroups[baseProductName].variants.push({
                color: variantName,
                quantity: quantity
            });
        });

        console.log('\n=== PRODUCT SUMMARY ===');
        console.log('Unique products found:', Object.keys(productGroups).length);
        console.log('Total variants:', data.length);

        // Show some examples
        console.log('\n=== SAMPLE PRODUCTS WITH VARIANTS ===');
        let sampleCount = 0;
        for (const [productName, productData] of Object.entries(productGroups)) {
            if (productData.variants.length > 1 && sampleCount < 3) {
                console.log(`\nProduct: ${productName}`);
                console.log(`Supplier: ${productData.supplier}`);
                console.log(`Variants (${productData.variants.length}):`);
                productData.variants.forEach(v => {
                    console.log(`  - Color: ${v.color}, Stock Code: ${v.stockCode}, Qty: ${v.quantity}, Price: ${v.price}`);
                });
                sampleCount++;
            }
        }

        // Import to database
        console.log('\n=== IMPORTING TO DATABASE ===');

        const pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        try {
            // First, create product_variants table if it doesn't exist
            await pool.query(`
                CREATE TABLE IF NOT EXISTS product_variants (
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
            console.log('Product variants table ready');

            // Import data
            let importedProducts = 0;
            let importedVariants = 0;
            let skuCounter = 1000; // Start SKUs from 1000

            for (const [productName, productData] of Object.entries(productGroups)) {
                try {
                    // Generate a unique SKU for this product
                    const baseSku = `ALU${skuCounter++}`;

                    // Check if product already exists
                    const productResult = await pool.query(
                        'SELECT sku FROM products WHERE name = $1',
                        [productName]
                    );

                    let sku;
                    if (productResult.rows.length > 0) {
                        // Product exists, use existing SKU
                        sku = productResult.rows[0].sku;
                        console.log(`Product "${productName}" already exists with SKU: ${sku}`);
                    } else {
                        // Calculate total quantity from all variants
                        const totalQuantity = productData.variants.reduce((sum, v) => sum + v.quantity, 0);

                        // Insert new product
                        const newProduct = await pool.query(
                            `INSERT INTO products (
                                sku, name, category, subcategory, uom,
                                current_stock, par_level, reorder_point,
                                supplier, status
                            )
                             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                             RETURNING sku`,
                            [
                                baseSku,
                                productName,
                                productData.category || 'Aluminium Products',
                                'Profiles', // Default subcategory
                                productData.unit || 'PC',
                                totalQuantity,
                                totalQuantity * 1.5, // Par level = 150% of current stock
                                totalQuantity * 0.3, // Reorder point = 30% of current stock
                                productData.supplier || 'Various',
                                'active'
                            ]
                        );
                        sku = newProduct.rows[0].sku;
                        importedProducts++;
                        console.log(`Created product "${productName}" with SKU: ${sku}`);
                    }

                    // Insert variants
                    for (const variant of productData.variants) {
                        try {
                            await pool.query(
                                `INSERT INTO product_variants (sku, variant_name, color, quantity)
                                 VALUES ($1, $2, $3, $4)
                                 ON CONFLICT (sku, variant_name)
                                 DO UPDATE SET
                                    color = EXCLUDED.color,
                                    quantity = EXCLUDED.quantity,
                                    updated_at = CURRENT_TIMESTAMP`,
                                [
                                    sku,
                                    variant.color || 'Default',
                                    variant.color,
                                    variant.quantity
                                ]
                            );
                            importedVariants++;
                        } catch (variantErr) {
                            console.error('Error inserting variant:', variantErr.message);
                        }
                    }
                } catch (productErr) {
                    console.error('Error processing product:', productName, productErr.message);
                }
            }

        console.log('\n=== IMPORT COMPLETE ===');
        console.log('Products imported:', importedProducts);
        console.log('Variants imported:', importedVariants);

            // Display some imported data
            const sampleData = await pool.query(`
                SELECT p.name, p.sku, pv.variant_name, pv.color, pv.quantity
                FROM products p
                JOIN product_variants pv ON p.sku = pv.sku
                LIMIT 10
            `);

            if (sampleData.rows.length > 0) {
                console.log('\n=== SAMPLE IMPORTED DATA ===');
                sampleData.rows.forEach(row => {
                    console.log(`${row.name} (${row.sku}) - ${row.variant_name}: ${row.quantity} units`);
                });
            }

            await pool.end();
        } catch (err) {
            console.error('Database error:', err);
            await pool.end();
        }
    }
}

// Run the import
importStockSample().catch(console.error);