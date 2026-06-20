import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import { formatApiErrorMessage, isNoCampaignError } from './campaignRequired'
import { useApp } from './context'
import type { SmartTickMode, TickResult } from '../shared/types'

interface AsyncState<T> {
  data: T | null
  error: string | null
  loading: boolean
  reload: () => void
}

interface ApiMutationState {
  error: string | null
  notice: string | null
  pending: boolean
  run: () => Promise<void>
  clearMessages: () => void
  setNotice: (msg: string | null) => void
}

/** Run an async loader on mount and whenever `deps` change; expose reload. */
export function useAsync<T>(
  loader: () => Promise<T>,
  deps: unknown[],
  onNoCampaign?: () => void
): AsyncState<T> {
  const { handleApiError } = useApp()
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [nonce, setNonce] = useState(0)

  const reload = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    loader()
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        if (onNoCampaign && isNoCampaignError(e)) {
          setData(null)
          setError(null)
          onNoCampaign()
          return
        }
        const msg = handleApiError(e) ?? formatApiErrorMessage(e)
        setError(msg)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce, onNoCampaign, handleApiError])

  return { data, error, loading, reload }
}

/** useAsync wired to recover when a campaign-required API returns NO_CAMPAIGN. */
export function useCampaignAsync<T>(loader: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const { recoverNoCampaign } = useApp()
  return useAsync(loader, deps, recoverNoCampaign)
}

/** Wrap a campaign mutation with shared error/notice/pending handling. */
export function useApiMutation(
  action: () => Promise<unknown>,
  options?: {
    successMessage?: string
    onSuccess?: () => void
  }
): ApiMutationState {
  const { handleApiError } = useApp()
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const successMessage = options?.successMessage
  const onSuccess = options?.onSuccess

  const clearMessages = useCallback(() => {
    setError(null)
    setNotice(null)
  }, [])

  const run = useCallback(async () => {
    setError(null)
    setNotice(null)
    setPending(true)
    try {
      await action()
      if (successMessage) setNotice(successMessage)
      onSuccess?.()
    } catch (e) {
      const msg = handleApiError(e)
      if (msg) setError(msg)
    } finally {
      setPending(false)
    }
  }, [action, handleApiError, successMessage, onSuccess])

  return { error, notice, pending, run, clearMessages, setNotice }
}

interface ApiMutationWithArgState<TArg> {
  error: string | null
  notice: string | null
  pending: boolean
  run: (arg: TArg) => Promise<void>
  clearMessages: () => void
}

/** Wrap a parameterized campaign mutation with shared error/notice/pending handling. */
export function useApiMutationWithArg<TArg, TResult = unknown>(
  action: (arg: TArg) => Promise<TResult>,
  options?: {
    successMessage?: string | ((arg: TArg, result: TResult) => string)
    onSuccess?: (result: TResult, arg: TArg) => void
  }
): ApiMutationWithArgState<TArg> {
  const { handleApiError, refresh } = useApp()
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const onSuccess = options?.onSuccess

  const clearMessages = useCallback(() => {
    setError(null)
    setNotice(null)
  }, [])

  const run = useCallback(
    async (arg: TArg) => {
      setError(null)
      setNotice(null)
      setPending(true)
      try {
        const result = await action(arg)
        const msg = options?.successMessage
        if (msg) setNotice(typeof msg === 'function' ? msg(arg, result) : msg)
        if (onSuccess) onSuccess(result, arg)
        else refresh()
      } catch (e) {
        const msg = handleApiError(e)
        if (msg) setError(msg)
      } finally {
        setPending(false)
      }
    },
    [action, handleApiError, onSuccess, options?.successMessage, refresh]
  )

  return { error, notice, pending, run, clearMessages }
}

interface TickControlsState {
  tickLog: TickResult[]
  ticking: boolean
  error: string | null
  notice: string | null
  lastTick: TickResult | null
  setNotice: (msg: string | null) => void
  runTick: () => Promise<void>
  runWeek: () => Promise<void>
  runSmart: (mode: SmartTickMode) => Promise<void>
}

/** Shared tick runner for Dashboard and Star Map pages. */
export function useTickControls(): TickControlsState {
  const { refresh, handleApiError } = useApp()
  const [tickLog, setTickLog] = useState<TickResult[]>([])
  const [ticking, setTicking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const pushResult = useCallback(
    (result: TickResult) => {
      setTickLog((log) => [result, ...log].slice(0, 12))
      refresh()
    },
    [refresh]
  )

  const runWithTick = useCallback(
    async (fn: () => Promise<TickResult>, clearNoticeOnStart = false) => {
      if (ticking) return
      setTicking(true)
      setError(null)
      if (clearNoticeOnStart) setNotice(null)
      try {
        const result = await fn()
        pushResult(result)
      } catch (e) {
        const msg = handleApiError(e)
        if (msg) setError(msg)
      } finally {
        setTicking(false)
      }
    },
    [ticking, handleApiError, pushResult]
  )

  return {
    tickLog,
    ticking,
    error,
    notice,
    lastTick: tickLog[0] ?? null,
    setNotice,
    runTick: () => runWithTick(() => api.runTick()),
    runWeek: () => runWithTick(() => api.runTicks(7)),
    runSmart: (mode) => runWithTick(() => api.runTicksSmart({ mode, maxDays: 30 }), true)
  }
}

/** Convenience hook for mutation handlers on campaign-dependent pages. */
export function useCampaignRequired() {
  const { recoverNoCampaign, handleApiError, campaignActive, page } = useApp()
  return { recoverNoCampaign, handleApiError, campaignActive, page }
}
