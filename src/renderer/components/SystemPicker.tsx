import React, { useMemo, useState } from 'react'
import type { FactionId, SystemSummary } from '../../shared/types'

type SystemSort = 'name' | 'distance' | 'planets'

export interface SystemPickerProps {
  systems: SystemSummary[]
  value: string | null
  onChange: (systemId: string) => void
  id?: string
  label?: string
  /** When set, highlights the home system in the list. */
  homeSystemId?: string | null
}

function factionLabel(factionId: FactionId | null | undefined): string {
  if (!factionId) return '—'
  return factionId.replace(/^faction_/, '').replace(/_/g, ' ')
}

export function SystemPicker({
  systems,
  value,
  onChange,
  id = 'system-picker',
  label = 'System',
  homeSystemId
}: SystemPickerProps): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SystemSort>('name')
  const [factionFilter, setFactionFilter] = useState<string>('')

  const factions = useMemo(() => {
    const ids = new Set<string>()
    for (const s of systems) {
      if (s.controllingFactionId) ids.add(s.controllingFactionId)
    }
    return [...ids].sort((a, b) => a.localeCompare(b))
  }, [systems])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let rows = systems.filter((s) => {
      if (factionFilter && s.controllingFactionId !== factionFilter) return false
      if (!q) return true
      return s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q)
    })
    rows = [...rows].sort((a, b) => {
      switch (sort) {
        case 'distance':
          return (a.distanceFromHome ?? 0) - (b.distanceFromHome ?? 0) || a.name.localeCompare(b.name)
        case 'planets':
          return b.planetCount - a.planetCount || a.name.localeCompare(b.name)
        default:
          return a.name.localeCompare(b.name)
      }
    })
    return rows
  }, [systems, query, sort, factionFilter])

  const selectedInList = value != null && filtered.some((s) => s.id === value)

  return (
    <div className="system-picker">
      <div className="form-line">
        <label htmlFor={`${id}-search`}>{label}</label>
        <input
          id={`${id}-search`}
          type="search"
          placeholder="Filter by name or id…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ minWidth: 180 }}
        />
        <label htmlFor={`${id}-sort`}>Sort</label>
        <select id={`${id}-sort`} value={sort} onChange={(e) => setSort(e.target.value as SystemSort)}>
          <option value="name">Name</option>
          <option value="distance">Distance from home</option>
          <option value="planets">Planet count</option>
        </select>
        {factions.length > 1 && (
          <>
            <label htmlFor={`${id}-faction`}>Faction</label>
            <select
              id={`${id}-faction`}
              value={factionFilter}
              onChange={(e) => setFactionFilter(e.target.value)}
            >
              <option value="">All factions</option>
              {factions.map((f) => (
                <option key={f} value={f}>
                  {factionLabel(f)}
                </option>
              ))}
            </select>
          </>
        )}
      </div>
      <div className="form-line">
        <label htmlFor={id}>Choose</label>
        <select
          id={id}
          value={selectedInList ? (value ?? '') : ''}
          onChange={(e) => onChange(e.target.value)}
          style={{ minWidth: 220 }}
        >
          {!selectedInList && value && (
            <option value={value}>{value} (hidden by filter)</option>
          )}
          {filtered.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.isHome || s.id === homeSystemId ? ' ★' : ''}
              {s.distanceFromHome != null && s.distanceFromHome > 0
                ? ` — ${s.distanceFromHome} ly`
                : ''}
              {` — ${s.planetCount} planet${s.planetCount === 1 ? '' : 's'}`}
            </option>
          ))}
        </select>
        <span className="muted">{filtered.length} of {systems.length} systems</span>
      </div>
    </div>
  )
}
