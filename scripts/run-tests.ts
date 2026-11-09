/**
 * Runs every offline fixture script (scripts/*-fixtures.ts) and fails if any
 * of them fails. Scripts that need the network (smoke-test, *-live-check) are
 * not included. Run: npm test
 */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = __dirname;
const files = readdirSync(dir)
  .filter((f) => f.endsWith('-fixtures.ts'))
  .sort();

const failures: string[] = [];
for (const file of files) {
  console.log(`\n=== ${file} ===`);
  const r = spawnSync(process.execPath, ['--import', 'tsx', join(dir, file)], { stdio: 'inherit' });
  if (r.status !== 0) failures.push(file);
}

console.log(`\n${files.length - failures.length}/${files.length} fixture suites passed.`);
if (failures.length > 0) {
  console.log(`Failed: ${failures.join(', ')}`);
  process.exit(1);
}
