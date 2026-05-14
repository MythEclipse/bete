import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { buildMuxFfmpegArgs, runFfmpeg } from "../../src/audio/ffmpegProcess";

vi.mock("node:child_process", () => ({
  spawn: vi.fn(),
}));

const spawnMock = vi.mocked(spawn);

describe("buildMuxFfmpegArgs", () => {
  it("builds args with multiple inputs and libmp3lame codec", () => {
    const args = buildMuxFfmpegArgs({
      inputs: ["a.ogg", "b.ogg"],
      filter:
        "[0:a]adelay=0|0[pad0];[1:a]adelay=1000|1000[pad1];[pad0][pad1]amix=inputs=2:dropout_transition=0[out]",
      output: "out.mp3",
      codec: "libmp3lame",
    });

    expect(args).toEqual([
      "-y",
      "-i",
      "a.ogg",
      "-i",
      "b.ogg",
      "-filter_complex",
      "[0:a]adelay=0|0[pad0];[1:a]adelay=1000|1000[pad1];[pad0][pad1]amix=inputs=2:dropout_transition=0[out]",
      "-map",
      "[out]",
      "-codec:a",
      "libmp3lame",
      "out.mp3",
    ]);
  });

  it("includes audio frequency and channel options when provided", () => {
    const args = buildMuxFfmpegArgs({
      inputs: ["a.ogg"],
      filter:
        "[0:a]adelay=0|0[pad0];[pad0]amix=inputs=1:dropout_transition=0[out]",
      output: "out.wav",
      codec: "pcm_s16le",
      audioFrequency: 44100,
      audioChannels: 2,
    });

    expect(args).toContain("-ar");
    expect(args).toContain("44100");
    expect(args).toContain("-ac");
    expect(args).toContain("2");
  });

  it("does not include -ar or -ac when audioFrequency and audioChannels are not provided", () => {
    const args = buildMuxFfmpegArgs({
      inputs: ["a.ogg"],
      filter:
        "[0:a]adelay=0|0[pad0];[pad0]amix=inputs=1:dropout_transition=0[out]",
      output: "out.mp3",
      codec: "libmp3lame",
    });

    expect(args).not.toContain("-ar");
    expect(args).not.toContain("-ac");
  });
});

describe("runFfmpeg", () => {
  it("spawns ffmpeg and resolves on exit code 0", async () => {
    const proc = new EventEmitter();
    spawnMock.mockReturnValue(proc as ReturnType<typeof spawn>);

    const result = runFfmpeg(["-version"]);
    proc.emit("close", 0);

    await expect(result).resolves.toBeUndefined();
    expect(spawnMock).toHaveBeenCalledWith("ffmpeg", ["-version"], {
      stdio: ["ignore", "inherit", "inherit"],
    });
  });

  it("rejects on non-zero exit code", async () => {
    const proc = new EventEmitter();
    spawnMock.mockReturnValue(proc as ReturnType<typeof spawn>);

    const result = runFfmpeg(["-bad"]);
    proc.emit("close", 1);

    await expect(result).rejects.toThrow("ffmpeg exited with code 1");
  });

  it("rejects on spawn error", async () => {
    const proc = new EventEmitter();
    spawnMock.mockReturnValue(proc as ReturnType<typeof spawn>);

    const result = runFfmpeg(["-version"]);
    proc.emit("error", new Error("spawn ffmpeg ENOENT"));

    await expect(result).rejects.toThrow("spawn ffmpeg ENOENT");
  });
});
