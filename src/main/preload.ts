import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNEL } from '../shared/constants.js'
import { IPC_METHOD_SPECS } from '../shared/ipcMethods.js'
import type { GameApi } from '../shared/types.js'

// The preload runs in an isolated context and is the ONLY bridge between the
// renderer and the main process. It exposes a typed, minimal API; the renderer
// has no direct access to Node or Electron internals.

function call<T>(method: string, payload?: unknown): Promise<T> {
  return ipcRenderer.invoke(IPC_CHANNEL, method, payload) as Promise<T>
}

function buildApiMethod(name: string, hasPayload: boolean): GameApi[keyof GameApi] {
  if (name === 'renameSave') {
    return ((fileName: string, newName: string) =>
      call('renameSave', { fileName, newName })) as GameApi['renameSave']
  }
  if (hasPayload) {
    return ((payload: unknown) => call(name, payload)) as GameApi[keyof GameApi]
  }
  return (() => call(name)) as GameApi[keyof GameApi]
}

const api = Object.fromEntries(
  IPC_METHOD_SPECS.map(({ name, hasPayload }) => [name, buildApiMethod(name, hasPayload)])
) as GameApi

contextBridge.exposeInMainWorld('api', api)
