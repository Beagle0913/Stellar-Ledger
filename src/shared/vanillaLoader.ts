import { join } from 'node:path'
import { loadModFromDir } from '../mods/modLoader.js'
import { mergeMods } from '../mods/mergeMods.js'
import type { GameDefinitions } from './types.js'

/** Default path to built-in vanilla content (relative to process cwd). */
export const VANILLA_DIR = join(process.cwd(), 'data', 'vanilla')

/** Load merged vanilla game definitions (no database). */
export function loadVanillaDefinitions(dataRoot = VANILLA_DIR): GameDefinitions {
  const vanilla = loadModFromDir(dataRoot, 'builtin')
  return mergeMods([vanilla])
}
