// THE ONLY PLACE that opens a client's database. (CLAUDE.md 3.1)
// Every route gets its client database from here, using the client ID stored
// in the logged-in user's session. Nothing the browser sends can choose the client.
import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import * as schema from "@shared/schema/tenant";
import { DATA_DIR, IN_MEMORY, MIGRATIONS_DIR } from "../config";

export type TenantDb = PgliteDatabase<typeof schema>;

export interface Tenant {
  clientId: number;
  slug: string;
  db: TenantDb;
  /** This client's own encryption key (never shared with another client). */
  key: Buffer;
}

const open = new Map<number, { tenant: Tenant; client: PGlite }>();
const opening = new Map<number, Promise<Tenant>>();

function slugIsSafe(slug: string) {
  return /^[a-z0-9-]{2,40}$/.test(slug);
}

function loadOrCreateKey(slug: string): Buffer {
  // Local development keeps one key file per client. In production this must come
  // from the hosting provider's secret storage (see docs/ARCHITECTURE.md).
  if (IN_MEMORY) return crypto.randomBytes(32);
  const dir = path.join(DATA_DIR, "keys");
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = path.join(dir, `${slug}.key`);
  if (!fs.existsSync(file)) fs.writeFileSync(file, crypto.randomBytes(32).toString("base64"), { mode: 0o600 });
  return Buffer.from(fs.readFileSync(file, "utf8"), "base64");
}

/** Open (or reuse) one client's database. Runs migrations the first time. */
export async function getTenant(clientId: number, slug: string): Promise<Tenant> {
  if (!slugIsSafe(slug)) throw new Error("Invalid client slug");
  const existing = open.get(clientId);
  if (existing) {
    if (existing.tenant.slug !== slug) throw new Error("Client ID / slug mismatch");
    return existing.tenant;
  }
  const pending = opening.get(clientId);
  if (pending) return pending;

  const p = (async () => {
    let dir: string | undefined;
    if (!IN_MEMORY) {
      dir = path.join(DATA_DIR, "clients", slug);
      fs.mkdirSync(dir, { recursive: true });
    }
    const client = new PGlite(dir);
    const db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: path.join(MIGRATIONS_DIR, "tenant") });
    const tenant: Tenant = { clientId, slug, db, key: loadOrCreateKey(slug) };
    open.set(clientId, { tenant, client });
    return tenant;
  })();
  opening.set(clientId, p);
  try {
    return await p;
  } finally {
    opening.delete(clientId);
  }
}

export async function closeAllTenants() {
  for (const { client } of open.values()) await client.close();
  open.clear();
}
