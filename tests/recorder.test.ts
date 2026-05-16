import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";

const speaking = new EventEmitter();
const subscribe = vi.fn();
const joinVoiceChannel = vi.fn(() => ({
  receiver: {
    speaking,
    subscriptions: new Map(),
    subscribe,
  },
  on: vi.fn(),
  destroy: vi.fn(),
}));

vi.mock("@discordjs/voice", async () => {
  const actual =
    await vi.importActual<typeof import("@discordjs/voice")>(
      "@discordjs/voice",
    );
  return {
    ...actual,
    joinVoiceChannel,
    entersState: vi.fn(async () => undefined),
  };
});

describe("startRecording", () => {
  it("does not subscribe to the bot user's own audio", async () => {
    const { startRecording } = await import("../src/recorder");
    const client = {
      user: { id: "bot-user" },
    };
    const channel = {
      id: "voice-channel",
      name: "Voice",
      guild: {
        id: "guild",
        voiceAdapterCreator: {},
      },
    };

    await startRecording(client as never, channel as never);
    speaking.emit("start", "bot-user");
    await new Promise((resolve) => setImmediate(resolve));

    expect(subscribe).not.toHaveBeenCalled();
  });
});
