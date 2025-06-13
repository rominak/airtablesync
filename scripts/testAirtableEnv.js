const Airtable = require('airtable');

const API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = process.env.AIRTABLE_BASE_ID;
const TABLE_NAME = process.env.AIRTABLE_TABLE_NAME;

if (!API_KEY || !BASE_ID || !TABLE_NAME) {
  console.error('Missing one or more required environment variables: AIRTABLE_API_KEY, AIRTABLE_BASE_ID, AIRTABLE_TABLE_NAME');
  process.exit(1);
}

const base = new Airtable({ apiKey: API_KEY }).base(BASE_ID);
const table = base(TABLE_NAME);

async function testWrite() {
  try {
    const testRecord = {
      fields: {
        'Token name': 'TEST_TOKEN',
        'Light value name': 'test-light',
        'Light value': '#FFFFFF',
        'Dark value name': 'test-dark',
        'Dark value': '#000000',
        'Usage': 'test-env'
      }
    };
    const result = await table.create([testRecord]);
    console.log('✅ SUCCESS: Test record inserted!');
    console.log('Record:', result[0].id);
  } catch (error) {
    console.error('❌ Error inserting test record:', error);
  }
}

testWrite(); 