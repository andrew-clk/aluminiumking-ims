import XLSX from 'xlsx';

// Read the Excel file
const workbook = XLSX.readFile('STOCK SAMPLE.xls');
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

// First, let's see the raw data structure
console.log('=== RAW WORKSHEET DATA ===');
const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
console.log('First 10 rows (raw):');
rawData.slice(0, 10).forEach((row, i) => {
    console.log(`Row ${i}: [${row.map(cell => cell || '(empty)').join(' | ')}]`);
});

// Read with proper column mapping - the actual structure is:
// Col 0: Supplier | Col 1: Description | Col 2-3: (empty) | Col 4: Colour | Col 5: Unit | Col 6: Quantity
const data = XLSX.utils.sheet_to_json(worksheet, {
    header: ['supplier', 'description', 'empty1', 'empty2', 'colour', 'unit', 'quantity'],
    range: 2 // Skip first two rows (title and header)
});

console.log('Excel file loaded. Found', data.length, 'rows');
console.log('\nFirst 10 rows:');
data.slice(0, 10).forEach((row, i) => {
    console.log(`${i+1}. Supplier: ${row.supplier}, Desc: ${row.description}, Color: ${row.colour}, Unit: ${row.unit}, Qty: ${row.quantity}`);
});

// Group by product description
const productGroups = {};
data.forEach(row => {
    const productName = row.description || '';
    const color = row.colour || '';
    const supplier = row.supplier || '';

    if (!productName || productName === 'DESCRIPTION') return; // Skip empty rows or header

    if (!productGroups[productName]) {
        productGroups[productName] = {
            name: productName,
            variants: [],
            supplier: supplier,
            unit: row.unit || 'PC'
        };
    }

    // Check if this is actually a different variant (same product, different color)
    const existingVariant = productGroups[productName].variants.find(v => v.color === color);
    if (!existingVariant) {
        productGroups[productName].variants.push({
            color: color || 'Default',
            quantity: parseInt(row.quantity) || 0
        });
    }
});

console.log('\n=== GROUPED PRODUCTS ===');
Object.entries(productGroups).slice(0, 5).forEach(([name, data]) => {
    console.log(`\nProduct: ${name}`);
    console.log(`  Supplier: ${data.supplier}`);
    console.log(`  Unit: ${data.unit}`);
    console.log(`  Variants:`);
    data.variants.forEach(v => {
        console.log(`    - Color: ${v.color}, Qty: ${v.quantity}`);
    });
});