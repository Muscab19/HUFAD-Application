// src/utils/offlineDb.ts
import * as SQLite from 'expo-sqlite';

const DB_NAME = 'hufad_offline.db';

let db: SQLite.SQLiteDatabase | null = null;

// ============================================================
// INIT
// ============================================================
export const initOfflineDb = async (): Promise<void> => {
  if (db) return;
  db = await SQLite.openDatabaseAsync(DB_NAME);

  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS attendance_queue (
      id TEXT PRIMARY KEY NOT NULL,
      branch_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      retry_count INTEGER NOT NULL DEFAULT 0,
      last_attempt_at INTEGER,
      last_error TEXT
    );

    CREATE TABLE IF NOT EXISTS memorization_queue (
      id TEXT PRIMARY KEY NOT NULL,
      branch_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      retry_count INTEGER NOT NULL DEFAULT 0,
      last_attempt_at INTEGER,
      last_error TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_attendance_created
      ON attendance_queue (created_at);

    CREATE INDEX IF NOT EXISTS idx_memorization_created
      ON memorization_queue (created_at);
  `);
};

const getDb = async (): Promise<SQLite.SQLiteDatabase> => {
  if (!db) await initOfflineDb();
  return db!;
};

// ============================================================
// UUID
// ============================================================
export const newClientId = (): string => {
  // RFC4122-ish v4 without extra dependency
  const rnd = () => Math.floor(Math.random() * 0xffffffff);
  const u = () =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (rnd() + 0x10000) % 16;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  return u();
};

// ============================================================
// TYPES
// ============================================================
export type QueueKind = 'attendance' | 'memorization';

export interface QueuedRecord {
  id: string;
  branch_id: string;
  payload: any;
  created_at: number;
  retry_count: number;
  last_attempt_at: number | null;
  last_error: string | null;
}

// ============================================================
// ENQUEUE
// ============================================================
export const enqueue = async (
  kind: QueueKind,
  branchId: string,
  payload: any
): Promise<string> => {
  const database = await getDb();
  const id = newClientId();
  const createdAt = Date.now();
  const table = kind === 'attendance' ? 'attendance_queue' : 'memorization_queue';

  await database.runAsync(
    `INSERT INTO ${table} (id, branch_id, payload, created_at) VALUES (?, ?, ?, ?)`,
    id,
    branchId,
    JSON.stringify(payload),
    createdAt
  );
  return id;
};

// ============================================================
// DEQUEUE — return rows ready to sync (ordered by created_at ASC)
// ============================================================
export const getPending = async (
  kind: QueueKind,
  limit = 50
): Promise<QueuedRecord[]> => {
  const database = await getDb();
  const table = kind === 'attendance' ? 'attendance_queue' : 'memorization_queue';
  const rows = await database.getAllAsync<QueuedRecord>(
    `SELECT * FROM ${table} ORDER BY created_at ASC LIMIT ?`,
    limit
  );
  return rows.map((r) => ({ ...r, payload: JSON.parse(r.payload) }));
};

export const countPending = async (kind: QueueKind): Promise<number> => {
  const database = await getDb();
  const table = kind === 'attendance' ? 'attendance_queue' : 'memorization_queue';
  const row = await database.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) as c FROM ${table}`
  );
  return row?.c ?? 0;
};

// ============================================================
// REMOVE (after successful sync)
// ============================================================
export const removeQueued = async (
  kind: QueueKind,
  id: string
): Promise<void> => {
  const database = await getDb();
  const table = kind === 'attendance' ? 'attendance_queue' : 'memorization_queue';
  await database.runAsync(`DELETE FROM ${table} WHERE id = ?`, id);
};

// ============================================================
// MARK FAILURE — keep the row, bump retry_count
// ============================================================
export const markFailed = async (
  kind: QueueKind,
  id: string,
  error: string
): Promise<void> => {
  const database = await getDb();
  const table = kind === 'attendance' ? 'attendance_queue' : 'memorization_queue';
  await database.runAsync(
    `UPDATE ${table}
       SET retry_count = retry_count + 1,
           last_attempt_at = ?,
           last_error = ?
     WHERE id = ?`,
    Date.now(),
    error.slice(0, 500),
    id
  );
};