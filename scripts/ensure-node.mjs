/**
 * Node-side helper: resolve node.exe path and verify major version.
 * Used by ensure-deps.mjs when Node is already running.
 */
import { existsSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const NODE_PATH_FILE = join(root, 'scripts', '.node-path.txt')
const MIN_MAJOR = 22

export function readCachedNodePath() {
  if (!existsSync(NODE_PATH_FILE)) return null
  const path = readFileSync(NODE_PATH_FILE, 'utf8').trim()
  return path || null
}

export function nodeMajor(nodeExe = process.execPath) {
  const result = spawnSync(nodeExe, ['--version'], { encoding: 'utf8' })
  if (result.status !== 0) return null
  const match = /^v(\d+)/.exec(String(result.stdout).trim())
  return match ? Number(match[1]) : null
}

export function isNodeVersionOk(nodeExe = process.execPath) {
  const major = nodeMajor(nodeExe)
  return major !== null && major >= MIN_MAJOR
}
