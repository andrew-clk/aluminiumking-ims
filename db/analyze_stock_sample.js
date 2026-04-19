import XLSX from 'xlsx';

// Read the Excel file
const workbook = XLSX.readFile('STOCK SAMPLE.xls');
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

// Read with proper column mapping
const data = XLSX.utils.sheet_to_json(worksheet, {
    header: ['supplier', 'description', 'empty1', 'empty2', 'colour', 'unit', 'quantity'],
    range: 2 // Skip first two rows (title and header)
});

console.log('Excel file loaded. Found', data.length, 'rows\n');

// Group by product description to identify variants
const productGroups = {};
let totalQuantity = 0;

data.forEach(row => {
    const productName = row.description || '';
    const color = row.colour || '';
    const supplier = row.supplier || '';
    const quantity = parseInt(row.quantity) || 0;

    // Skip invalid rows
    if (!productName || productName === 'DESCRIPTION' || !supplier || supplier === 'SUPPLIER') {
        return;
    }

    totalQuantity += quantity;

    // Determine category based on supplier
    let category = 'Aluminium Products';
    if (supplier.toLowerCase().includes('glass') || supplier.toLowerCase().includes('tempered')) {
        category = 'Glass Products';
    } else if (supplier.toLowerCase().includes('msg')) {
        category = 'PVC Products';
    }

    if (!productGroups[productName]) {
        productGroups[productName] = {
            name: productName,
            variants: [],
            supplier: supplier,
            category: category,
            unit: row.unit || 'PC'
        };
    }

    // Add variant
    const variantName = color || 'Default';
    productGroups[productName].variants.push({
        color: variantName,
        quantity: quantity
    });
});

console.log('=== IMPORT SUMMARY ===');
console.log(`Total unique products: ${Object.keys(productGroups).length}`);
console.log(`Total stock quantity: ${totalQuantity} units\n`);

console.log('=== PRODUCTS TO BE IMPORTED ===\n');
let productCounter = 1;

Object.entries(productGroups).forEach(([name, data]) => {
    const totalProductQty = data.variants.reduce((sum, v) => sum + v.quantity, 0);
    console.log(`${productCounter}. ${name}`);
    console.log(`   SKU: ALU${1000 + productCounter - 1}`);
    console.log(`   Supplier: ${data.supplier}`);
    console.log(`   Category: ${data.category}`);
    console.log(`   Unit: ${data.unit}`);
    console.log(`   Total Quantity: ${totalProductQty}`);

    if (data.variants.length > 1) {
        console.log(`   Variants (${data.variants.length}):`);
        data.variants.forEach(v => {
            console.log(`     - ${v.color}: ${v.quantity} units`);
        });
    } else if (data.variants[0].color !== 'Default') {
        console.log(`   Color: ${data.variants[0].color}`);
    }
    console.log('');
    productCounter++;
});

// Summary by category
const categoryTotals = {};
Object.values(productGroups).forEach(product => {
    if (!categoryTotals[product.category]) {
        categoryTotals[product.category] = { count: 0, quantity: 0 };
    }
    categoryTotals[product.category].count++;
    product.variants.forEach(v => {
        categoryTotals[product.category].quantity += v.quantity;
    });
});

console.log('=== SUMMARY BY CATEGORY ===');
Object.entries(categoryTotals).forEach(([category, totals]) => {
    console.log(`${category}: ${totals.count} products, ${totals.quantity} units`);
});