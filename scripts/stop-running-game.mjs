/**
 * Stop a running GalacticEconomy portable exe so rebuild/packaging can replace files.
 */
import { spawnSync } from 'node:child_process'

export function stopRunningGame() {
  if (process.platform !== 'win32') return false
  const r = spawnSync('taskkill', ['/F', '/IM', 'GalacticEconomy.exe'], { stdio: 'ignore' })
  return r.status === 0
}
