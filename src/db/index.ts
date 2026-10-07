import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

type DB = NodePgDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __ineditaPool?: Pool; __ineditaDb?: DB };

function createDb(): DB {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Falta la variable de entorno DATABASE_URL");
  }
  const isLocal = /localhost|127\.0\.0\.1/.test(connectionString);
  const pool =
    globalForDb.__ineditaPool ??
    new Pool({
      connectionString,
      max: isLocal ? 5 : 3,
      idleTimeoutMillis: 10_000,
    });
  globalForDb.__ineditaPool = pool;
  return drizzle(pool, { schema });
}

// Conexión perezosa: no falla al importar si falta DATABASE_URL (por ejemplo, durante el lint)
export const db: DB = new Proxy({} as DB, {
  get(_target, prop) {
    if (!globalForDb.__ineditaDb) globalForDb.__ineditaDb = createDb();
    const value = Reflect.get(globalForDb.__ineditaDb, prop);
    return typeof value === "function" ? value.bind(globalForDb.__ineditaDb) : value;
  },
});

export { schema };
