/**
 * Print StarMapView JSON for a campaign save (headless, no Electron UI).
 * Usage: node scripts/dump-star-map.mjs <path-to-save.sqlite>
 */
import { existsSync } from 'node:fs'
import { openDatabase, closeDatabase } from '../src/database/db.js'
import { loadCampaign } from '../src/database/saveManager.js'
import { buildStarMapView } from '../src/simulation/starMapView.js'

const savePath = process.argv[2]
if (!savePath || !existsSync(savePath)) {
  console.error('Usage: node scripts/dump-star-map.mjs <path-to-save.sqlite>')
  process.exit(1)
}

const db = openDatabase(savePath)
try {
  const state = loadCampaign(db)
  const view = buildStarMapView(state)
  console.log(JSON.stringify(view, null, 2))
} finally {
  closeDatabase(db)
}
