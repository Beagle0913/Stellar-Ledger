import React, { useState } from 'react'
import { useApp } from '../context'
import { LinkButton } from './LinkButton'
import { STARTING_CREDITS } from '../../shared/balance'

const STORAGE_KEY = 'tutorial.collapsed'

/**
 * First-goal tutorial. Explains the core economic loop and links to the pages
 * needed to follow it. Collapsible; the collapsed state persists in localStorage
 * so veteran players are not nagged. Content is intentionally static text.
 */
export function TutorialPanel({ credits }: { credits: number | null }): React.JSX.Element {
  const { navigate } = useApp()
  const [collapsed, setCollapsed] = useState<boolean>(
    () => localStorage.getItem(STORAGE_KEY) === '1'
  )

  function toggle(): void {
    setCollapsed((c) => {
      const next = !c
      localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
      return next
    })
  }

  return (
    <div className="panel tutorial">
      <div className="panel-head">
        <h3>Getting Started — Your First Goal</h3>
        <button onClick={toggle}>{collapsed ? 'Show' : 'Hide'}</button>
      </div>

      {!collapsed && (
        <>
          <p className="muted" style={{ marginTop: 8 }}>
            You run a corporation with{' '}
            <span className="mono">{(credits ?? STARTING_CREDITS).toLocaleString()} cr</span>. Turn raw ore
            into refined metal, sell it for a profit, and reinvest. The whole economy advances only
            when you press <strong>Run 1 Day Tick</strong>.
          </p>
          <ol>
            <li>
              <span className="goal">Produce metal from ore.</span> On{' '}
              <LinkButton onClick={() => navigate('production')}>Production</LinkButton>
              , start <em>Metal Smelting</em> in your Refinery (4 Ore + 2 Energy → 2 Metal). You
              begin with plenty of ore and energy.
            </li>
            <li>
              Press <strong>Run 1 Day Tick</strong> here on the Dashboard until the job completes
              (it takes 2 days). Watch the <em>Last Tick Report</em>.
            </li>
            <li>
              <span className="goal">Sell metal for profit.</span> On{' '}
              <LinkButton onClick={() => navigate('market')}>Market</LinkButton>
              , place a <em>sell</em> order for your metal at or below the best bid, then run a tick
              to let it match.
            </li>
            <li>
              <span className="goal">Run your first convoy.</span> On{' '}
              <LinkButton onClick={() => navigate('logistics')}>Logistics</LinkButton>
              , send your Hauler to carry cargo to another system. Optional faction{' '}
              <em>contracts</em> on the Dashboard pay extra for deliveries and sales.
            </li>
            <li>
              <span className="goal">Expand.</span> Reinvest your profit into a second ship and more
              production on the{' '}
              <LinkButton onClick={() => navigate('starmap')}>Star Map</LinkButton>
              {' '}or{' '}
              <LinkButton onClick={() => navigate('system')}>Systems</LinkButton>
              {' '}page → pick a planet, and scale up.
            </li>
          </ol>
        </>
      )}
    </div>
  )
}
