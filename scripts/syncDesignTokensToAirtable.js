const fs = require('fs');
const path = require('path');
const Airtable = require('airtable');

const API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = process.env.AIRTABLE_BASE_ID;
const TABLE_NAME = process.env.AIRTABLE_TABLE_NAME;
const TOKENS_DIR = path.join(__dirname, '../tokens');

if (!API_KEY || !BASE_ID || !TABLE_NAME) {
  console.error('Missing one or more required environment variables: AIRTABLE_API_KEY, AIRTABLE_BASE_ID, AIRTABLE_TABLE_NAME');
  process.exit(1);
}

const base = new Airtable({ apiKey: API_KEY }).base(BASE_ID);
const table = base(TABLE_NAME);

function flattenTokens(obj, prefix = '') {
  const flattened = [];
  for (const [key, value] of Object.entries(obj)) {
    const currentPath = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && value.value !== undefined) {
      flattened.push({ name: currentPath, ...value });
    } else if (value && typeof value === 'object') {
      flattened.push(...flattenTokens(value, currentPath));
    }
  }
  return flattened;
}

function resolveReference(themeTokens, ref) {
  if (typeof ref !== 'string') return ref;
  if (ref.startsWith('{') && ref.endsWith('}')) {
    let refPath = ref.slice(1, -1).split('.');
    if (refPath[0] === 'Light' || refPath[0] === 'Dark') refPath = refPath.slice(1);
    let valueObj = themeTokens;
    for (const part of refPath) {
      if (!valueObj || typeof valueObj !== 'object') return '';
      valueObj = valueObj[part];
    }
    if (!valueObj) return '';
    if (typeof valueObj === 'object' && valueObj.value) {
      return resolveReference(themeTokens, valueObj.value);
    }
    return valueObj;
  }
  return ref;
}

function extractReferenceKey(val) {
  if (typeof val === 'string' && val.startsWith('{') && val.endsWith('}')) {
    const ref = val.slice(1, -1).split('.');
    if (ref[0] === 'Light' || ref[0] === 'Dark') {
      return ref.slice(1).join('.');
    }
    return ref.join('.');
  }
  return null;
}

async function syncTokens() {
  // Load theme files
  const lightTokens = JSON.parse(fs.readFileSync(path.join(TOKENS_DIR, 'Modes', 'Light.json'), 'utf8'));
  const darkTokens = JSON.parse(fs.readFileSync(path.join(TOKENS_DIR, 'Modes', 'Dark.json'), 'utf8'));
  const coreTokens = JSON.parse(fs.readFileSync(path.join(TOKENS_DIR, 'Core.json'), 'utf8'));

  // Flatten only semantic tokens from Modes/Light.json
  const semanticTokens = flattenTokens(lightTokens);

  // Helper to resolve hex from Core.json
  function resolveHexFromCore(theme, refKey) {
    if (!refKey || typeof refKey !== 'string') return '';
    const pathArr = refKey.split('.');
    let valueObj = coreTokens[theme];
    for (const part of pathArr) {
      if (!valueObj || typeof valueObj !== 'object') return '';
      valueObj = valueObj[part];
    }
    if (valueObj && typeof valueObj === 'object' && valueObj.value && typeof valueObj.value === 'string' && valueObj.value.startsWith('#')) {
      return valueObj.value;
    }
    return '';
  }

  // Remove duplicates and empty tokens by Token name
  const seenNames = new Set();
  const cleanedTokens = semanticTokens.filter(token => {
    if (!token.name || seenNames.has(token.name)) return false;
    seenNames.add(token.name);
    return true;
  });

  const records = cleanedTokens.map(token => {
    const pathArr = token.name.split('.');
    // Component: special handling for icon-*, border-*, text-*, bg-*
    let component = pathArr[0];
    if (component.startsWith('icon-')) component = 'icon';
    else if (component.startsWith('border-')) component = 'border';
    else if (component.startsWith('text-')) component = 'text';
    else if (component.startsWith('bg-')) component = 'bg';
    else if (component.includes('-')) component = component.split('-')[0];
    // Light
    const lightRaw = token.value;
    const lightValueName = extractReferenceKey(lightRaw) || lightRaw;
    const lightHex = resolveHexFromCore('Light', lightValueName);
    // Dark
    let darkRaw = '';
    let darkValueName = '';
    let darkHex = '';
    let darkObj = darkTokens;
    for (const part of pathArr) {
      if (!darkObj || typeof darkObj !== 'object') break;
      darkObj = darkObj[part];
    }
    if (darkObj && typeof darkObj === 'object' && darkObj.value) {
      darkRaw = darkObj.value;
      darkValueName = extractReferenceKey(darkRaw) || darkRaw;
      darkHex = resolveHexFromCore('Dark', darkValueName);
    }
    return {
      fields: {
        'Token name': token.name,
        'Component': component,
        'Light value name': lightValueName,
        'Light value': lightHex || '',
        'Dark value name': darkValueName,
        'Dark value': darkHex || '',
        'Usage': token.type || ''
      }
    };
  }).filter(r => r.fields['Light value'] && r.fields['Dark value']);

  // Batch insert/update (Airtable API limit: 10 per request)
  for (let i = 0; i < records.length; i += 10) {
    const batch = records.slice(i, i + 10);
    try {
      await table.create(batch);
      console.log(`Created ${batch.length} records (batch ${Math.floor(i / 10) + 1})`);
    } catch (error) {
      console.error('Error creating records:', error);
      if (batch[0]) console.error('Sample record:', JSON.stringify(batch[0], null, 2));
      throw error;
    }
  }
  console.log('✅ Sync complete!');
}

async function deleteDuplicateTokens() {
  // Fetch all records from Airtable
  const allRecords = [];
  await table.select({}).eachPage((records, fetchNextPage) => {
    allRecords.push(...records);
    fetchNextPage();
  });
  // Find duplicates by Token name
  const seen = new Map();
  const toDelete = [];
  for (const rec of allRecords) {
    const name = rec.fields['Token name'];
    if (!name) continue;
    if (seen.has(name)) {
      toDelete.push(rec.id);
    } else {
      seen.set(name, rec.id);
    }
  }
  // Delete duplicates in batches of 10
  for (let i = 0; i < toDelete.length; i += 10) {
    const batch = toDelete.slice(i, i + 10);
    if (batch.length > 0) {
      await table.destroy(batch);
      console.log(`Deleted ${batch.length} duplicate records (batch ${Math.floor(i / 10) + 1})`);
    }
  }
  console.log('✅ Duplicate cleanup complete!');
}

if (require.main === module) {
  (async () => {
    await syncTokens();
    await deleteDuplicateTokens();
  })();
} 