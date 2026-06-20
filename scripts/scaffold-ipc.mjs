#!/usr/bin/env node
/**
 * Print boilerplate snippets for a new GameApi IPC endpoint, or verify wiring.
 *
 * Usage:
 *   node scripts/scaffold-ipc.mjs verify
 *   node scripts/scaffold-ipc.mjs <methodName> [--payload] [--write]
 *
 * Examples:
 *   node scripts/scaffold-ipc.mjs getTradeRoutes
 *   node scripts/scaffold-ipc.mjs createTradeRoute --payload --write
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function read(rel) {
  return readFileSync(join(root, rel), 'utf8')
}

function write(rel, content) {
  writeFileSync(join(root, rel), content, 'utf8')
}

function extractGameApiMethods(source) {
  const block = source.match(/export interface GameApi \{([\s\S]*?)\n\}/)
  if (!block) throw new Error('Could not find GameApi in types/api.ts')
  return [...block[1].matchAll(/^\s+(\w+)\(/gm)].map((m) => m[1])
}

function extractIpcMethodSpecs(source) {
  const block = source.match(/export const IPC_METHOD_SPECS = \[([\s\S]*?)\] as const/)
  if (!block) throw new Error('Could not find IPC_METHOD_SPECS in shared/ipcMethods.ts')
  return [...block[1].matchAll(/name: '(\w+)'/g)].map((m) => m[1])
}

function extractDispatchCases(source) {
  return [...source.matchAll(/^\s+case '(\w+)':/gm)].map((m) => m[1])
}

function verify() {
  const apiMethods = extractGameApiMethods(read('src/shared/types/api.ts'))
  const ipcMethods = extractIpcMethodSpecs(read('src/shared/ipcMethods.ts'))
  const dispatchCases = extractDispatchCases(read('src/main/dispatch.ts'))

  const apiSet = new Set(apiMethods)
  const ipcSet = new Set(ipcMethods)
  const dispatchSet = new Set(dispatchCases)

  const missingIpc = apiMethods.filter((m) => !ipcSet.has(m))
  const extraIpc = ipcMethods.filter((m) => !apiSet.has(m))
  const missingDispatch = apiMethods.filter((m) => !dispatchSet.has(m))
  const extraDispatch = dispatchCases.filter((m) => !apiSet.has(m))

  let ok = true

  if (missingIpc.length === 0 && extraIpc.length === 0) {
    console.log(`OK: GameApi (${apiMethods.length} methods) matches IPC_METHOD_SPECS.`)
  } else {
    ok = false
    if (missingIpc.length) {
      console.error('GameApi methods missing from IPC_METHOD_SPECS:')
      for (const m of missingIpc) console.error(`  - ${m}`)
    }
    if (extraIpc.length) {
      console.error('IPC_METHOD_SPECS entries not on GameApi:')
      for (const m of extraIpc) console.error(`  - ${m}`)
    }
  }

  if (missingDispatch.length === 0 && extraDispatch.length === 0) {
    console.log(`OK: GameApi matches dispatch switch cases (${dispatchCases.length}).`)
  } else {
    ok = false
    if (missingDispatch.length) {
      console.error('GameApi methods missing from dispatch switch:')
      for (const m of missingDispatch) console.error(`  - ${m}`)
    }
    if (extraDispatch.length) {
      console.error('dispatch switch cases not on GameApi:')
      for (const m of extraDispatch) console.error(`  - ${m}`)
    }
  }

  if (ok) {
    console.log('Also run: pnpm test tests/ipc.test.ts')
    return 0
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

  console.log('\n## 2. src/shared/ipcMethods.ts — IPC_METHOD_SPECS entry')
  console.log(`  { name: '${method}', hasPayload: ${withPayload} },`)

  console.log('\n## 3. src/main/ipcSchemas.ts — Zod schema (skip if no payload)')
  if (withPayload) {
    console.log(`  ${method}: z.object({ /* fields */ }),`)
  } else {
    console.log('  (no entry — payload-less methods are not listed in ipcPayloadSchemas)')
  }

  console.log('\n## 4. src/main/gameService.ts — delegate to simulation or read model')
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

  console.log('\n## 5. src/main/dispatch.ts — switch case (HANDLED_METHODS is derived from ipcMethods.ts)')
  if (withPayload) {
    console.log(`    case '${method}':`)
    console.log(`      return service.${serviceMethod}(parseIpcPayload(method, payload))`)
  } else {
    console.log(`    case '${method}':`)
    console.log(`      return service.${serviceMethod}()`)
  }

  console.log('\n## 6. src/main/preload.ts — auto-wired from IPC_METHOD_SPECS (no manual entry)')

  console.log('\n## 7. tests/ipc.test.ts — payloadFor() entry (compile-time guard)')
  if (withPayload) {
    console.log(`    ${method}: { /* valid sample payload */ },`)
  } else {
    console.log(`    ${method}: undefined,`)
  }

  console.log('\n## 8. Renderer (if player-facing)')
  console.log('  - Call via `api.' + method + '()` from a page')
  console.log('  - Add mock default in tests/renderer/mockApi.ts')
  console.log('  - Optional smoke test in tests/renderer/pages.smoke.test.tsx')
}

function appendIpcMethodSpec(method, withPayload) {
  const rel = 'src/shared/ipcMethods.ts'
  let source = read(rel)
  if (source.includes(`name: '${method}'`)) {
    console.error(`IPC_METHOD_SPECS already contains '${method}'.`)
    process.exit(1)
  }
  source = source.replace(
    /(\] as const satisfies readonly IpcMethodSpec\[\])/,
    `  { name: '${method}', hasPayload: ${withPayload} },\n$1`
  )
  write(rel, source)
  console.log(`Updated ${rel}`)
}

function appendGameApiStub(method, withPayload) {
  const rel = 'src/shared/types/api.ts'
  let source = read(rel)
  if (source.includes(`${method}(`)) {
    console.error(`GameApi already contains '${method}'.`)
    process.exit(1)
  }
  const stub = withPayload
    ? `  // TODO: ${method} — add ${pascalCase(method)}Args + ${pascalCase(method)}Result\n  // ${method}(args: ${pascalCase(method)}Args): Promise<IpcResult<${pascalCase(method)}Result>>`
    : `  // TODO: ${method} — add ${pascalCase(method)}Result\n  // ${method}(): Promise<IpcResult<${pascalCase(method)}Result>>`
  source = source.replace(/\n\}\n\nexport type \{ MarketTradePreview \}/, `\n${stub}\n}\n\nexport type { MarketTradePreview }`)
  write(rel, source)
  console.log(`Updated ${rel}`)
}

function appendDispatchCase(method, withPayload) {
  const rel = 'src/main/dispatch.ts'
  let source = read(rel)
  if (source.includes(`case '${method}':`)) {
    console.error(`dispatch already contains case '${method}'.`)
    process.exit(1)
  }
  const serviceMethod = method
  const caseBlock = withPayload
    ? `    case '${method}':\n      return service.${serviceMethod}(parseIpcPayload(method, payload))`
    : `    case '${method}':\n      return service.${serviceMethod}()`
  source = source.replace(/\n    default:\n/, `\n${caseBlock}\n    default:\n`)
  write(rel, source)
  console.log(`Updated ${rel}`)
}

function appendPayloadForHint(method, withPayload) {
  const rel = 'tests/ipc.test.ts'
  let source = read(rel)
  if (source.includes(`${method}:`)) {
    console.error(`payloadFor() already contains '${method}'.`)
    process.exit(1)
  }
  const entry = withPayload
    ? `    ${method}: { /* valid sample payload */ },`
    : `    ${method}: undefined,`
  source = source.replace(/\n  \}\n\}\n\ndescribe\('IPC dispatcher'/, `\n${entry}\n  }\n}\n\ndescribe('IPC dispatcher'`)
  write(rel, source)
  console.log(`Updated ${rel}`)
}

function writeScaffold(method, withPayload) {
  appendIpcMethodSpec(method, withPayload)
  appendGameApiStub(method, withPayload)
  appendDispatchCase(method, withPayload)
  appendPayloadForHint(method, withPayload)
  console.log('\nPreload is auto-wired from IPC_METHOD_SPECS — no preload.ts edit needed.')
  console.log('Next: implement gameService + ipcSchemas, replace TODO stubs in api.ts, then run verify.')
}

const [command, ...rest] = process.argv.slice(2)

if (!command || command === '--help' || command === '-h') {
  console.log(`Usage:
  node scripts/scaffold-ipc.mjs verify
  node scripts/scaffold-ipc.mjs <methodName> [--payload] [--write]`)
  process.exit(0)
}

if (command === 'verify') {
  process.exit(verify())
}

const withPayload = rest.includes('--payload')
const doWrite = rest.includes('--write')
const method = command
if (!/^[a-z][a-zA-Z0-9]*$/.test(method)) {
  console.error('methodName must be camelCase (e.g. getStarMap, createMarketOrder)')
  process.exit(1)
}

if (doWrite) {
  writeScaffold(method, withPayload)
  process.exit(verify())
}

scaffold(method, withPayload)
