import { afterEach, describe, expect, it } from "vitest";
import { aiReaderStatus } from "../server/lib/reader";

const saved = { ...process.env };
const set = (env: Record<string, string | undefined>) => {
  for (const k of ["CALIBER_AI_READER", "ANTHROPIC_API_KEY", "CALIBER_AI_BAA_CONFIRMED", "NODE_ENV"]) delete process.env[k];
  for (const [k, v] of Object.entries(env)) if (v !== undefined) process.env[k] = v;
};

describe("AI reader on/off", () => {
  afterEach(() => { process.env = { ...saved }; });

  it("is on in the local demo when a key is set", () => {
    set({ ANTHROPIC_API_KEY: "test-key", NODE_ENV: "development" });
    expect(aiReaderStatus().on).toBe(true);
  });

  it("can be paused with CALIBER_AI_READER=off", () => {
    set({ ANTHROPIC_API_KEY: "test-key", CALIBER_AI_READER: "off" });
    expect(aiReaderStatus().on).toBe(false);
  });

  it("is off without a key", () => {
    set({ NODE_ENV: "development" });
    expect(aiReaderStatus().on).toBe(false);
  });

  it("never runs on real patient data (production) until the BAA is confirmed", () => {
    set({ ANTHROPIC_API_KEY: "test-key", NODE_ENV: "production" });
    expect(aiReaderStatus().on).toBe(false);
    set({ ANTHROPIC_API_KEY: "test-key", NODE_ENV: "production", CALIBER_AI_BAA_CONFIRMED: "yes" });
    expect(aiReaderStatus().on).toBe(true);
  });
});
