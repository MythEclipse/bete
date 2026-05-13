import process from "node:process";
import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv = process.env;

afterEach(() => {
  process.env = originalEnv;
  vi.resetModules();
});

describe("loadConfig", () => {
  it("loads required values and coerces optional values", async () => {
    process.env = {
      ...originalEnv,
      DISCORD_TOKEN: "token",
      VERBOSE: "true",
      WEBSERVER_PORT: "4000",
      NODE_ENV: "test",
    };

    const { loadConfig } = await import("../src/config");
    const config = loadConfig(process.env);

    expect(config.DISCORD_TOKEN).toBe("token");
    expect(config.GUILD_ID).toBeUndefined();
    expect(config.VOICE_CHANNEL_ID).toBeUndefined();
    expect(config.VERBOSE).toBe(true);
    expect(config.WEBSERVER_PORT).toBe(4000);
    expect(config.RECORDINGS_DIR).toBe("./recordings");
    expect(config.NODE_ENV).toBe("test");
  });
});
