// Quick test of core functions
import { readExcelFileSample } from './excelFunctions.js';
import { combineName } from './nameParser.js';
import { consolidateAddressFields } from './addressParser.js';
import { STANDARD_COLUMNS } from './constants.js';

console.log('🧪 Testing Core Functions\n');

// Test 1: Standard columns
console.log('1️⃣ Testing standard columns (10 columns):');
console.log('   ' + STANDARD_COLUMNS.join(', '));
console.log(`   ✅ ${STANDARD_COLUMNS.length} columns defined\n`);

// Test 2: Name combination
console.log('2️⃣ Testing name combination:');
const combinedName = combineName('John', 'Smith', 'Michael');
console.log(`   Input: firstName="John", lastName="Smith", middleName="Michael"`);
console.log(`   Output: "${combinedName}"`);
console.log(`   ✅ ${combinedName === 'John Michael Smith' ? 'PASS' : 'FAIL'}\n`);

// Test 3: Address consolidation
console.log('3️⃣ Testing address consolidation:');
const consolidatedAddr = consolidateAddressFields(
  '123 Main St',
  'Apt 4',
  'New York',
  'NY',
  '10001',
  'USA'
);
console.log(`   Input: street="123 Main St", apt="Apt 4", city="New York", state="NY", postal="10001", country="USA"`);
console.log(`   Output: "${consolidatedAddr}"`);
console.log(`   ✅ ${consolidatedAddr.includes('123 Main St') && consolidatedAddr.includes('NY 10001') ? 'PASS' : 'FAIL'}\n`);

// Test 4: Read Excel file sample
console.log('4️⃣ Testing Excel file reading:');
try {
  const result = await readExcelFileSample({
    directory: './upload',
    fileName: 'new test file.xlsx',
    sampleSize: 3
  });

  if (result.success) {
    console.log(`   ✅ File read successfully`);
    console.log(`   📊 Total rows: ${result.totalRows}`);
    console.log(`   📋 Columns (${result.headers.length}): ${result.headers.join(', ')}`);
    console.log(`   📄 Sample rows: ${result.sampleRows.length}`);

    if (result.columnAnalysis && result.columnAnalysis.length > 0) {
      console.log(`\n   Column Analysis:`);
      result.columnAnalysis.slice(0, 5).forEach(col => {
        console.log(`     - ${col.column}: ${col.dataType} (example: "${col.example}")`);
      });
    }
  } else {
    console.log(`   ❌ Error: ${result.error?.message}`);
  }
} catch (error) {
  console.log(`   ❌ Exception: ${error.message}`);
}

console.log('\n✨ Core functions test completed!');
