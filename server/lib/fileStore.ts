// Encrypted file storage, one area per client. (CLAUDE.md 3.1: each client gets its own storage and key.)
// Local demo: files live in data/clients/<slug>/files/. Production: the client's own bucket under the BAA.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { Tenant } from "../db/tenantDb";
import { DATA_DIR, IN_MEMORY } from "../config";

const memory = new Map<string, Buffer>(); // tests only, keyed by "<slug>/<key>"

function encrypt(key: Buffer, data: Buffer): Buffer {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([c.update(data), c.final()]);
  return Buffer.concat([Buffer.from("CDB1"), iv, c.getAuthTag(), enc]);
}

function decrypt(key: Buffer, blob: Buffer): Buffer {
  if (blob.subarray(0, 4).toString() !== "CDB1") throw new Error("Unrecognized file format");
  const iv = blob.subarray(4, 16);
  const tag = blob.subarray(16, 32);
  const d = crypto.createDecipheriv("aes-256-gcm", key, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(blob.subarray(32)), d.final()]);
}

function fileDir(tenant: Tenant) {
  const dir = path.join(DATA_DIR, "clients", tenant.slug, "files");
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  return dir;
}

/** Store bytes for this client only. Returns the storage key. */
export function putFile(tenant: Tenant, data: Buffer): string {
  const key = crypto.randomUUID();
  const blob = encrypt(tenant.key, data);
  if (IN_MEMORY) memory.set(`${tenant.slug}/${key}`, blob);
  else fs.writeFileSync(path.join(fileDir(tenant), `${key}.enc`), blob, { mode: 0o600 });
  return key;
}

export function getFile(tenant: Tenant, storageKey: string): Buffer {
  if (!/^[0-9a-f-]{36}$/.test(storageKey)) throw new Error("Bad storage key");
  const blob = IN_MEMORY ? memory.get(`${tenant.slug}/${storageKey}`) : fs.readFileSync(path.join(fileDir(tenant), `${storageKey}.enc`));
  if (!blob) throw new Error("File not found");
  return decrypt(tenant.key, blob);
}

export const sha256 = (b: Buffer) => crypto.createHash("sha256").update(b).digest("hex");
