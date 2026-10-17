// Update the official code sets from CMS (HCPCS) and CDC (ICD-10-CM):
//   npm run codes:update
// Stop the app first (Control + C in its Terminal window); the app can also do this itself from
// Settings → Codes → "Check CMS/CDC for updates" while it's running.
import { openControlDb, closeControlDb } from "../server/db/control";
import { PORT } from "../server/config";
import { updateFromOfficialSources } from "../server/lib/codesets";

async function main() {
  const running = await fetch(`http://127.0.0.1:${PORT}/api/session`).then(() => true, () => false);
  if (running) {
    console.error("\n  The app is running. Either stop it first (Control + C in its window), or use Settings → Codes → \"Check CMS/CDC for updates\" in the app.\n");
    process.exit(1);
  }
  await openControlDb();
  await updateFromOfficialSources("npm run codes:update", (m) => console.log(`  ${m}`));
  await closeControlDb();
}

main().catch((e) => {
  console.error(`\n  The update stopped: ${e.message}\n`);
  process.exit(1);
});
