// Starts the app. In development the screens are served by Vite with live reload.
import path from "node:path";
import fs from "node:fs";
import express from "express";
import { createApp } from "./app";
import { openControlDb } from "./db/control";
import { seedDemo } from "./seed";
import { ensureOfficialCodeSets } from "./lib/codesets";
import { IS_PRODUCTION, PORT, DATA_DIR } from "./config";

// Local settings (like ANTHROPIC_API_KEY) can live in a .env file next to package.json. It is never committed.
if (fs.existsSync(".env") && typeof process.loadEnvFile === "function") process.loadEnvFile(".env");

async function main() {
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major < 20 || (major === 20 && minor < 11)) {
    console.error(`\n  This app needs Node.js 20.11 or newer. You have ${process.versions.node}.\n  Install the LTS version from https://nodejs.org and try again.\n`);
    process.exit(1);
  }
  await openControlDb();
  const logins = await seedDemo();
  // Official HCPCS and ICD-10-CM files that ship with the app (loads once; replaces the small starter list).
  await ensureOfficialCodeSets();

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

  const server = app.listen(PORT, "127.0.0.1", () => {
    console.log("");
    console.log("  Caliber DME Billing is running (DEMO DATA ONLY: no real patients)");
    console.log(`  Open:  http://127.0.0.1:${PORT}   (or http://localhost:${PORT})`);
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

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error(`\n  Port ${PORT} is already in use by another program.\n  Try a different one, for example:  PORT=3001 npm run dev\n`);
      process.exit(1);
    }
    throw err;
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
