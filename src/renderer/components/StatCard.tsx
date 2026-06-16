import React from 'react'

export function StatCard({ label, value }: { label: string; value: React.ReactNode }): React.JSX.Element {
  return (
    <div className="stat-card">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  )
}
