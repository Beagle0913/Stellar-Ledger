import type { BalanceReport } from '../types.js'

export interface JsonReportOptions {
  /** When false, omit the per-day snapshots array (slim report). Default: true. */
  includeSnapshots?: boolean
}

export function formatJsonReport(report: BalanceReport, options: JsonReportOptions = {}): string {
  const includeSnapshots = options.includeSnapshots !== false
  const payload: Record<string, unknown> = {
    meta: report.meta,
    summary: report.summary,
    hardGates: report.hardGates,
    warnings: report.warnings
  }
  if (includeSnapshots) {
    payload.snapshots = report.snapshots
  }
  return JSON.stringify(payload, null, 2)
}

/** Summary-only JSON (meta, summary, gates, warnings — no snapshots). */
export function formatJsonReportSummary(report: BalanceReport): string {
  return formatJsonReport(report, { includeSnapshots: false })
}
