import type { BalanceReport } from '../types.js'

const DAILY_COLUMNS = [
  'day',
  'credits',
  'netWorth',
  'shipsOwned',
  'idleBuildings',
  'shipUtilization',
  'foodSecurityRatio',
  'eventsFired',
  'failedActions',
  'explanationCount',
  'stockoutCount'
] as const

export function formatDailyCsv(report: BalanceReport): string {
  const header = DAILY_COLUMNS.join(',')
  const rows = report.snapshots.map((s) =>
    [
      s.day,
      s.credits,
      s.netWorth,
      s.shipsOwned,
      s.idleBuildings,
      s.shipUtilization.toFixed(3),
      s.foodSecurityRatio.toFixed(3),
      s.eventsFired,
      s.failedActions,
      s.explanationCount,
      s.stockoutItems.length
    ].join(',')
  )
  return [header, ...rows].join('\n')
}

export function formatVolatilityCsv(report: BalanceReport): string {
  const lines = ['day,itemId,absPercentChange']
  for (const snap of report.snapshots) {
    for (const [itemId, v] of Object.entries(snap.priceVolatility)) {
      lines.push(`${snap.day},${itemId},${v.toFixed(2)}`)
    }
  }
  return lines.join('\n')
}
