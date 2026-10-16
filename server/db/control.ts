// The control database (no PHI): clients, users, payers, code sets.
import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import fs from "node:fs";
import path from "node:path";
import * as schema from "@shared/schema/control";
import { DATA_DIR, IN_MEMORY, MIGRATIONS_DIR } from "../config";

export type ControlDb = PgliteDatabase<typeof schema>;

let controlDb: ControlDb | null = null;
let controlClient: PGlite | null = null;

export async function openControlDb(): Promise<ControlDb> {
  if (controlDb) return controlDb;
  let dir: string | undefined;
  if (!IN_MEMORY) {
    dir = path.join(DATA_DIR, "control");
    fs.mkdirSync(dir, { recursive: true });
  }
  controlClient = new PGlite(dir);
  controlDb = drizzle(controlClient, { schema });
  await migrate(controlDb, { migrationsFolder: path.join(MIGRATIONS_DIR, "control") });
  return controlDb;
}

export function getControlDb(): ControlDb {
  if (!controlDb) throw new Error("Control database not opened yet");
  return controlDb;
}

export async function closeControlDb() {
  await controlClient?.close();
  controlClient = null;
  controlDb = null;
}
