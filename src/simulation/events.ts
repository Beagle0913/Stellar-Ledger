// Re-exports the data-driven event pipeline (handlers live in eventRegistry.ts).

export {
  applyEventEffect,
  eventEligible,
  processEvents,
  triggerFires
} from './eventRegistry.js'
