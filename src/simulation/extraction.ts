import type { PlanetDefinition, RecipeDefinition } from '../shared/types.js'

// Extraction yield scaling. Resource-extraction recipes (mining, farming, power)
// produce more or less depending on the planet they run on. WHICH planet stat
// matters is declared in the recipe data (`yieldStat`), so this logic never
// hardcodes item names (rule 6).

/** Minimum multiplier so a poorly-suited planet still produces a trickle. */
const MIN_YIELD = 0.25

/**
 * Multiplier applied to an extraction recipe's outputs on a given planet.
 * Non-extraction recipes (and extraction recipes without a yieldStat) return 1.
 */
export function extractionMultiplier(
  planet: PlanetDefinition,
  recipe: RecipeDefinition
): number {
  if (!recipe.extraction || !recipe.yieldStat) return 1
  const stat = planet[recipe.yieldStat]
  return Math.max(MIN_YIELD, stat)
}

/** Effective integer output quantity for one recipe run on a planet. */
export function effectiveOutput(
  planet: PlanetDefinition,
  recipe: RecipeDefinition,
  baseQuantity: number
): number {
  return Math.max(1, Math.floor(baseQuantity * extractionMultiplier(planet, recipe)))
}
