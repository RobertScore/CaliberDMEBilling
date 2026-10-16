import path from "node:path";

/** Where local databases and keys live. "memory" keeps everything in RAM (used by tests). */
export const DATA_DIR = process.env.DATA_DIR ?? path.resolve(process.cwd(), "data");
export const IN_MEMORY = DATA_DIR === "memory";
export const MIGRATIONS_DIR = path.resolve(import.meta.dirname, "..", "migrations");
export const IS_PRODUCTION = process.env.NODE_ENV === "production";
// Not 5000: newer Macs use port 5000 for AirPlay Receiver.
export const PORT = Number(process.env.PORT ?? 3000);
