import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

// electron-vite produces three bundles:
//  - main:     Node-side Electron entry (src/main/main.ts)
//  - preload:  contextBridge script (src/main/preload.ts)
//  - renderer: the React app (src/renderer)
// Native deps (better-sqlite3) and electron are externalized for main/preload.
export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'out/main',
      lib: {
        entry: resolve(__dirname, 'src/main/main.ts'),
        formats: ['cjs'],
        fileName: () => 'main.js'
      },
      rollupOptions: {
        output: { entryFileNames: 'main.js' }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'out/preload',
      lib: {
        entry: resolve(__dirname, 'src/main/preload.ts'),
        formats: ['cjs'],
        fileName: () => 'preload.cjs'
      },
      rollupOptions: {
        output: { entryFileNames: 'preload.cjs' }
      }
    }
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    build: {
      outDir: resolve(__dirname, 'out/renderer'),
      rollupOptions: {
        input: resolve(__dirname, 'src/renderer/index.html')
      }
    },
    plugins: [react()]
  }
})
