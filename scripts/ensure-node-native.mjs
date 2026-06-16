/**
 * Ensure better-sqlite3 is built for the current Node ABI before Vitest runs.
 * If the module was left on the Electron ABI (after dist / rebuild:electron),
 * runs `pnpm run rebuild:node` once and retries.
 */
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)

function isAbiMismatch(err) {
  const msg = String(err?.message ?? err)
  return /NODE_MODULE_VERSION|compiled against a different Node\.js version/i.test(msg)
}

function probe() {
  const Database = require('better-sqlite3')
  const db = new Database(':memory:')
  db.close()
}

function rebuildForNode() {
  const attempts = [
    ['npm', ['run', 'rebuild:node']],
    ['corepack', ['pnpm', 'run', 'rebuild:node']],
    ['pnpm', ['run', 'rebuild:node']]
  ]

  for (const [cmd, args] of attempts) {
    const result = spawnSync(cmd, args, {
      cwd: root,
      stdio: 'inherit',
      shell: true
    })
    if (result.status === 0) return true
  }

  return false
}

try {
  probe()
  process.exit(0)
} catch (firstErr) {
  if (!isAbiMismatch(firstErr)) {
    console.error('[pretest] better-sqlite3 failed to load:', firstErr?.message ?? firstErr)
    process.exit(1)
  }

  console.log('[pretest] Rebuilding better-sqlite3 for Node…')

  if (!rebuildForNode()) {
    console.error(
      '[pretest] rebuild:node failed. Close GalacticEconomy.exe if running, then run:\n' +
        '  corepack pnpm run rebuild:node\n' +
        'See README.md — Running the GUI: native module ABI note.'
    )
    process.exit(1)
  }

  try {
    probe()
    process.exit(0)
  } catch (secondErr) {
    console.error(
      '[pretest] better-sqlite3 still fails after rebuild:node:',
      secondErr?.message ?? secondErr,
      '\nSee README.md — Running the GUI: native module ABI note.'
    )
    process.exit(1)
  }
}
