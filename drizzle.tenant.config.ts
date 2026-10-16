import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./shared/schema/tenant.ts",
  out: "./migrations/tenant",
});
