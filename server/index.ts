// Starts the app. In development the screens are served by Vite with live reload.
import path from "node:path";
import fs from "node:fs";
import express from "express";
import { createApp } from "./app";
import { openControlDb } from "./db/control";
import { seedDemo } from "./seed";
import { IS_PRODUCTION, PORT, DATA_DIR } from "./config";

async function main() {
  await openControlDb();
  const logins = await seedDemo();

  const app = createApp();
  if (IS_PRODUCTION) {
    const dist = path.resolve(import.meta.dirname, "..", "dist", "public");
    app.use(express.static(dist));
    app.use((_req, res) => res.sendFile(path.join(dist, "index.html")));
  } else {
    const { createServer } = await import("vite");
    const vite = await createServer({
      configFile: path.resolve(import.meta.dirname, "..", "vite.config.ts"),
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "127.0.0.1", () => {
    console.log("");
    console.log("  Caliber DME Billing is running (DEMO DATA ONLY: no real patients)");
    console.log(`  Open:  http://localhost:${PORT}`);
    if (logins) {
      console.log("");
      console.log("  Demo logins (also saved in data/DEMO_LOGINS.txt):");
      for (const l of logins) console.log(`    ${l.role.padEnd(20)} ${l.email.padEnd(28)} ${l.password}`);
    } else {
      const f = path.join(DATA_DIR, "DEMO_LOGINS.txt");
      if (fs.existsSync(f)) console.log(`  Demo logins: see ${f}`);
    }
    console.log("");
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
