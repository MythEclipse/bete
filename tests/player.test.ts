import { Readable } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock @discordjs/voice
vi.mock("@discordjs/voice", () => {
  const mockPlayer = {
    play: vi.fn(),
    pause: vi.fn(),
    unpause: vi.fn().mockReturnValue(true),
    stop: vi.fn(),
    on: vi.fn(),
    state: { status: "idle" },
  };
  const mockConnection = {
    subscribe: vi.fn().mockReturnValue({}),
  };
  return {
    AudioPlayerStatus: { Idle: "idle", Playing: "playing", Paused: "paused" },
    createAudioPlayer: vi.fn(() => mockPlayer),
    createAudioResource: vi.fn(() => ({})),
    StreamType: { OggOpus: "OggOpus" },
    AudioPlayer: vi.fn(),
    VoiceConnection: vi.fn(),
    __mockPlayer: mockPlayer,
    __mockConnection: mockConnection,
  };
});

// Import after mocks
import { DiscordPlayer } from "../src/player";

describe("DiscordPlayer", () => {
  let player: DiscordPlayer;
  const dummyStream = new Readable();

  beforeEach(() => {
    vi.clearAllMocks();
    player = new DiscordPlayer();
  });

  describe("ownership", () => {
    it("starts with owner none", () => {
      expect(player.getOwner()).toBe("none");
    });

    it("playStream with owner sets owner", () => {
      player.playStream(dummyStream, "music");
      expect(player.getOwner()).toBe("music");
    });

    it("browser bridge cannot override music owner", () => {
      player.playStream(dummyStream, "music");
      expect(() => player.playStream(dummyStream, "browser-bridge")).toThrow(
        "Discord audio player is owned by music",
      );
    });

    it("same owner can replace stream without error", () => {
      player.playStream(dummyStream, "music");
      expect(() => player.playStream(dummyStream, "music")).not.toThrow();
      expect(player.getOwner()).toBe("music");
    });

    it("matching owner stop releases ownership", () => {
      player.playStream(dummyStream, "music");
      player.stop("music");
      expect(player.getOwner()).toBe("none");
    });

    it("non-owner stop is ignored", () => {
      player.playStream(dummyStream, "music");
      player.stop("browser-bridge");
      expect(player.getOwner()).toBe("music");
    });

    it("stop without owner releases ownership", () => {
      player.playStream(dummyStream, "music");
      player.stop();
      expect(player.getOwner()).toBe("none");
    });
  });
});
