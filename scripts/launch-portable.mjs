/**
 * Launch the packaged portable exe (release/GalacticEconomy.exe).
 * Used by `pnpm play:portable` and documented in README.
 */
import { existsSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const releaseDir = join(root, 'release')

function findPortableExe() {
  const preferred = join(releaseDir, 'GalacticEconomy.exe')
  if (existsSync(preferred)) return preferred

  if (!existsSync(releaseDir)) return null
  const legacy = readdirSync(releaseDir).find(
    (name) =>
      name.endsWith('-portable.exe') ||
      (name.endsWith('.exe') && name.toLowerCase().includes('galactic'))
  )
  return legacy ? join(releaseDir, legacy) : null
}

const exe = findPortableExe()
if (!exe) {
  console.error('No portable exe found. Build one first:')
  console.error('  npm run dist')
  console.error('Or double-click "Build Game.bat" on Windows.')
  process.exit(1)
}

console.log(`Launching ${exe}`)

const child = spawn(exe, [], { detached: true, stdio: 'ignore' })
child.unref()
