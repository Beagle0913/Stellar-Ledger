/**
 * Verify the packaged portable exe: native .node present, SQLite loads under Electron
 * (--sqlite-probe uses production module resolution), then GUI smoke launch.
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const unpacked = join(root, 'release', 'win-unpacked')
const exe = join(unpacked, 'GalacticEconomy.exe')
const nativeBinary = join(
  unpacked,
  'resources',
  'app.asar.unpacked',
  'node_modules',
  'better-sqlite3',
  'build',
  'Release',
  'better_sqlite3.node'
)

const SMOKE_MS = 6_000

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function killProcessTree(child) {
  if (!child?.pid) return
  if (process.platform === 'win32') {
    spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
  } else {
    child.kill('SIGTERM')
  }
}

if (!existsSync(exe)) {
  console.error(`Packaged exe not found:\n  ${exe}`)
  process.exit(1)
}

if (!existsSync(nativeBinary)) {
  console.error(`Packaged better_sqlite3.node not found:\n  ${nativeBinary}`)
  console.error('electron-builder should unpack better-sqlite3; rebuild and dist again.')
  process.exit(1)
}

console.log('[verify] Running --sqlite-probe (packaged better-sqlite3 under Electron)…')
const probe = spawnSync(exe, ['--sqlite-probe'], {
  cwd: unpacked,
  encoding: 'utf8',
  timeout: 30_000,
  windowsHide: true
})

if (probe.error) {
  console.error(`SQLite probe failed: ${probe.error.message}`)
  process.exit(1)
}

const probeOut = `${probe.stdout ?? ''}${probe.stderr ?? ''}`.trim()
if (probe.status !== 0) {
  console.error(probeOut)
  console.error(
    '\nPackaged better-sqlite3 failed to load under Electron (NODE_MODULE_VERSION mismatch?).\n' +
      'Close GalacticEconomy.exe and run Build Game.bat again.\n'
  )
  process.exit(1)
}

console.log(`[verify] ${probeOut || 'SQLite probe OK'}`)

console.log('[verify] GUI smoke launch…')
let output = ''
let exitCode = null
let spawnError = null

const child = spawn(exe, [], {
  cwd: unpacked,
  windowsHide: true
})

child.stdout?.on('data', (chunk) => {
  output += chunk.toString()
})
child.stderr?.on('data', (chunk) => {
  output += chunk.toString()
})
child.on('exit', (code) => {
  exitCode = code
})
child.on('error', (err) => {
  spawnError = err
})

await sleep(SMOKE_MS)

const abiMismatch = /NODE_MODULE_VERSION|was compiled against a different Node\.js version/i.test(output)

if (spawnError) {
  console.error(`Packaged exe smoke test failed: ${spawnError.message}`)
  process.exit(1)
}

if (abiMismatch) {
  killProcessTree(child)
  console.error(output.trim())
  console.error(
    '\nThe packaged exe would crash with a NODE_MODULE_VERSION mismatch.\n' +
      'Close GalacticEconomy.exe and run Build Game.bat again.\n'
  )
  process.exit(1)
}

if (exitCode !== null && exitCode !== 0) {
  console.error(output.trim())
  console.error(`\nPackaged exe exited early with code ${exitCode}.`)
  process.exit(1)
}

killProcessTree(child)
console.log('Packaged native check passed (SQLite probe + exe smoke).')
