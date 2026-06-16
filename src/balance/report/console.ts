import type { BalanceReport } from '../types.js'

export function formatConsoleSummary(report: BalanceReport): string {
  const { meta, summary, hardGates, warnings } = report
  const passed = hardGates.filter((g) => g.passed).length
  const failedWarnings = warnings.filter((w) => !w.passed)

  const lines = [
    `Balance run: ${meta.strategyId} × ${meta.days} days (vanilla)`,
    `  Arc complete: ${summary.dayArcComplete ?? '—'} (obj_arc_fleet)`,
    `  Second Hauler I: ${summary.daySecondHauler1 ?? '—'}`,
    `  Hauler II affordable: ${summary.dayHauler2Affordable ?? '—'}`,
    `  Net worth: ${summary.startingCredits.toLocaleString()} → ${summary.endingNetWorth.toLocaleString()} (peak +${summary.maxDailyNetWorthGain.toLocaleString()}/day)`,
    `  Events: ${summary.totalEventsFired} fired (${summary.punitiveEventCount} punitive pre-arc)`,
    `  Stockouts: ${summary.stockoutDays} days`,
    `  Failed actions: ${summary.totalFailedActions}`,
    `  Explanations: ${summary.explanationTotals.info + summary.explanationTotals.warning + summary.explanationTotals.critical} total (info ${summary.explanationTotals.info}, warning ${summary.explanationTotals.warning}, critical ${summary.explanationTotals.critical})`,
    `  Hard gates: ${passed}/${hardGates.length} passed`,
    failedWarnings.length > 0
      ? `  Warnings: ${failedWarnings.length} (${failedWarnings.map((w) => w.id).join(', ')})`
      : `  Warnings: ${warnings.length} evaluated, all clear`
  ]
  return lines.join('\n')
}
