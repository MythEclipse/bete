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
      VOICE_CHANNEL_ID: "voice-channel",
      GUILD_ID: "guild",
      VERBOSE: "true",
      WEBSERVER_PORT: "4000",
      NODE_ENV: "test",
    };

    const { loadConfig } = await import("../src/config");
    const config = loadConfig(process.env);

    expect(config.DISCORD_TOKEN).toBe("token");
    expect(config.VOICE_CHANNEL_ID).toBe("voice-channel");
    expect(config.GUILD_ID).toBe("guild");
    expect(config.VERBOSE).toBe(true);
    expect(config.WEBSERVER_PORT).toBe(4000);
    expect(config.RECORDINGS_DIR).toBe("./recordings");
    expect(config.NODE_ENV).toBe("test");
  });
});
