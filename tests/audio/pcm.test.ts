import { describe, expect, it } from "vitest";
import { rmsDb, upsample24kMonoTo48kStereo } from "../../src/audio/pcm";

describe("PCM helpers", () => {
  it("upsamples 24kHz mono s16le to 48kHz stereo s16le", () => {
    const input = Buffer.alloc(4);
    input.writeInt16LE(1000, 0);
    input.writeInt16LE(-1000, 2);

    const output = upsample24kMonoTo48kStereo(input);

    expect(output.length).toBe(16);
    expect(output.readInt16LE(0)).toBe(1000);
    expect(output.readInt16LE(2)).toBe(1000);
    expect(output.readInt16LE(4)).toBe(1000);
    expect(output.readInt16LE(6)).toBe(1000);
    expect(output.readInt16LE(8)).toBe(-1000);
    expect(output.readInt16LE(10)).toBe(-1000);
    expect(output.readInt16LE(12)).toBe(-1000);
    expect(output.readInt16LE(14)).toBe(-1000);
  });

  it("calculates RMS dB for non-silent PCM", () => {
    const input = Buffer.alloc(4);
    input.writeInt16LE(32767, 0);
    input.writeInt16LE(32767, 2);

    expect(rmsDb(input)).toBeCloseTo(0, 1);
  });
});
