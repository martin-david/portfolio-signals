// Generates src/api/schema.d.ts from openapi/v1.json with openapi-typescript.
//
//   npm run api:generate   # write the file
//   npm run api:check      # fail when the committed file is out of date (use in CI)
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import openapiTS, { astToString } from 'openapi-typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const spec = resolve(root, 'openapi', 'v1.json');
const target = resolve(root, 'src', 'api', 'schema.d.ts');
const check = process.argv.includes('--check');

const banner = `/**
 * Generated from openapi/v1.json by scripts/generate-api-types.mjs (openapi-typescript).
 * Do not edit by hand: refresh the spec with \`npm run api:fetch\`, then run \`npm run api:generate\`.
 */

`;

const ast = await openapiTS(pathToFileURL(spec), {
  rootTypes: true,
  rootTypesNoSchemaPrefix: true,
  exportType: true,
  silent: true,
});
const output = banner + astToString(ast);

if (check) {
  let current = '';
  try {
    current = (await readFile(target, 'utf8')).replace(/\r\n/g, '\n');
  } catch {
    // A missing file is reported as out of date below.
  }
  if (current !== output) {
    console.error(
      'src/api/schema.d.ts is out of date with openapi/v1.json. Run `npm run api:generate`.',
    );
    process.exit(1);
  }
  console.log('src/api/schema.d.ts matches openapi/v1.json.');
} else {
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, output, 'utf8');
  console.log(`Wrote ${target}`);
}
