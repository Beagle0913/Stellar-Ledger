// Small deterministic-friendly id helpers. The simulation core stays deterministic
// by NOT calling these inside tick math; ids are only minted at the edges
// (creating orders/jobs from user actions) where non-determinism is acceptable.

let counter = 0

/** Monotonic, process-local unique id with a readable prefix. */
export function newId(prefix: string): string {
  counter += 1
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`
}

/** Deterministic market id for a system (one local market per system). */
export function marketIdForSystem(systemId: string): string {
  return `market_${systemId}`
}
