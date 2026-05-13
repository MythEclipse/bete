import process from "node:process";
import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  process.env = {
    ...process.env,
    DISCORD_TOKEN: "token",
    NODE_ENV: "test",
  };
  vi.resetModules();
});

describe("shouldEnableDefaultOpusDecoder", () => {
  it("disables default decoder on Bun when native opus is unavailable", async () => {
    const { shouldEnableDefaultOpusDecoder } = await import(
      "../src/recorder/decoder"
    );

    expect(
      shouldEnableDefaultOpusDecoder({ isBun: true, canLoadNativeOpus: false }),
    ).toBe(false);
  });

  it("enables default decoder when native opus is available", async () => {
    const { shouldEnableDefaultOpusDecoder } = await import(
      "../src/recorder/decoder"
    );

    expect(
      shouldEnableDefaultOpusDecoder({ isBun: true, canLoadNativeOpus: true }),
    ).toBe(true);
  });
});
