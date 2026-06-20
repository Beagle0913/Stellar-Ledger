import React from 'react'
import { api } from '../api'
import { useApp } from '../App'
import { useCampaignAsync, useApiMutationWithArg, useTickControls } from '../hooks'
import { StatusBanner } from '../components/StatusBanner'
import { StatCard } from '../components/StatCard'
import { TickControlsPanel } from '../components/TickControlsPanel'
import { DataTable } from '../components/DataTable'
import { TutorialPanel } from '../components/TutorialPanel'
import { formatPriceChange, formatTrendLabel, trendTagClass } from '../../shared/economyDiagnostics'
import { explainMarketChange } from '../../shared/explanations'
import { LOG_CATEGORY_LABELS } from '../../shared/gameLog'
import { ExplanationLine } from '../components/ExplanationLine'
import { filterDashboardDigestForTickReport } from '../dashboardDigestFilter'
import type {
  ContractView,
  DashboardData,
  EventLogView,
  GameLogCategory,
  GameLogEntry,
  MarketChangeEntry,
  ObjectiveView
} from '../../shared/types'

export function DashboardPage(): React.JSX.Element {
  const { token, refresh } = useApp()
  const dash = useCampaignAsync<DashboardData>(() => api.getDashboard(), [token])
  const events = useCampaignAsync<EventLogView[]>(() => api.getEvents(), [token])
  const {
    tickLog,
    ticking,
    error: tickError,
    notice,
    lastTick,
    runTick,
    runWeek,
    runSmart,
    setNotice
  } = useTickControls()

  const acceptContractMut = useApiMutationWithArg((id: string) => api.acceptContract(id), {
    onSuccess: () => {
      refresh()
      setNotice('Contract accepted.')
    }
  })
  const completeContractMut = useApiMutationWithArg((id: string) => api.completeContract(id), {
    onSuccess: () => {
      refresh()
      setNotice('Contract completed — reward credited.')
    }
  })
  const abandonContractMut = useApiMutationWithArg((id: string) => api.abandonContract(id), {
    onSuccess: () => {
      refresh()
      setNotice('Contract abandoned.')
    }
  })

  const contractError =
    acceptContractMut.error ?? completeContractMut.error ?? abandonContractMut.error

  const d = dash.data
  const allEvents = events.data ?? []
  const lastTickEvents = lastTick ? allEvents.filter((e) => e.tick === lastTick.tick) : []
  const whyTodayDigest = lastTick?.explanations
    ? filterDashboardDigestForTickReport(lastTick.explanations)
    : []

  return (
    <div>
      <h2>Dashboard</h2>
      <StatusBanner
        error={tickError ?? contractError ?? dash.error ?? events.error}
        notice={notice}
        loading={dash.loading && !d}
      />

      <TutorialPanel credits={d?.credits ?? null} />

      <TickControlsPanel
        ticking={ticking}
        onRunTick={() => void runTick()}
        onRunWeek={() => void runWeek()}
        onRunSmartProduction={() => void runSmart('production')}
        onRunSmartTransport={() => void runSmart('transport')}
        onRunSmartChanges={() => void runSmart('changes')}
      />

      {d && d.actionSuggestions.length > 0 && (
        <div className="panel">
          <h3>Suggestions</h3>
          <ul className="ticklog">
            {d.actionSuggestions.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {d && (
        <div className="stat-grid">
          <StatCard label="Credits" value={`${d.credits.toLocaleString()} cr`} />
          <StatCard label="Current Day" value={d.tick} />
          <StatCard label="Systems" value={d.systemCount} />
          <StatCard label="Planets" value={d.planetCount} />
          <StatCard label="Inventory Value (est.)" value={`${d.inventoryValueEstimate.toLocaleString()} cr`} />
          <StatCard label="Active Production" value={d.activeProductionJobs} />
          <StatCard label="Active Transport" value={d.activeTransportJobs} />
        </div>
      )}

      {d && d.objectives.length > 0 && (
        <ObjectivesPanel objectives={d.objectives} />
      )}

      {d && d.factionReputation.length > 0 && (
        <div className="panel" style={{ marginTop: 16 }}>
          <h3>Faction Standing</h3>
          <p className="muted">
            Reputation unlocks higher contract tiers and adds a small bonus to contract payouts (not
            regional prices).
          </p>
          <DataTable
            rows={d.factionReputation}
            rowKey={(f) => f.factionId}
            columns={[
              { key: 'name', header: 'Faction', render: (f) => f.factionName },
              { key: 'rep', header: 'Rep', numeric: true, render: (f) => f.reputation },
              {
                key: 'next',
                header: 'Next tier',
                render: (f) =>
                  f.nextTierAt != null ? `${f.nextTierAt} rep` : <span className="muted">—</span>
              },
              {
                key: 'bonus',
                header: 'Contract bonus',
                render: (f) =>
                  f.contractBonusPercent > 0 ? `+${f.contractBonusPercent}%` : <span className="muted">—</span>
              }
            ]}
          />
        </div>
      )}

      {d && d.contracts.length > 0 && (
        <div className="panel" style={{ marginTop: 16 }}>
          <h3>Contract Board</h3>
          <DataTable<ContractView>
            rows={d.contracts}
            rowKey={(c) => c.id}
            columns={[
              { key: 'title', header: 'Contract', render: (c) => c.title },
              { key: 'faction', header: 'Faction', render: (c) => c.factionName },
              {
                key: 'reward',
                header: 'Reward',
                render: (c) => {
                  const repNote =
                    c.effectiveCreditReward > c.creditReward
                      ? ` (${c.effectiveCreditReward.toLocaleString()} cr incl. rep bonus)`
                      : ` (${c.effectiveCreditReward.toLocaleString()} cr)`
                  return `${c.creditReward.toLocaleString()} cr base · +${c.reputationReward} rep${repNote}`
                }
              },
              {
                key: 'prog',
                header: 'Progress',
                render: (c) =>
                  c.accepted ? `${c.progress}/${c.target}` : <span className="muted">Not accepted</span>
              },
              {
                key: 'exp',
                header: 'Expires',
                numeric: true,
                render: (c) => `Day ${c.expiresAtTick}`
              },
              {
                key: 'act',
                header: '',
                render: (c) => (
                  <span className="form-line">
                    {!c.accepted && (
                      <button onClick={() => void acceptContractMut.run(c.id)}>Accept</button>
                    )}
                    {c.completable && (
                      <button className="primary" onClick={() => void completeContractMut.run(c.id)}>
                        Complete
                      </button>
                    )}
                    <button onClick={() => void abandonContractMut.run(c.id)}>Abandon</button>
                  </span>
                )
              }
            ]}
          />
        </div>
      )}

      {d && d.productionJobs.length > 0 && (
        <div className="panel" style={{ marginTop: 16 }}>
          <h3>Production Jobs</h3>
          <DataTable
            rows={d.productionJobs}
            rowKey={(j) => j.id}
            columns={[
              { key: 'building', header: 'Building', render: (j) => j.buildingName },
              { key: 'recipe', header: 'Recipe', render: (j) => j.recipeName },
              {
                key: 'prog',
                header: 'Progress',
                numeric: true,
                render: (j) =>
                  j.status === 'queued' ? 'queued' : `${j.progress}/${j.duration}`
              },
              { key: 'status', header: 'Status', render: (j) => <span className="tag">{j.status}</span> }
            ]}
          />
        </div>
      )}

      <div className="panel" style={{ marginTop: 16 }}>
        <h3>Last Tick Report</h3>
        {lastTick ? (
          <>
            <div className="badges" style={{ marginBottom: 8 }}>
              <span className="tag">Day {lastTick.tick}</span>
              <span className="tag green">{lastTick.completedProductionJobs} jobs finished</span>
              <span className="tag">{lastTick.completedTransportJobs} deliveries</span>
              <span className="tag yellow">{lastTick.trades} trades</span>
              <span className="tag">{lastTick.regionalTrades} NPC convoys</span>
              <span className="tag">{lastTick.newEvents} events</span>
            </div>
            {lastTickEvents.length > 0 ? (
              <ul className="ticklog">
                {lastTickEvents.map((e) => (
                  <li key={e.id}>{e.message}</li>
                ))}
              </ul>
            ) : (
              <p className="muted">Nothing eventful happened this day.</p>
            )}

            {whyTodayDigest.length > 0 && (
              <>
                <div className="subhead">Why today</div>
                <ul className="ticklog">
                  {whyTodayDigest.map((ex, i) => (
                    <li key={`${ex.code}-${i}`}>
                      <ExplanationLine explanation={ex} showTitle />
                    </li>
                  ))}
                </ul>
              </>
            )}

            <div className="subhead">Market changes</div>
            {lastTick.marketChanges.length > 0 ? (
              <ul className="ticklog">
                {lastTick.marketChanges.map((c) => (
                  <MarketChangeLine key={`${c.systemId}:${c.itemId}`} change={c} />
                ))}
              </ul>
            ) : (
              <p className="muted">No notable price movements this day (stable markets).</p>
            )}

            <div className="subhead">Detailed activity</div>
            {lastTick.log.length > 0 ? (
              <ul className="ticklog">
                {lastTick.log.map((entry) => (
                  <ActivityLogLine key={entry.id} entry={entry} />
                ))}
              </ul>
            ) : (
              <p className="muted">No detailed log lines for this tick.</p>
            )}
          </>
        ) : (
          <p className="muted">Run a tick to see a day-by-day report of what changed.</p>
        )}

        {tickLog.length > 1 && (
          <>
            <div className="subhead">Recent days</div>
            <ul className="ticklog">
              {tickLog.map((t, i) => (
                <li key={`${t.tick}-${i}`}>
                  <span className="day">Day {t.tick}</span>
                  {t.completedProductionJobs} jobs · {t.completedTransportJobs} deliveries ·{' '}
                  {t.trades} trades · {t.newEvents} events
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="panel">
        <h3>Event Log (all)</h3>
        <DataTable<EventLogView>
          rows={allEvents.slice(0, 20)}
          rowKey={(r) => r.id}
          empty="No events yet. Run a few ticks."
          columns={[
            { key: 'tick', header: 'Day', numeric: true, render: (r) => r.tick },
            {
              key: 'msg',
              header: 'Event',
              render: (r) => (
                <span>
                  {r.message}
                  {r.explanation && <ExplanationLine explanation={r.explanation} />}
                </span>
              )
            }
          ]}
        />
      </div>
    </div>
  )
}

function ObjectivesPanel({ objectives }: { objectives: ObjectiveView[] }): React.JSX.Element {
  const active = objectives.filter((o) => o.status === 'active' && !o.optional)
  const optional = objectives.filter((o) => o.status === 'active' && o.optional)
  const upcoming = objectives.filter((o) => o.status === 'locked')
  const completed = objectives.filter((o) => o.status === 'completed')

  return (
    <div className="panel" style={{ marginTop: 16 }}>
      <h3>Objectives</h3>
      {active.length > 0 && (
        <div className="objective-list">
          {active.map((o, i) => (
            <ObjectiveRow key={o.id} objective={o} highlight={i === 0} />
          ))}
        </div>
      )}
      {optional.length > 0 && (
        <>
          <div className="subhead">Optional</div>
          <div className="objective-list">
            {optional.map((o) => (
              <ObjectiveRow key={o.id} objective={o} />
            ))}
          </div>
        </>
      )}
      {upcoming.length > 0 && (
        <>
          <div className="subhead">Upcoming</div>
          <div className="objective-list">
            {upcoming.map((o) => (
              <ObjectiveRow key={o.id} objective={o} muted />
            ))}
          </div>
        </>
      )}
      {completed.length > 0 && (
        <>
          <div className="subhead">Completed</div>
          <div className="objective-list">
            {completed.map((o) => (
              <ObjectiveRow key={o.id} objective={o} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function ObjectiveRow({
  objective: o,
  highlight = false,
  muted = false
}: {
  objective: ObjectiveView
  highlight?: boolean
  muted?: boolean
}): React.JSX.Element {
  const pct = o.target > 0 ? Math.min(100, Math.round((o.current / o.target) * 100)) : 0
  const className = [
    'objective-row',
    o.completed ? 'completed' : '',
    highlight ? 'current-goal' : '',
    muted ? 'upcoming' : ''
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <div className={className}>
      <div className="objective-head">
        <strong>{o.title}</strong>
        {o.completed ? (
          <span className="tag green">Done</span>
        ) : muted ? (
          <span className="tag">Locked</span>
        ) : (
          <span className="mono">
            {o.current.toLocaleString()} / {o.target.toLocaleString()}
          </span>
        )}
      </div>
      <p className="muted">{o.description}</p>
      {o.explanation && <ExplanationLine explanation={o.explanation} />}
      {!muted && (
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  )
}

function MarketChangeLine({ change: c }: { change: MarketChangeEntry }): React.JSX.Element {
  const explanation = explainMarketChange(c)
  return (
    <li>
      <span className="mono">
        {c.systemName} · {c.itemName}
      </span>
      {' — '}
      {formatPriceChange(c.priceChange, c.priceChangePercent)} → {c.price} cr
      {' · '}
      <span className="tag">{c.reasonLabel}</span>{' '}
      <span className={trendTagClass(c.trend)}>{formatTrendLabel(c.trend)}</span>
      <ExplanationLine explanation={explanation} className="explanation-line muted" />
    </li>
  )
}

function logCategoryClass(category: GameLogCategory): string {
  return `log-cat log-cat-${category}`
}

function ActivityLogLine({ entry }: { entry: GameLogEntry }): React.JSX.Element {
  const label = LOG_CATEGORY_LABELS[entry.category] ?? entry.category
  return (
    <li>
      <span className={logCategoryClass(entry.category)}>{label}</span>{' '}
      {entry.message}
    </li>
  )
}
