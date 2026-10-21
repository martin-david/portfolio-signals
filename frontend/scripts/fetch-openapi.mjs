// Downloads the published OpenAPI document of the backend into openapi/v1.json.
//
//   npm run api:fetch                       # http://localhost:5196
//   npm run api:fetch -- --url https://host # another backend
//
// The backend serves the document without authentication. It does not need Cosmos DB to do so: start the API with
// Cosmos__CreateIfNotExists=false (see backend/README.md) when the emulator is not running.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const urlFlag = args.indexOf('--url');
const baseUrl = (
  urlFlag >= 0 ? args[urlFlag + 1] : (process.env.OPENAPI_BASE_URL ?? 'http://localhost:5196')
).replace(/\/+$/, '');
const target = resolve(root, 'openapi', 'v1.json');

let document;
try {
  const response = await fetch(`${baseUrl}/openapi/v1.json`, {
    headers: { accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  document = await response.json();
} catch (error) {
  console.error(`Could not download ${baseUrl}/openapi/v1.json (${error.message}).`);
  console.error('Start the backend API first, or pass --url <base url>.');
  process.exit(1);
}

if (typeof document?.openapi !== 'string' || typeof document?.paths !== 'object') {
  console.error('The response is not an OpenAPI document.');
  process.exit(1);
}

await mkdir(dirname(target), { recursive: true });
await writeFile(target, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
console.log(
  `Wrote ${target} (OpenAPI ${document.openapi}, ${Object.keys(document.paths).length} paths).`,
);
console.log('Next: npm run api:generate');
