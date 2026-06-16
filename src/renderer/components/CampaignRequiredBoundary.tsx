import React from 'react'
import { isCampaignRequiredPage } from '../campaignRequired'
import { useApp, type PageId } from '../context'
import { NoCampaignPanel } from './NoCampaignPanel'

interface Props {
  page: PageId
  children: React.ReactNode
}

/**
 * Guards campaign-dependent pages. When campaignActive is false, shows the
 * friendly empty state instead of mounting page loaders that would hit NO_CAMPAIGN.
 */
export function CampaignRequiredBoundary({ page, children }: Props): React.JSX.Element {
  const { campaignActive } = useApp()
  if (!isCampaignRequiredPage(page)) return <>{children}</>
  if (!campaignActive) return <NoCampaignPanel />
  return <>{children}</>
}
