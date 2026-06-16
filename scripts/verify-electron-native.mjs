/**
 * Verify better-sqlite3 loads under the Electron runtime (ABI check).
 * Used after rebuild:electron and before packaging.
 */
import { spawnSync } from 'node:child_process'
import { writeFileSync, unlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const electronPath = require('electron')
const probe = join(root, '.tmp-sqlite-probe.cjs')

writeFileSync(
  probe,
  `const { app } = require('electron');

app.whenReady().then(() => {
  try {
    const Database = require('better-sqlite3');
    const db = new Database(':memory:');
    db.close();
    console.log('OK', process.versions.modules);
    app.exit(0);
  } catch (err) {
    console.error('FAIL', err.message);
    app.exit(1);
  }
});
`
)

const result = spawnSync(electronPath, [probe], { cwd: root, encoding: 'utf8', timeout: 30_000 })
try {
  unlinkSync(probe)
} catch {
  /* ignore */
}

if (result.error) {
  console.error(`Native module check timed out: ${result.error.message}`)
  process.exit(1)
}

if (result.status !== 0) {
  console.error(result.stdout?.trim())
  console.error(result.stderr?.trim())
  console.error(
    '\nbetter-sqlite3 is not built for Electron. Close any running GalacticEconomy.exe, then run:\n  corepack pnpm run rebuild:electron'
  )
  process.exit(1)
}

const line = (result.stdout ?? '').trim()
console.log(`Native module check passed (${line}).`)
