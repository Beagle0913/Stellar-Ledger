import Database from 'better-sqlite3'
import { runMigrations } from './migrations.js'

// Thin wrapper around better-sqlite3. Each campaign is one SQLite file. Use
// ':memory:' for tests. Opening always ensures the schema is present.

export type DB = Database.Database

export function openDatabase(filePath: string): DB {
  const db = new Database(filePath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  runMigrations(db)
  return db
}

export function closeDatabase(db: DB): void {
  db.close()
}
