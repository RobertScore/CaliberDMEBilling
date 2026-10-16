// Wipe the LOCAL demo data folder so the next "npm run dev" starts fresh with new demo logins.
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "../server/config";

if (DATA_DIR === "memory" || !fs.existsSync(path.join(DATA_DIR, "DEMO_LOGINS.txt"))) {
  console.error(`Not a demo data folder (no DEMO_LOGINS.txt): ${DATA_DIR}. Nothing deleted.`);
  process.exit(1);
}
fs.rmSync(DATA_DIR, { recursive: true, force: true });
console.log(`Deleted local demo data in ${DATA_DIR}. Run "npm run dev" to start fresh.`);
