/**
 * Stop a running StellarLedger portable exe so rebuild/packaging can replace files.
 */
import { spawnSync } from 'node:child_process'

export function stopRunningGame() {
  if (process.platform !== 'win32') return false
  let stopped = false
  for (const exe of ['StellarLedger.exe', 'GalacticEconomy.exe']) {
    const r = spawnSync('taskkill', ['/F', '/IM', exe], { stdio: 'ignore' })
    if (r.status === 0) stopped = true
  }
  return stopped
}
