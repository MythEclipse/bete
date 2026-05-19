export function upsample24kMonoTo48kStereo(mono24k: Buffer): Buffer {
  const numSamples = mono24k.length / 2;
  const out = Buffer.alloc(numSamples * 8);

  for (let i = 0; i < numSamples; i++) {
    const sample = mono24k.readInt16LE(i * 2);
    const base = i * 8;
    out.writeInt16LE(sample, base);
    out.writeInt16LE(sample, base + 2);
    out.writeInt16LE(sample, base + 4);
    out.writeInt16LE(sample, base + 6);
  }

  return out;
}

export function rmsDb(pcm: Buffer): number {
  let sum = 0;
  const samples = pcm.length / 2;

  for (let i = 0; i < samples; i++) {
    const sample = pcm.readInt16LE(i * 2) / 32768;
    sum += sample * sample;
  }

  const rms = Math.sqrt(sum / samples);
  return 20 * Math.log10(rms);
}
