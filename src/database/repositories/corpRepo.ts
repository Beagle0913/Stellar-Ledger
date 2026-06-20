import { GameError } from '../../shared/errors.js'
import type { DB } from '../db.js'
import type { Corporation } from '../../shared/types.js'

export function saveCorporations(db: DB, corporations: Corporation[]): void {
  const existing = db.prepare('SELECT id FROM corporations').all() as Array<{ id: string }>
  const ids = new Set(corporations.map((c) => c.id))
  for (const row of existing) {
    if (!ids.has(row.id)) {
      db.prepare('DELETE FROM corporations WHERE id = ?').run(row.id)
    }
  }
  const stmt = db.prepare(
    `INSERT INTO corporations (id, name, credits, home_system_id, ai_profile)
     VALUES (@id, @name, @credits, @home_system_id, @ai_profile)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name, credits=excluded.credits, home_system_id=excluded.home_system_id, ai_profile=excluded.ai_profile`
  )
  for (const corp of corporations) {
    stmt.run({
      id: corp.id,
      name: corp.name,
      credits: corp.credits,
      home_system_id: corp.homeSystemId,
      ai_profile: corp.aiProfile ?? null
    })
  }
}

export function loadCorporations(db: DB): Corporation[] {
  const rows = db
    .prepare('SELECT id, name, credits, home_system_id, ai_profile FROM corporations ORDER BY id')
    .all() as Array<{
    id: string
    name: string
    credits: number
    home_system_id: string
    ai_profile: string | null
  }>
  if (rows.length === 0) throw new GameError('INTERNAL', 'No corporation found in save.')
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    credits: row.credits,
    homeSystemId: row.home_system_id,
    ...(row.ai_profile
      ? { aiProfile: row.ai_profile as Corporation['aiProfile'] }
      : {})
  }))
}

/** @deprecated Use saveCorporations */
export function saveCorporation(db: DB, corp: Corporation): void {
  saveCorporations(db, [corp])
}

/** @deprecated Use loadCorporations */
export function loadCorporation(db: DB): Corporation {
  return loadCorporations(db)[0]!
}
