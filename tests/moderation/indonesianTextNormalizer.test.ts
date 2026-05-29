import { describe, expect, it } from "vitest";
import {
  buildModerationTextEvidence,
  detectIndonesianBadwords,
  formatModerationTextEvidenceForPrompt,
  normalizeDiscordCustomEmoji,
  normalizeIndonesianSlang,
} from "../../src/moderation/indonesianTextNormalizer";

describe("normalizeDiscordCustomEmoji", () => {
  it("replaces static custom emoji", () => {
    const result = normalizeDiscordCustomEmoji("Bersiaplah woy <:hadeh:1217434294281048185>");
    expect(result.text).toBe("Bersiaplah woy [emoji:hadeh]");
    expect(result.emojiNames).toContain("hadeh");
  });

  it("replaces animated custom emoji", () => {
    const result = normalizeDiscordCustomEmoji("cek <a:speen:1234567890> dulu");
    expect(result.text).toBe("cek [emoji:speen] dulu");
    expect(result.emojiNames).toContain("speen");
  });

  it("handles text without emoji", () => {
    const result = normalizeDiscordCustomEmoji("halo semua");
    expect(result.text).toBe("halo semua");
    expect(result.emojiNames).toHaveLength(0);
  });
});

describe("normalizeIndonesianSlang", () => {
  it("maps common slang to normalized form", () => {
    const { text, notes } = normalizeIndonesianSlang("gw emg kyk gitu");
    expect(text).toBe("gue memang kayak gitu");
    expect(notes.some((n) => n.startsWith("gw="))).toBe(true);
  });

  it("marks woy as safe casual interjection", () => {
    const { text, notes } = normalizeIndonesianSlang("woy hadeh");
    expect(text).toBe("woy hadeh");
    expect(notes.some((n) => n.includes("casual"))).toBe(true);
  });
});

describe("detectIndonesianBadwords", () => {
  it("detects known badword", () => {
    const badwords = detectIndonesianBadwords("kontol banget");
    expect(badwords).toContain("kontol");
  });

  it("returns empty array for safe slang", () => {
    const badwords = detectIndonesianBadwords("woy hadeh gua");
    expect(badwords).toHaveLength(0);
  });
});

describe("buildModerationTextEvidence", () => {
  it("produces correct evidence for woy with emoji", () => {
    const evidence = buildModerationTextEvidence(
      "Bersiaplah woy <:hadeh:1217434294281048185>",
    );
    expect(evidence.normalized).toContain("[emoji:hadeh]");
    expect(evidence.badwords).toHaveLength(0);
    expect(evidence.hasBadwords).toBe(false);
    expect(evidence.notes.some((n) => n.includes("no Indonesian badword"))).toBe(true);
    expect(evidence.notes.some((n) => n.includes("emoji:hadeh"))).toBe(true);
    expect(evidence.notes.some((n) => n.includes("casual"))).toBe(true);
  });

  it("detects badword when present", () => {
    const evidence = buildModerationTextEvidence("anjing loe kontol");
    expect(evidence.hasBadwords).toBe(true);
    expect(evidence.notes.some((n) => n.includes("badword detected"))).toBe(true);
  });
});

describe("formatModerationTextEvidenceForPrompt", () => {
  it("returns prompt evidence for slang + emoji", () => {
    const formatted = formatModerationTextEvidenceForPrompt(
      "Bersiaplah woy <:hadeh:1217434294281048185>",
    );
    expect(formatted).toContain("[normalized_text:");
    expect(formatted).toContain("[emoji:hadeh]");
    expect(formatted).toContain("[normalization_notes:");
    expect(formatted).toContain("no Indonesian badword detected");
  });

  it("includes normalized text even for clean input", () => {
    const formatted = formatModerationTextEvidenceForPrompt("Halo semua");
    expect(formatted).toContain("[normalized_text:");
    expect(formatted).toContain("no Indonesian badword detected");
  });
});
