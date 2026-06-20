import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/** Guard against reintroducing O(n) definition scans outside stateIndex/resolveNames. */
describe('architecture guards', () => {
  it('simulation hot paths use stateIndex or resolveNames instead of definitions.find', () => {
    const simDir = join(process.cwd(), 'src', 'simulation')
    const allowed = new Set([
      'stateIndex.ts',
      'resolveNames.ts',
      'bootstrap.ts',
      'productionPlanner.ts'
    ])
    const offenders: string[] = []

    function scan(dir: string): void {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name)
        if (entry.isDirectory()) {
          scan(path)
          continue
        }
        if (!entry.name.endsWith('.ts')) continue
        if (allowed.has(entry.name)) continue
        const text = readFileSync(path, 'utf8')
        if (/definitions\.(items|systems|planets|buildings|recipes)\.find\(/.test(text)) {
          offenders.push(path.replace(process.cwd() + '\\', '').replace(process.cwd() + '/', ''))
        }
      }
    }

    scan(simDir)
    expect(offenders, `Use stateIndex/resolveNames in:\n${offenders.join('\n')}`).toEqual([])
  })
})
