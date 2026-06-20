/**
 * Verify the packaged portable exe: native .node present, SQLite loads under Electron
 * (--sqlite-probe uses production module resolution), then GUI smoke launch.
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const releaseDir = join(root, 'release')
const failureLog = join(releaseDir, 'verify-smoke-failure.log')

function writeFailureLog(title, body) {
  try {
    mkdirSync(releaseDir, { recursive: true })
    writeFileSync(
      failureLog,
      `${title}\n${'='.repeat(title.length)}\n\n${body}\n`,
      'utf8'
    )
    console.error(`[verify] Failure details written to ${failureLog}`)
  } catch {
    /* best effort */
  }
}

function fail(title, body) {
  writeFailureLog(title, body)
  console.error(body)
  process.exit(1)
}
const unpacked = join(root, 'release', 'win-unpacked')
const exe = join(unpacked, 'StellarLedger.exe')
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
  fail('Packaged exe missing', `Packaged exe not found:\n  ${exe}`)
}

if (!existsSync(nativeBinary)) {
  fail(
    'Packaged native binary missing',
    `Packaged better_sqlite3.node not found:\n  ${nativeBinary}\n` +
      'electron-builder should unpack better-sqlite3; rebuild and dist again.'
  )
}

console.log('[verify] Running --sqlite-probe (packaged better-sqlite3 under Electron)…')
const probe = spawnSync(exe, ['--sqlite-probe'], {
  cwd: unpacked,
  encoding: 'utf8',
  timeout: 30_000,
  windowsHide: true
})

if (probe.error) {
  fail('SQLite probe spawn error', `SQLite probe failed: ${probe.error.message}`)
}

const probeOut = `${probe.stdout ?? ''}${probe.stderr ?? ''}`.trim()
if (probe.status !== 0) {
  fail(
    'SQLite probe failed',
    `${probeOut}\n\nexit code: ${probe.status ?? 'unknown'}\n\n` +
      'Packaged better-sqlite3 failed to load under Electron (NODE_MODULE_VERSION mismatch?).\n' +
      'Close StellarLedger.exe and run Build Game.bat again.'
  )
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
  fail('GUI smoke spawn error', `Packaged exe smoke test failed: ${spawnError.message}`)
}

if (abiMismatch) {
  killProcessTree(child)
  fail(
    'GUI smoke ABI mismatch',
    `${output.trim()}\n\nThe packaged exe would crash with a NODE_MODULE_VERSION mismatch.\n` +
      'Close StellarLedger.exe and run Build Game.bat again.'
  )
}

if (exitCode !== null && exitCode !== 0) {
  fail(
    'GUI smoke early exit',
    `${output.trim()}\n\nPackaged exe exited early with code ${exitCode}.`
  )
}

killProcessTree(child)
console.log('Packaged native check passed (SQLite probe + exe smoke).')
