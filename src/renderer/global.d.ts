import type { GameApi } from '../shared/types'

// The preload exposes the typed game API on window.api via contextBridge.
declare global {
  interface Window {
    api: GameApi
  }
}

export {}
