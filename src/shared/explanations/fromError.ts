import type { ErrorCode, IpcError } from '../errors.js'
import { buildExplanation } from './text.js'
import type { ErrorExplanationCode, Explanation } from './types.js'

const CODE_MAP: Record<ErrorCode, ErrorExplanationCode> = {
  VALIDATION: 'error.validation',
  NOT_FOUND: 'error.not_found',
  CONFLICT: 'error.conflict',
  NO_CAMPAIGN: 'error.no_campaign',
  MOD_VALIDATION: 'error.mod_validation',
  INTERNAL: 'error.internal'
}

/** Known message patterns → specific market explanation codes (tested). */
const MESSAGE_PATTERNS: Array<{ pattern: RegExp; code: ErrorExplanationCode | 'market.trade.blocked.no_liquidity' | 'market.trade.blocked.insufficient_inventory' | 'market.trade.blocked.insufficient_credits' }> = [
  {
    pattern: /not enough .+ liquidity on the market/i,
    code: 'market.trade.blocked.no_liquidity'
  },
  {
    pattern: /no available .+ to sell/i,
    code: 'market.trade.blocked.insufficient_inventory'
  },
  {
    pattern: /not enough .+ to sell/i,
    code: 'market.trade.blocked.insufficient_inventory'
  },
  {
    pattern: /not enough credits/i,
    code: 'market.trade.blocked.insufficient_credits'
  }
]

function resolveSpecificCode(error: IpcError): ErrorExplanationCode | 'market.trade.blocked.no_liquidity' | 'market.trade.blocked.insufficient_inventory' | 'market.trade.blocked.insufficient_credits' {
  const base = CODE_MAP[error.code] ?? 'error.unknown'
  if (error.code !== 'VALIDATION') return base
  for (const { pattern, code } of MESSAGE_PATTERNS) {
    if (pattern.test(error.message)) return code
  }
  return base
}

/**
 * Map an IPC error to a player-facing explanation.
 * Uses error code first; message patterns only for known tested cases.
 * Unknown cases keep the original message without inventing a specific cause.
 */
export function explainFromError(error: IpcError): Explanation {
  const code = resolveSpecificCode(error)
  if (code.startsWith('market.trade.')) {
    return buildExplanation(code, { rawMessage: error.message })
  }
  if (code === 'error.unknown') {
    return buildExplanation('error.unknown', { rawMessage: error.message }, { severity: 'warning' })
  }
  return buildExplanation(code, { rawMessage: error.message })
}

/** Format error for StatusBanner: title on first line optional, or combined string. */
export function formatExplainedError(error: IpcError): string {
  const ex = explainFromError(error)
  if (ex.title && ex.message !== ex.title) {
    return `${ex.title}: ${ex.message}`
  }
  return ex.message
}
