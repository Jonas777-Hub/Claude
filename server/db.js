// SQLite-Datenbank (node:sqlite, in Node ≥ 22.13 eingebaut – keine nativen Abhängigkeiten)
import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import path from 'node:path'

const dir = process.env.KALORA_DATA_DIR || path.resolve('data')
fs.mkdirSync(dir, { recursive: true })
export const db = new DatabaseSync(process.env.KALORA_DB || path.join(dir, 'kalora.db'))

db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    INTEGER NOT NULL
);

-- Komplettes persönliches App-Profil (Profil, Tagebuch, Gewichte, Bewertungen, Einstellungen …) als JSON.
-- Ein Dokument pro Nutzer: einfache, konfliktarme Synchronisierung (last write wins über updated_at).
CREATE TABLE IF NOT EXISTS user_state (
  user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data       TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Geteilte Einkaufswagen
CREATE TABLE IF NOT EXISTS carts (
  code       TEXT PRIMARY KEY,
  name       TEXT NOT NULL DEFAULT 'Einkaufsliste',
  owner_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS cart_items (
  id         TEXT NOT NULL,
  cart_code  TEXT NOT NULL REFERENCES carts(code) ON DELETE CASCADE,
  data       TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (cart_code, id)
);

CREATE TABLE IF NOT EXISTS cart_activity (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  cart_code TEXT NOT NULL REFERENCES carts(code) ON DELETE CASCADE,
  ts        INTEGER NOT NULL,
  actor     TEXT NOT NULL,
  text      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_activity_cart ON cart_activity(cart_code, ts);

-- Rezeptbewertungen aller Nutzer (Grundlage für globale Beliebtheit)
CREATE TABLE IF NOT EXISTS recipe_ratings (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipe_id  TEXT NOT NULL,
  score      INTEGER NOT NULL CHECK (score BETWEEN 1 AND 10),
  comment    TEXT,
  suggestion TEXT,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, recipe_id)
);
`)
