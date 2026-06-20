import { cpSync, copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { app, BrowserWindow, ipcMain } from 'electron'
import { IPC_CHANNEL } from '../shared/constants.js'
import { safeDispatch } from './dispatch.js'
import { GameService } from './gameService.js'
import { logError } from './log.js'

// Electron main process. Owns the GameService and exposes it to the renderer
// through a SINGLE typed IPC channel (renderer never touches Node directly).

/**
 * Resolved on-disk locations the game reads/writes at runtime.
 *
 * Two distinct locations matter in a packaged (portable) build:
 *  - The READ-ONLY SEED bundled with the app, reached via `process.resourcesPath`
 *    (electron-builder copies `extraResources` there). Used ONLY for first-run
 *    seeding — never read as live game data.
 *  - The EDITABLE PLAYER FOLDERS beside the .exe, located via
 *    `PORTABLE_EXECUTABLE_DIR`. All live content (data/vanilla, mods, saves) is
 *    read from here so players can freely edit the JSON.
 */
export interface ResolvedGamePaths {
  baseDir: string
  savesDir: string
  dataDir: string
  vanillaDir: string
  modsDir: string
  /** Bundled read-only seed dirs (packaged mode only). */
  bundledDataDir?: string
  bundledModsDir?: string
}

/** Opt-in path diagnostics. Off by default so production builds stay quiet. */
const DEBUG_PATHS = process.env['GE_DEBUG_PATHS'] === '1'

function packagedBaseDir(): string {
  // In electron-builder Windows portable builds, PORTABLE_EXECUTABLE_DIR points
  // to the folder containing the actual .exe the player launched. The exe path
  // itself resolves into a temp extraction, so it is only a fallback.
  return process.env['PORTABLE_EXECUTABLE_DIR'] ?? dirname(app.getPath('exe'))
}

/** Copy a seed dir to its destination only if the destination is absent. */
function seedIfMissing(src: string, dest: string): boolean {
  if (!existsSync(src)) return false
  if (existsSync(dest)) return false // never overwrite user-edited content
  mkdirSync(dirname(dest), { recursive: true })
  cpSync(src, dest, { recursive: true })
  return true
}

function readVanillaContentVersion(dataRoot: string): number {
  const path = join(dataRoot, 'vanilla', 'content_version.json')
  if (!existsSync(path)) return 0
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as { version?: number }
    return typeof parsed.version === 'number' ? parsed.version : 0
  } catch {
    return 0
  }
}

/** Merge-update vanilla JSON beside the exe when the bundled seed is newer. */
function upgradeVanillaIfNeeded(bundledDataDir: string, dataDir: string): boolean {
  const bundledVersion = readVanillaContentVersion(bundledDataDir)
  const localVersion = readVanillaContentVersion(dataDir)
  if (bundledVersion <= localVersion) return false

  const srcVanilla = join(bundledDataDir, 'vanilla')
  const destVanilla = join(dataDir, 'vanilla')
  if (!existsSync(srcVanilla)) return false

  mkdirSync(destVanilla, { recursive: true })
  for (const entry of readdirSync(srcVanilla)) {
    const src = join(srcVanilla, entry)
    if (statSync(src).isFile()) {
      copyFileSync(src, join(destVanilla, entry))
    }
  }

  if (DEBUG_PATHS) {
    console.log(`[paths] upgraded vanilla content v${localVersion} → v${bundledVersion}`)
  }
  return true
}

function resolvePaths(): ResolvedGamePaths {
  if (app.isPackaged) {
    const baseDir = packagedBaseDir()
    const bundledDataDir = join(process.resourcesPath, 'data')
    const bundledModsDir = join(process.resourcesPath, 'mods')
    const dataDir = join(baseDir, 'data')
    const modsDir = join(baseDir, 'mods')
    const savesDir = join(baseDir, 'saves')

    // First-run: materialize editable copies beside the exe from the read-only seed.
    const seededData = seedIfMissing(bundledDataDir, dataDir)
    const seededMods = seedIfMissing(bundledModsDir, modsDir)
    const upgradedVanilla = upgradeVanillaIfNeeded(bundledDataDir, dataDir)
    mkdirSync(savesDir, { recursive: true })

    const paths: ResolvedGamePaths = {
      baseDir,
      savesDir,
      dataDir,
      vanillaDir: join(dataDir, 'vanilla'),
      modsDir,
      bundledDataDir,
      bundledModsDir
    }
    if (DEBUG_PATHS) {
      // Temporary diagnostics (packaged), gated behind GE_DEBUG_PATHS=1.
      console.log('[paths] baseDir            =', baseDir)
      console.log('[paths] process.resourcesPath =', process.resourcesPath)
      console.log('[paths] dataDir            =', dataDir)
      console.log('[paths] modsDir            =', modsDir)
      console.log('[paths] savesDir           =', savesDir)
      console.log('[paths] data seeded?       =', seededData)
      console.log('[paths] mods seeded?       =', seededMods)
      console.log('[paths] vanilla upgraded?  =', upgradedVanilla)
    }
    return paths
  }

  // Development mode: content stays editable in the project root (unchanged).
  const baseDir = resolve(process.cwd())
  const paths: ResolvedGamePaths = {
    baseDir,
    savesDir: join(baseDir, 'saves'),
    dataDir: join(baseDir, 'data'),
    vanillaDir: join(baseDir, 'data', 'vanilla'),
    modsDir: join(baseDir, 'mods')
  }
  if (DEBUG_PATHS) {
    console.log('[paths] (dev) baseDir =', baseDir)
  }
  return paths
}

const service = new GameService(resolvePaths())

const SQLITE_PROBE = process.argv.includes('--sqlite-probe')

// Last-resort handlers: log instead of dying silently. IPC calls are already
// wrapped by safeDispatch, so anything landing here escaped a non-IPC path.
process.on('uncaughtException', (err) => {
  logError('Uncaught exception in main process', err)
})
process.on('unhandledRejection', (reason) => {
  logError('Unhandled promise rejection in main process', reason)
})

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    backgroundColor: '#0d1117',
    title: 'Stellar Ledger',
    webPreferences: {
      preload: join(__dirname, '../preload/preload.cjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    void win.loadURL(devUrl)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  if (SQLITE_PROBE) {
    try {
      type SqliteDb = { close(): void }
      type SqliteConstructor = new (path: string) => SqliteDb
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Database = require('better-sqlite3') as SqliteConstructor
      const db = new Database(':memory:')
      db.close()
      console.log(`OK SQLite ABI ${process.versions.modules}`)
      app.exit(0)
    } catch (err) {
      console.error('FAIL', err instanceof Error ? err.message : String(err))
      app.exit(1)
    }
    return
  }

  ipcMain.handle(IPC_CHANNEL, (_event, method: string, payload: unknown) =>
    safeDispatch(service, method, payload)
  )
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  service.close()
  if (process.platform !== 'darwin') app.quit()
})
