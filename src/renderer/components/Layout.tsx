import React from 'react'
import { SaveStatusBanner } from './SaveStatusBanner'
import type { SaveStatus } from '../../shared/types'

export interface NavItem {
  id: string
  label: string
}

interface LayoutProps {
  pages: NavItem[]
  active: string
  onNavigate: (id: string) => void
  footer: {
    campaignName: string
    credits: number
    tick: number
    saveStatus: SaveStatus
    saveError: string | null
  } | null
  children: React.ReactNode
}

export function Layout({
  pages,
  active,
  onNavigate,
  footer,
  children
}: LayoutProps): React.JSX.Element {
  return (
    <div className="layout">
      <nav className="sidebar">
        <h1>STELLAR LEDGER</h1>
        <div className="sub">economy prototype v0.1</div>
        {pages.map((p) => (
          <button
            key={p.id}
            className={`nav-btn ${p.id === active ? 'active' : ''}`}
            aria-current={p.id === active ? 'page' : undefined}
            onClick={() => onNavigate(p.id)}
          >
            {p.label}
          </button>
        ))}
        <div className="sidebar-footer">
          {footer ? (
            <>
              <div>{footer.campaignName}</div>
              <div className="credits">{footer.credits.toLocaleString()} cr</div>
              <div>Day {footer.tick}</div>
            </>
          ) : (
            <div>No campaign loaded</div>
          )}
        </div>
      </nav>
      <main className="content">
        {footer && (
          <SaveStatusBanner saveStatus={footer.saveStatus} saveError={footer.saveError} />
        )}
        {children}
      </main>
    </div>
  )
}
