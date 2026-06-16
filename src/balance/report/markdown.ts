import type { BalanceReport } from '../types.js'

export function formatMarkdownReport(report: BalanceReport): string {
  const { meta, summary, hardGates, warnings } = report
  const allPassed = hardGates.every((g) => g.passed)

  const gateRows = hardGates
    .map((g) => `| ${g.id} | ${g.passed ? 'PASS' : 'FAIL'} | ${g.detail} |`)
    .join('\n')
  const warnRows = warnings
    .map((w) => `| ${w.id} | ${w.passed ? 'OK' : 'WARN'} | ${w.detail} |`)
    .join('\n')

  const milestones = [
    summary.dayArcComplete !== null ? `- Day ${summary.dayArcComplete}: first-hour arc complete` : null,
    summary.daySecondHauler1 !== null ? `- Day ${summary.daySecondHauler1}: second Hauler I` : null,
    summary.dayHauler2Affordable !== null ? `- Day ${summary.dayHauler2Affordable}: Hauler II affordable` : null,
    summary.dayNetWorthObjective !== null ? `- Day ${summary.dayNetWorthObjective}: net worth objective` : null
  ]
    .filter(Boolean)
    .join('\n')

  const volatilityEntries = report.snapshots.flatMap((s) =>
    Object.entries(s.priceVolatility).map(([itemId, v]) => ({ day: s.day, itemId, v }))
  )
  volatilityEntries.sort((a, b) => b.v - a.v)
  const topVolatile = volatilityEntries
    .slice(0, 5)
    .map((e) => `- ${e.itemId} day ${e.day}: ${e.v.toFixed(1)}%`)
    .join('\n')

  return `# Balance Report — ${meta.strategyId}

**Horizon:** ${meta.days} days  
**Generated:** ${meta.generatedAt}  
**Hard gates:** ${allPassed ? 'ALL PASSED' : 'FAILURES DETECTED'}

## Milestones

${milestones || '- None reached within horizon'}

## Hard gates

| ID | Status | Detail |
|----|--------|--------|
${gateRows}

## Diagnostic warnings

| ID | Status | Detail |
|----|--------|--------|
${warnRows}

## Top price volatility (home market)

${topVolatile || '- No volatility data'}

## Explanation coverage

Digest lines on ${summary.explanationActiveDays} days (${summary.explanationTotals.info} info, ${summary.explanationTotals.warning} warning, ${summary.explanationTotals.critical} critical).
`
}
