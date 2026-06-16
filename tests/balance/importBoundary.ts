import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

/** Import specifiers that must not appear in src/balance. */
const FORBIDDEN_IMPORT_PATTERNS: ReadonlyArray<{ id: string; test: RegExp }> = [
  { id: 'src/database', test: /(?:^|\/)database(?:\/|\.)/ },
  { id: 'better-sqlite3', test: /\bbetter-sqlite3\b/ },
  { id: 'electron', test: /\belectron\b/ },
  { id: 'src/renderer', test: /(?:^|\/)renderer(?:\/|\.)/ },
  { id: 'src/main', test: /(?:^|\/)main(?:\/|\.)/ },
  { id: 'tests/helpers', test: /(?:^|\/)tests\/helpers(?:\/|\.)/ }
]

const IMPORT_SPECIFIER =
  /(?:import\s+(?:type\s+)?(?:[\w*{}\s,$]+\s+from\s+)?|export\s+(?:type\s+)?(?:\*|\{[^}]*\})\s+from\s+|import\s+)['"]([^'"]+)['"]/g

function collectTsFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...collectTsFiles(path))
    } else if (entry.name.endsWith('.ts')) {
      out.push(path)
    }
  }
  return out
}

export interface ForbiddenImportHit {
  file: string
  specifier: string
  rule: string
}

/** Static scan of src/balance import specifiers (does not execute module code). */
export function findForbiddenBalanceImports(balanceRoot: string): ForbiddenImportHit[] {
  const hits: ForbiddenImportHit[] = []
  for (const file of collectTsFiles(balanceRoot)) {
    const rel = relative(process.cwd(), file).replace(/\\/g, '/')
    const content = readFileSync(file, 'utf8')
    for (const match of content.matchAll(IMPORT_SPECIFIER)) {
      const specifier = match[1]!
      for (const { id, test } of FORBIDDEN_IMPORT_PATTERNS) {
        if (test.test(specifier)) {
          hits.push({ file: rel, specifier, rule: id })
        }
      }
    }
  }
  return hits
}
