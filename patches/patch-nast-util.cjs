/**
 * Patch nast-util-from-notionapi to handle Notion's updated API response
 * format where recordMap entries have an extra nesting level:
 *
 * Old: recordMap.collection["id"] = { value: { schema, ... }, role: "reader" }
 * New: recordMap.collection["id"] = { spaceId: "...", value: { value: { schema, ... }, role: "reader" } }
 *
 * And getRecordValues results entries:
 * Old: results[i] = { value: { ... }, role: "reader" }
 * New: results[i] = { value: { value: { ... }, role: "reader" }, ... }
 */

const fs = require('fs')
const path = require('path')

const filePath = path.join(
  __dirname,
  '..',
  'node_modules',
  'nast-util-from-notionapi',
  'dist',
  'index.js'
)

let code = fs.readFileSync(filePath, 'utf-8')

// Check if already patched
if (code.includes('/** PATCHED: unwrap nested value */')) {
  console.log('nast-util-from-notionapi is already patched.')
  process.exit(0)
}

// Helper function to add at the top of the file
const helperFn = `
/** PATCHED: unwrap nested value */
function unwrapValue(record) {
  if (!record || !record.value) return record;
  // Detect double-nesting: record.value.value exists and record.value.role exists too
  if (record.value.value !== undefined && typeof record.value === 'object' && 'role' in record.value) {
    return { value: record.value.value, role: record.value.role };
  }
  return record;
}
function unwrapRecordMapEntries(recordMap) {
  if (!recordMap) return recordMap;
  for (const table of Object.keys(recordMap)) {
    const entries = recordMap[table];
    if (entries && typeof entries === 'object') {
      for (const id of Object.keys(entries)) {
        const entry = entries[id];
        // Detect: entry.value is an object with .value and .role (double nested)
        if (entry && entry.value && typeof entry.value === 'object' && 'value' in entry.value && 'role' in entry.value) {
          entries[id] = { value: entry.value.value, role: entry.value.role };
        }
      }
    }
  }
  return recordMap;
}
`

// 1. Insert helper functions after the first 'use strict' or at the beginning
const insertPoint = code.indexOf("'use strict';")
if (insertPoint !== -1) {
  code =
    code.slice(0, insertPoint + "'use strict';".length) +
    '\n' +
    helperFn +
    code.slice(insertPoint + "'use strict';".length)
} else {
  code = helperFn + '\n' + code
}

// 2. Patch the queryCollection result - unwrap recordMap.collection entries
// Original: Object.values(queryResult.recordMap.collection)[0].value
code = code.replace(
  /const collection = queryResult\.recordMap\.collection && Object\.values\(queryResult\.recordMap\.collection\)\[0\]\.value;/g,
  `unwrapRecordMapEntries(queryResult.recordMap);
    const collection = queryResult.recordMap.collection && Object.values(queryResult.recordMap.collection)[0].value;`
)

// 3. Patch getCollectionViews - unwrap results from getRecordValues
// Original: collectionViews.push(record.value);
code = code.replace(
  /return results\.reduce\(\(collectionViews, record\) => \{\s*if \(record\.role !== "none"\)\s*collectionViews\.push\(record\.value\);/,
  `return results.reduce((collectionViews, record) => {
        record = unwrapValue(record);
        if (record.role !== "none")
            collectionViews.push(record.value);`
)

// 4. Patch getPageBlocks - unwrap results from getRecordValues
// Original: pageBlocks.push(record.value);
code = code.replace(
  /return results\.reduce\(\(pageBlocks, record\) => \{\s*if \(record\.role !== "none"\)\s*pageBlocks\.push\(record\.value\);/,
  `return results.reduce((pageBlocks, record) => {
        record = unwrapValue(record);
        if (record.role !== "none")
            pageBlocks.push(record.value);`
)

// 5. Patch getAllBlocksInOnePage - unwrap record from getRecordValues
code = code.replace(
  /const record = response\.results\[0\];\s*if \(record\.role === "none"\) \{/,
  `let record = unwrapValue(response.results[0]);
    if (record.role === "none") {`
)

// 6. Patch getChildrenBlocks - unwrap results from getRecordValues
code = code.replace(
  /const validBlocks = childrenRecords\s*\.reduce\(\(blocks, record, index\) => \{\s*if \(record\.role !== "none"\)\s*blocks\.push\(record\.value\);/,
  `const validBlocks = childrenRecords
        .reduce((blocks, record, index) => {
        record = unwrapValue(record);
        if (record.role !== "none")
            blocks.push(record.value);`
)

// 7. Patch transformPageOrAlias - unwrap record from getRecordValues
code = code.replace(
  /const page = resp\.results\[0\]\.value;/,
  `const page = unwrapValue(resp.results[0]).value;`
)

// 8. Patch getUser - unwrap record
code = code.replace(
  /if \(resp\.results\[0\]\.role === "none"\) \{/,
  `resp.results[0] = unwrapValue(resp.results[0]);
        if (resp.results[0].role === "none") {`
)

fs.writeFileSync(filePath, code, 'utf-8')
console.log(
  'Successfully patched nast-util-from-notionapi for new Notion API format.'
)
