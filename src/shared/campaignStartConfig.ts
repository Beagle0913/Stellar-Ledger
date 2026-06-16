import type { CampaignStartConfig } from './types/definitions.js'

/** Engine defaults for new campaigns (overridable via mod `campaign_start.json`). */
export const DEFAULT_CAMPAIGN_START_CONFIG: CampaignStartConfig = {
  startingCredits: 38_000,
  startingStock: {
    ore: 140,
    food: 80,
    fuel: 80,
    machinery: 25,
    energy: 65
  },
  startingBuildingTypes: ['power_plant', 'mine', 'refinery', 'farm', 'machinery_factory'],
  homePlanetMinHabitability: 0.5
}

/** Merge mod overrides onto defaults. */
export function mergeCampaignStartConfig(
  partial: Partial<CampaignStartConfig> | null | undefined
): CampaignStartConfig {
  if (!partial) return { ...DEFAULT_CAMPAIGN_START_CONFIG, startingStock: { ...DEFAULT_CAMPAIGN_START_CONFIG.startingStock } }
  return {
    ...DEFAULT_CAMPAIGN_START_CONFIG,
    ...partial,
    startingStock: {
      ...DEFAULT_CAMPAIGN_START_CONFIG.startingStock,
      ...partial.startingStock
    },
    startingBuildingTypes: partial.startingBuildingTypes ?? DEFAULT_CAMPAIGN_START_CONFIG.startingBuildingTypes
  }
}
