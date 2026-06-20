/**
 * Rebuild better-sqlite3 for Electron and verify the ABI.
 * If rebuild fails (e.g. exe still running), verify the existing binary instead.
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function electronRebuildCmd() {
  const localBin = join(
    root,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'electron-rebuild.cmd' : 'electron-rebuild'
  )
  return existsSync(localBin) ? localBin : 'electron-rebuild'
}

function run(cmd, args) {
  return spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' })
}

const rebuild = run(electronRebuildCmd(), ['-f', '-w', 'better-sqlite3'])
if (rebuild.status !== 0) {
  console.warn(
    '\n[rebuild] electron-rebuild failed — if StellarLedger.exe is open, close it and rebuild.\n' +
      '[rebuild] Checking whether the existing native module already matches Electron...\n'
  )
}

const verify = run('node', ['scripts/verify-electron-native.mjs'])
process.exit(verify.status ?? 1)
