import { spawnSync } from 'node:child_process'

process.env.BALANCE_WRITE_REPORTS = '1'
const result = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['vitest', 'run', 'tests/balance/reportRunner.test.ts'],
  { stdio: 'inherit', shell: true, env: process.env }
)
process.exit(result.status ?? 1)
