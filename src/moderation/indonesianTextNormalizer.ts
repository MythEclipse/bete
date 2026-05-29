import badwordsModule from "indonesian-badwords";
import { INDONESIAN_SLANG_LEXICON } from "./resources/indonesianSlangLexicon.js";

const CUSTOM_EMOJI_PATTERN = /<a?:([a-zA-Z0-9_]+):(\d+)>/g;
const WORD_PATTERN = /[\p{L}\p{N}_]+/gu;

interface BadwordAnalyzeResult {
  badwords?: string[];
  count?: number;
}

interface BadwordsModule {
  analyze?: (text: string) => BadwordAnalyzeResult;
  flag?: (text: string) => boolean;
}

const badwords = badwordsModule as BadwordsModule;

export interface ModerationTextEvidence {
  raw: string;
  normalized: string;
  notes: string[];
  badwords: string[];
  hasBadwords: boolean;
}

export function normalizeDiscordCustomEmoji(text: string): {
  text: string;
  emojiNames: string[];
} {
  const emojiNames: string[] = [];
  const normalized = text.replace(CUSTOM_EMOJI_PATTERN, (_match, name: string) => {
    emojiNames.push(name);
    return `[emoji:${name}]`;
  });

  return { text: normalized, emojiNames };
}

export function normalizeIndonesianSlang(text: string): {
  text: string;
  notes: string[];
} {
  const notes: string[] = [];
  const normalized = text.replace(WORD_PATTERN, (word) => {
    const entry = INDONESIAN_SLANG_LEXICON[word.toLowerCase()];
    if (!entry) return word;

    notes.push(`${word}=${entry.normalized} (${entry.note})`);
    return entry.normalized;
  });

  return { text: normalized, notes: Array.from(new Set(notes)) };
}

export function detectIndonesianBadwords(text: string): string[] {
  try {
    const result = badwords.analyze?.(text);
    if (Array.isArray(result?.badwords)) {
      let hits = Array.from(new Set(result.badwords.map((word) => word.toLowerCase())));

      const lowerText = text.toLowerCase();

      // -----------------------------------------------------------------------
      // False-positive filters — exclude badword hits that appear only as
      // substrings of longer innocent words.  Each filter checks whether the
      // hit exists as a standalone word OR as part of a word that is NOT in
      // the whitelist.
      // -----------------------------------------------------------------------
      const words = lowerText.match(/[\p{L}\p{N}_]+/gu) || [];

      /** Returns true if the given hit appears in the text as a standalone word
       *  or inside a word that is NOT in the whitelist. */
      const isRealHit = (hit: string, whitelist: string[]): boolean => {
        for (const w of words) {
          if (w.includes(hit)) {
            // If the word IS an exact match, it's definitely a real hit.
            if (w === hit) return true;
            // If it's inside a longer word, check the whitelist.
            if (!whitelist.includes(w)) return true;
          }
        }
        return false;
      };

      hits = hits.filter((hit) => {
        switch (hit) {
          case "asu":
            return isRealHit(hit, [
              "asus", "masuk", "termasuk", "dimasukkan", "memasukkan",
              "kasur", "asumsi", "asuransi", "asupan", "pasukan", "pasundan",
            ]);
          case "goblok":
            return isRealHit(hit, [
              "goblok", // standalone is always flagged
            ]);
          case "kontol":
            return isRealHit(hit, [
              "kontol", // standalone is always flagged
            ]);
          case "memek":
            return isRealHit(hit, [
              "memek", // standalone is always flagged
            ]);
          case "tolol":
            return isRealHit(hit, [
              "tolol", // standalone is always flagged
            ]);
          case "beg":
            // Short substring — only flag if it appears as a standalone word
            // or in a known profanity context, not inside "bego" variants.
            return words.some(w => w === "beg" || w === "bgo" || w === "bgoo");
          default:
            return true;
        }
      });

      // -----------------------------------------------------------------------
      // Secondary detection: catch slang/vowelless forms the npm package misses.
      // These are words that appear standalone (not inside a longer word) after
      // normalization has already run.
      // -----------------------------------------------------------------------
      const SLANG_BADWORDS = [
        "anjing", "bangsat", "brengsek", "bajingan", "kontol", "memek",
        "tai", "goblok", "tolol", "bego", "sialan", "jancuk", "kampret",
        "pepek", "jembut", "ngentot", "ngewe", "coli", "celaka", "laknat",
        "pantek", "entod", "ndasmu", "ndas", "piyo",
      ];

      for (const slang of SLANG_BADWORDS) {
        if (hits.includes(slang)) continue;

        const standalonePattern = new RegExp(
          `(?:^|\\s|[^\\p{L}])${slang}(?:$|\\s|[^\\p{L}])`,
          "iu",
        );
        if (standalonePattern.test(lowerText)) {
          hits.push(slang);
        }
      }

      return Array.from(new Set(hits));
    }
  } catch {
    // Keep moderation pipeline resilient if dependency changes shape.
  }
  return [];
}

export function buildModerationTextEvidence(text: string): ModerationTextEvidence {
  const emojiNormalized = normalizeDiscordCustomEmoji(text);
  const slangNormalized = normalizeIndonesianSlang(emojiNormalized.text);
  const badwordHits = detectIndonesianBadwords(slangNormalized.text);
  const notes = [...slangNormalized.notes];

  for (const emojiName of emojiNormalized.emojiNames) {
    notes.push(
      `emoji:${emojiName}=Discord custom emoji/expression; not text offense by default`,
    );
  }

  if (badwordHits.length > 0) {
    notes.push(`local lexical check: Indonesian badword detected: ${badwordHits.join(", ")}`);
  } else {
    notes.push("local lexical check: no Indonesian badword detected");
  }

  return {
    raw: text,
    normalized: slangNormalized.text,
    notes: Array.from(new Set(notes)),
    badwords: badwordHits,
    hasBadwords: badwordHits.length > 0,
  };
}

export function formatModerationTextEvidenceForPrompt(text: string): string {
  const evidence = buildModerationTextEvidence(text);
  if (evidence.normalized === evidence.raw && evidence.notes.length === 0) {
    return "";
  }

  return [
    `[normalized_text: ${evidence.normalized}]`,
    evidence.notes.length > 0 ? `[normalization_notes: ${evidence.notes.join("; ")}]` : null,
  ]
    .filter(Boolean)
    .join(" ");
}
