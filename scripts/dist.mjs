/**
 * Production packaging pipeline:
 *  1) Stop running game (file locks on Windows)
 *  2) Rebuild better-sqlite3 for Electron (ABI must match before packaging)
 *  3) electron-vite build + electron-builder
 *  4) Smoke-test the packaged exe (catches missing .node / ABI mismatch)
 *  5) Restore better-sqlite3 for Node so `npm test` still works after dist
 *
 * Dev/play from source still uses rebuild-electron-native.mjs via `npm run play` / `dev`.
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stopRunningGame } from './stop-running-game.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function localBin(name) {
  const ext = process.platform === 'win32' ? '.cmd' : ''
  return join(root, 'node_modules', '.bin', `${name}${ext}`)
}

function run(cmd, args, label) {
  if (label) console.log(`\n[dist] ${label}`)
  const r = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

function runBin(name, args, label) {
  const bin = localBin(name)
  if (!existsSync(bin)) {
    console.error(`Missing ${bin}. Run npm install first.`)
    process.exit(1)
  }
  run(bin, args, label)
}

if (stopRunningGame()) {
  console.log('[dist] Closed a running StellarLedger.exe.')
}

run('node', ['scripts/rebuild-electron-native.mjs'], 'Rebuilding better-sqlite3 for Electron…')

runBin('electron-vite', ['build'], 'Building main / preload / renderer…')
runBin('electron-builder', [], 'Packaging portable exe…')

run('node', ['scripts/verify-packaged-native.mjs'], 'Verifying packaged better-sqlite3 under Electron…')

const portable = join(root, 'release', 'StellarLedger.exe')
if (!existsSync(portable)) {
  console.error('\n[dist] Build finished but release/StellarLedger.exe was not created.')
  process.exit(1)
}

console.log('\n[dist] Restoring better-sqlite3 for Node (vitest)…')
run('npm', ['rebuild', 'better-sqlite3'])

console.log('\n[dist] Done → release/StellarLedger.exe')
console.log('[dist] Play with Play.bat or double-click the exe.\n')
