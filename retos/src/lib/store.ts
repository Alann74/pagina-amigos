// Persistencia de salas. Postgres (DATABASE_URL) en producción; memoria en desarrollo y pruebas.
import type { Room } from "./engine";

export interface Loaded { room: Room; version: number; presence: Record<string, number> }
export interface Store {
  create(room: Room): Promise<boolean>;
  peek(code: string): Promise<{ version: number; presence: Record<string, number> } | null>;
  load(code: string): Promise<Loaded | null>;
  /** Transacción: fn muta la sala; si lanza, no se guarda nada. */
  mutate<T>(code: string, fn: (room: Room, presence: Record<string, number>) => T): Promise<{ result: T; version: number } | null>;
  touch(code: string, playerId: string, now: number): Promise<void>;
}

const TOUCH_EVERY_MS = 5000;
const TTL_MS = 3 * 24 * 3600 * 1000;

class MemoryStore implements Store {
  private rooms = new Map<string, { json: string; version: number; presence: Record<string, number>; touched: number }>();
  async create(room: Room) {
    if (this.rooms.has(room.code)) return false;
    for (const [k, v] of this.rooms) if (Date.now() - v.touched > TTL_MS) this.rooms.delete(k);
    this.rooms.set(room.code, { json: JSON.stringify(room), version: 1, presence: {}, touched: Date.now() });
    return true;
  }
  async peek(code: string) { const r = this.rooms.get(code); return r ? { version: r.version, presence: r.presence } : null; }
  async load(code: string) { const r = this.rooms.get(code); return r ? { room: JSON.parse(r.json) as Room, version: r.version, presence: r.presence } : null; }
  async mutate<T>(code: string, fn: (room: Room, presence: Record<string, number>) => T) {
    const r = this.rooms.get(code);
    if (!r) return null;
    const room = JSON.parse(r.json) as Room;
    const result = fn(room, r.presence); // síncrono: atómico en un solo proceso
    r.json = JSON.stringify(room); r.version += 1; r.touched = Date.now();
    return { result, version: r.version };
  }
  async touch(code: string, playerId: string, now: number) {
    const r = this.rooms.get(code);
    if (r && now - (r.presence[playerId] ?? 0) > TOUCH_EVERY_MS) r.presence[playerId] = now;
  }
}

class PgStore implements Store {
  private pool: import("pg").Pool;
  private ready: Promise<void>;
  constructor(url: string, Pool: typeof import("pg").Pool) {
    this.pool = new Pool({ connectionString: url, max: 4, idleTimeoutMillis: 10000 });
    this.ready = this.pool.query(`CREATE TABLE IF NOT EXISTS rooms (
      code text PRIMARY KEY, state jsonb NOT NULL, version int NOT NULL DEFAULT 1,
      presence jsonb NOT NULL DEFAULT '{}'::jsonb, updated_at timestamptz NOT NULL DEFAULT now())`).then(() => undefined);
  }
  async create(room: Room) {
    await this.ready;
    this.pool.query(`DELETE FROM rooms WHERE updated_at < now() - interval '3 days'`).catch(() => {});
    const r = await this.pool.query(`INSERT INTO rooms (code, state) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [room.code, JSON.stringify(room)]);
    return (r.rowCount ?? 0) > 0;
  }
  async peek(code: string) {
    await this.ready;
    const r = await this.pool.query(`SELECT version, presence FROM rooms WHERE code=$1`, [code]);
    return r.rows[0] ? { version: r.rows[0].version as number, presence: r.rows[0].presence as Record<string, number> } : null;
  }
  async load(code: string) {
    await this.ready;
    const r = await this.pool.query(`SELECT state, version, presence FROM rooms WHERE code=$1`, [code]);
    return r.rows[0] ? { room: r.rows[0].state as Room, version: r.rows[0].version as number, presence: r.rows[0].presence as Record<string, number> } : null;
  }
  async mutate<T>(code: string, fn: (room: Room, presence: Record<string, number>) => T) {
    await this.ready;
    const c = await this.pool.connect();
    try {
      await c.query("BEGIN");
      const r = await c.query(`SELECT state, version, presence FROM rooms WHERE code=$1 FOR UPDATE`, [code]);
      if (!r.rows[0]) { await c.query("ROLLBACK"); return null; }
      const room = r.rows[0].state as Room;
      const result = fn(room, r.rows[0].presence);
      const version = (r.rows[0].version as number) + 1;
      await c.query(`UPDATE rooms SET state=$2, version=$3, updated_at=now() WHERE code=$1`, [code, JSON.stringify(room), version]);
      await c.query("COMMIT");
      return { result, version };
    } catch (e) {
      await c.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      c.release();
    }
  }
  async touch(code: string, playerId: string, now: number) {
    await this.ready;
    await this.pool.query(
      `UPDATE rooms SET presence = jsonb_set(presence, ARRAY[$2::text], to_jsonb($3::bigint), true)
       WHERE code=$1 AND COALESCE((presence->>$2)::bigint, 0) < $3::bigint - ${TOUCH_EVERY_MS}`,
      [code, playerId, now],
    );
  }
}

const g = globalThis as unknown as { __retosStore?: Store };
export async function getStore(): Promise<Store> {
  if (g.__retosStore) return g.__retosStore;
  const url = process.env.DATABASE_URL;
  if (url) {
    const { Pool } = await import("pg");
    g.__retosStore = new PgStore(url, Pool);
  } else {
    g.__retosStore = new MemoryStore();
  }
  return g.__retosStore;
}
export const storeKind = () => (process.env.DATABASE_URL ? "postgres" : "memoria");
