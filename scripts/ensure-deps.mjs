/**
 * Install project dependencies when missing or lockfile changed.
 * Must be invoked with a working Node (Setup.bat bootstraps Node via ensure-node.ps1 first).
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isNodeVersionOk } from './ensure-node.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const STAMP = join(root, 'node_modules', '.deps-ok')
const PACKAGE_JSON = join(root, 'package.json')
const PNPM_LOCK = join(root, 'pnpm-lock.yaml')
const NPM_LOCK = join(root, 'package-lock.json')

function envWithNodeBin() {
  const nodeDir = dirname(process.execPath)
  const pathKey = process.platform === 'win32' ? 'Path' : 'PATH'
  const current = process.env[pathKey] ?? ''
  const prefix = current.toLowerCase().includes(nodeDir.toLowerCase())
    ? current
    : `${nodeDir}${process.platform === 'win32' ? ';' : ':'}${current}`
  return { ...process.env, [pathKey]: prefix }
}

const spawnEnv = envWithNodeBin()

function log(msg) {
  console.log(`[setup] ${msg}`)
}

function run(cmd, args, label) {
  if (label) log(label)
  const result = spawnSync(cmd, args, {
    cwd: root,
    stdio: 'inherit',
    shell: true,
    env: spawnEnv
  })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

function readPackageJson() {
  return JSON.parse(readFileSync(PACKAGE_JSON, 'utf8'))
}

function lockfilePath(mode) {
  if (mode === 'pnpm') return PNPM_LOCK
  if (mode === 'npm') return NPM_LOCK
  return null
}

function resolveInstallMode() {
  const pkg = readPackageJson()
  const pm = pkg.packageManager ?? ''

  if (pm.startsWith('pnpm:')) return 'pnpm'
  if (existsSync(PNPM_LOCK)) return 'pnpm'
  if (existsSync(NPM_LOCK)) return 'npm'
  return 'npm-no-lock'
}

function needsInstall(mode) {
  if (!existsSync(join(root, 'node_modules'))) return true
  if (!existsSync(STAMP)) return true

  const lock = lockfilePath(mode)
  if (!lock || !existsSync(lock)) return false

  return statSync(lock).mtimeMs > statSync(STAMP).mtimeMs
}

function installDependencies(mode) {
  if (mode === 'pnpm') {
    run('corepack', ['enable'], 'Enabling corepack for pnpm…')
    run('pnpm', ['install', '--frozen-lockfile'], 'Installing dependencies with pnpm…')
    return
  }

  if (mode === 'npm') {
    run('npm', ['ci'], 'Installing dependencies with npm ci…')
    return
  }

  log('WARNING: No lockfile found; running npm install (non-reproducible).')
  run('npm', ['install'], 'Installing dependencies with npm install…')
}

function writeStamp() {
  writeFileSync(STAMP, String(Date.now()), 'utf8')
}

if (!isNodeVersionOk()) {
  console.error('[setup] Node.js 22+ required. Run Setup.bat to bootstrap Node.')
  process.exit(1)
}

const mode = resolveInstallMode()
log(`Package manager mode: ${mode}`)

if (needsInstall(mode)) {
  installDependencies(mode)
  run('npm', ['run', 'rebuild:node'], 'Rebuilding better-sqlite3 for Node…')
  writeStamp()
  log('Dependencies ready.')
} else {
  log('Dependencies up to date.')
}
