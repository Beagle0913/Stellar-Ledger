#!/usr/bin/env node
/**
 * Print boilerplate snippets for a new GameApi IPC endpoint, or verify wiring.
 *
 * Usage:
 *   node scripts/scaffold-ipc.mjs verify
 *   node scripts/scaffold-ipc.mjs <methodName> [--payload]
 *
 * Examples:
 *   node scripts/scaffold-ipc.mjs getTradeRoutes
 *   node scripts/scaffold-ipc.mjs createTradeRoute --payload
 */

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function read(rel) {
  return readFileSync(join(root, rel), 'utf8')
}

function extractGameApiMethods(source) {
  const block = source.match(/export interface GameApi \{([\s\S]*?)\n\}/)
  if (!block) throw new Error('Could not find GameApi in types/api.ts')
  return [...block[1].matchAll(/^\s+(\w+)\(/gm)].map((m) => m[1])
}

function extractHandledMethods(source) {
  const block = source.match(/export const HANDLED_METHODS = \[([\s\S]*?)\] as const/)
  if (!block) throw new Error('Could not find HANDLED_METHODS in dispatch.ts')
  return [...block[1].matchAll(/'(\w+)'/g)].map((m) => m[1])
}

function verify() {
  const apiMethods = extractGameApiMethods(read('src/shared/types/api.ts'))
  const handled = extractHandledMethods(read('src/main/dispatch.ts'))
  const apiSet = new Set(apiMethods)
  const handledSet = new Set(handled)

  const missingDispatch = apiMethods.filter((m) => !handledSet.has(m))
  const extraDispatch = handled.filter((m) => !apiSet.has(m))

  if (missingDispatch.length === 0 && extraDispatch.length === 0) {
    console.log(`OK: GameApi (${apiMethods.length} methods) matches HANDLED_METHODS.`)
    console.log('Also run: pnpm test tests/ipc.test.ts')
    return 0
  }

  if (missingDispatch.length) {
    console.error('GameApi methods missing from HANDLED_METHODS / dispatch:')
    for (const m of missingDispatch) console.error(`  - ${m}`)
  }
  if (extraDispatch.length) {
    console.error('HANDLED_METHODS entries not on GameApi:')
    for (const m of extraDispatch) console.error(`  - ${m}`)
  }
  return 1
}

function pascalCase(name) {
  return name.charAt(0).toUpperCase() + name.slice(1)
}

function scaffold(method, withPayload) {
  const serviceMethod = method
  const resultType = `${pascalCase(method)}Result`

  console.log(`# Scaffold IPC endpoint: ${method}\n`)
  console.log('Copy each block into the file listed. Then run `pnpm scaffold:ipc verify` and extend tests/ipc.test.ts.\n')

  console.log('## 1. src/shared/types/api.ts — return type + GameApi method')
  if (withPayload) {
    console.log(`export interface ${pascalCase(method)}Args { /* fields */ }`)
    console.log(`export interface ${resultType} { /* fields */ }`)
    console.log(`  ${method}(args: ${pascalCase(method)}Args): Promise<IpcResult<${resultType}>>`)
  } else {
    console.log(`export interface ${resultType} { /* fields */ }`)
    console.log(`  ${method}(): Promise<IpcResult<${resultType}>>`)
  }

  console.log('\n## 2. src/main/ipcSchemas.ts — Zod schema (skip if no payload)')
  if (withPayload) {
    console.log(`  ${method}: z.object({ /* fields */ }),`)
  } else {
    console.log('  (no entry — payload-less methods are not listed in ipcPayloadSchemas)')
  }

  console.log('\n## 3. src/main/gameService.ts — delegate to simulation or read model')
  if (withPayload) {
    console.log(`  ${serviceMethod}(args: ${pascalCase(method)}Args): ${resultType} {`)
    console.log(`    const { state } = this.session.require()`)
    console.log(`    // implement`)
    console.log(`  }`)
  } else {
    console.log(`  ${serviceMethod}(): ${resultType} {`)
    console.log(`    const { state } = this.session.require()`)
    console.log(`    // implement`)
    console.log(`  }`)
  }

  console.log('\n## 4. src/main/dispatch.ts — HANDLED_METHODS + switch case')
  console.log(`  '${method}',`)
  if (withPayload) {
    console.log(`    case '${method}':`)
    console.log(`      return service.${serviceMethod}(parseIpcPayload(method, payload))`)
  } else {
    console.log(`    case '${method}':`)
    console.log(`      return service.${serviceMethod}()`)
  }

  console.log('\n## 5. src/main/preload.ts — contextBridge entry')
  if (withPayload) {
    console.log(`  ${method}: (args) => call('${method}', args),`)
  } else {
    console.log(`  ${method}: () => call('${method}'),`)
  }

  console.log('\n## 6. tests/ipc.test.ts — payloadFor() entry (compile-time guard)')
  if (withPayload) {
    console.log(`    ${method}: { /* valid sample payload */ },`)
  } else {
    console.log(`    ${method}: undefined,`)
  }

  console.log('\n## 7. Renderer (if player-facing)')
  console.log('  - Call via `api.' + method + '()` from a page')
  console.log('  - Add mock default in tests/renderer/mockApi.ts')
  console.log('  - Optional smoke test in tests/renderer/pages.smoke.test.tsx')
}

const [command, ...rest] = process.argv.slice(2)

if (!command || command === '--help' || command === '-h') {
  console.log(`Usage:
  node scripts/scaffold-ipc.mjs verify
  node scripts/scaffold-ipc.mjs <methodName> [--payload]`)
  process.exit(0)
}

if (command === 'verify') {
  process.exit(verify())
}

const withPayload = rest.includes('--payload')
const method = command
if (!/^[a-z][a-zA-Z0-9]*$/.test(method)) {
  console.error('methodName must be camelCase (e.g. getStarMap, createMarketOrder)')
  process.exit(1)
}

scaffold(method, withPayload)
