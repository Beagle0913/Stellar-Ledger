/**
 * Fail CI if legacy branding strings appear outside allowed files.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')

const FORBIDDEN = [
  { pattern: /Galactic Economy Prototype/g, label: 'Galactic Economy Prototype' },
  { pattern: /GalacticEconomy\.exe/g, label: 'GalacticEconomy.exe' },
  { pattern: /Galactic Economy/g, label: 'Galactic Economy' },
  { pattern: /Galactic Ledger/g, label: 'Galactic Ledger' }
]

const ALLOWLIST = new Set([
  'CHANGELOG.md',
  '.cursor/plans/100-system_galaxy_expansion_7ebb9132.plan.md',
  'Play.bat',
  'scripts/stop-running-game.mjs'
])

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'out',
  'release',
  'dist',
  '.tools',
  '.pnpm-store',
  'reports'
])

const EXT_OK = new Set([
  '.md',
  '.ts',
  '.tsx',
  '.js',
  '.mjs',
  '.json',
  '.html',
  '.bat',
  '.yml',
  '.yaml',
  '.css',
  '.sql'
])

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    const rel = relative(root, path).replace(/\\/g, '/')
    if (SKIP_DIRS.has(name)) continue
    const st = statSync(path)
    if (st.isDirectory()) {
      walk(path, files)
      continue
    }
    const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')) : ''
    if (!EXT_OK.has(ext)) continue
    files.push(rel)
  }
  return files
}

const violations = []

for (const file of walk(root)) {
  if (ALLOWLIST.has(file)) continue
  if (file === 'scripts/check-branding.mjs') continue
  const text = readFileSync(join(root, file), 'utf8')
  for (const { pattern, label } of FORBIDDEN) {
    pattern.lastIndex = 0
    if (pattern.test(text)) {
      violations.push(`${file}: contains "${label}"`)
    }
  }
}

if (violations.length > 0) {
  console.error('[check:branding] Forbidden legacy branding found:\n')
  for (const v of violations) console.error(`  - ${v}`)
  console.error('\nAllowed only in CHANGELOG.md (history) and migration notes.')
  process.exit(1)
}

console.log('[check:branding] OK')
