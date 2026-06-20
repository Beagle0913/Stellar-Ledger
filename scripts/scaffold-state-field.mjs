#!/usr/bin/env node
/**
 * Scaffold checklist for adding mutable GameState fields + SQLite persistence.
 *
 * Usage:
 *   node scripts/scaffold-state-field.mjs verify
 *   node scripts/scaffold-state-field.mjs <fieldName>
 *
 * Examples:
 *   node scripts/scaffold-state-field.mjs standingRoutes
 */

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function read(rel) {
  return readFileSync(join(root, rel), 'utf8')
}

function currentSchemaVersion(source) {
  const matches = [...source.matchAll(/version:\s*(\d+)/g)]
  if (matches.length === 0) return null
  return Number(matches[matches.length - 1]![1])
}

function verify() {
  const migrations = read('src/database/migrations.ts')
  const version = currentSchemaVersion(migrations)
  if (version == null) {
    console.error('Could not read SCHEMA_VERSION from migrations.ts')
    return 1
  }
  console.log(`Current schema version: v${version}`)
  console.log('Persistence workflow: docs/PERSISTENCE.md')
  console.log('PR checklist: .github/PULL_REQUEST_TEMPLATE.md')
  return 0
}

function scaffold(fieldName) {
  if (!/^[a-z][a-zA-Z0-9]*$/.test(fieldName)) {
    console.error('fieldName must be camelCase (e.g. standingRoutes)')
    process.exit(1)
  }

  const migrations = read('src/database/migrations.ts')
  const version = currentSchemaVersion(migrations)
  const next = version != null ? version + 1 : '?'

  console.log(`# Scaffold mutable state field: ${fieldName}\n`)
  console.log('Copy each block into the file listed. See docs/PERSISTENCE.md.\n')

  console.log('## 1. src/shared/types/state.ts')
  console.log(`  ${fieldName}: YourType[]  // or scalar`)

  console.log('\n## 2. src/database/migrations.ts')
  console.log(`  Bump SCHEMA_VERSION to ${next}`)
  console.log(`  Add migration v${next} creating/updating tables or JSON columns for ${fieldName}`)

  console.log('\n## 3. src/database/repositories/')
  console.log(`  Add load/save helpers for ${fieldName} (new repo file or extend entityRepo.ts)`)

  console.log('\n## 4. src/database/saveManager.ts')
  console.log(`  Wire ${fieldName} into createCampaign / loadCampaign / persistState`)

  console.log('\n## 5. tests/migrations.test.ts')
  console.log(`  Add fixture asserting v${next - 1} → v${next} migration for ${fieldName}`)

  console.log('\n## 6. Simulation (if gameplay logic)')
  console.log(`  Pure functions in src/simulation/ — register tick step in tickSteps.ts if daily`)
}

const [command] = process.argv.slice(2)

if (!command || command === '--help' || command === '-h') {
  console.log(`Usage:
  node scripts/scaffold-state-field.mjs verify
  node scripts/scaffold-state-field.mjs <fieldName>`)
  process.exit(0)
}

if (command === 'verify') {
  process.exit(verify())
}

scaffold(command)
