export type {
  Explanation,
  ExplanationCode,
  ExplanationSeverity,
  MarketExplanationCode,
  ProductionExplanationCode,
  LogisticsExplanationCode,
  EventExplanationCode,
  ObjectiveExplanationCode,
  ContractExplanationCode,
  ErrorExplanationCode,
  StockpileContext,
  EventEligibilityResult
} from './types.js'
export { TICK_DIGEST_MAX } from './types.js'
export { buildExplanation } from './text.js'
export type { ExplanationTextParams } from './text.js'
export {
  explainMarketChange,
  explainPriceDiagnostics,
  marketExplanationCode
} from './market.js'
export { explainFromError, formatExplainedError } from './fromError.js'
export {
  explainEventFired,
  explainEventBlockedFromResult,
  explainEventLogSubline
} from './events.js'
export { explainObjectiveView, explainContractMinTickGate } from './objectives.js'
export { explainProductionBlock, explainIdleBuilding, explainQueuedJobBlock } from './production.js'
export {
  explainTransportBlockFromMessage,
  explainTransportInTransit
} from './logistics.js'
export { buildTickDigest } from './digest.js'
