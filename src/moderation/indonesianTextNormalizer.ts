import axios from "axios";
import { config } from "../config.js";
import { INDONESIAN_SLANG_LEXICON } from "./resources/indonesianSlangLexicon.js";
import { createChildLogger } from "../logger.js";

const log = createChildLogger("indonesianTextNormalizer");

const CUSTOM_EMOJI_PATTERN = /<a?:([a-zA-Z0-9_]+):(\d+)>/g;
const WORD_PATTERN = /[\p{L}\p{N}_]+/gu;

/** NVIDIA content safety categories that map to offensive/badword content. */
const NVIDIA_BAD_CATEGORIES = new Set([
  "hate",
  "harassment",
  "sexual",
  "violence",
  "self-harm",
  "illicit",
  "profanity",
  "vulgar",
  "insult",
]);

/**
 * Map NVIDIA Nemotron category labels to Indonesian badword-style labels.
 */
const CATEGORY_TO_BADWORD_LABEL: Record<string, string> = {
  hate: "hate_speech",
  harassment: "harassment",
  sexual: "sexual_content",
  violence: "violence",
  "self-harm": "self_harm",
  illicit: "illegal_content",
  profanity: "vulgar_language",
  vulgar: "vulgar_language",
  insult: "harassment",
};

export interface ModerationTextEvidence {
  raw: string;
  normalized: string;
  notes: string[];
  badwords: string[];
  hasBadwords: boolean;
}

// ---------------------------------------------------------------------------
// Sync helpers (unchanged)
// ---------------------------------------------------------------------------

export function normalizeDiscordCustomEmoji(text: string): {
  text: string;
  emojiNames: string[];
} {
  const emojiNames: string[] = [];
  const normalized = text.replace(
    CUSTOM_EMOJI_PATTERN,
    (_match, name: string) => {
      emojiNames.push(name);
      return `[emoji:${name}]`;
    },
  );

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

// ---------------------------------------------------------------------------
// Local fallback badword list (used when NVIDIA API is unavailable)
// ---------------------------------------------------------------------------

const LOCAL_BADWORDS = [
  "anjing",
  "bangsat",
  "brengsek",
  "bajingan",
  "kontol",
  "memek",
  "tai",
  "goblok",
  "tolol",
  "bego",
  "sialan",
  "jancuk",
  "kampret",
  "pepek",
  "jembut",
  "ngentot",
  "ngewe",
  "coli",
  "celaka",
  "laknat",
  "pantek",
  "entod",
  "ndasmu",
  "ndas",
  "piyo",
  "asu",
];

const FALSE_POSITIVE_WHITELISTS: Record<string, string[]> = {
  asu: [
    "asus",
    "masuk",
    "termasuk",
    "dimasukkan",
    "memasukkan",
    "kasur",
    "asumsi",
    "asuransi",
    "asupan",
    "pasukan",
    "pasundan",
  ],
  goblok: ["goblok"],
  kontol: ["kontol"],
  memek: ["memek"],
  tolol: ["tolol"],
};

function detectLocalBadwords(text: string): string[] {
  const lowerText = text.toLowerCase();
  const words = lowerText.match(/[\p{L}\p{N}_]+/gu) || [];

  const isRealHit = (hit: string, whitelist: string[]): boolean => {
    for (const w of words) {
      if (w.includes(hit)) {
        if (w === hit) return true;
        if (!whitelist.includes(w)) return true;
      }
    }
    return false;
  };

  const hits: string[] = [];

  for (const badword of LOCAL_BADWORDS) {
    const whitelist = FALSE_POSITIVE_WHITELISTS[badword] ?? [badword];
    if (isRealHit(badword, whitelist)) {
      hits.push(badword);
    }
  }

  return Array.from(new Set(hits));
}

// ---------------------------------------------------------------------------
// NVIDIA Nemotron-3 Content Safety API
// ---------------------------------------------------------------------------

/**
 * Call NVIDIA Nemotron-3 Content Safety API to detect harmful content.
 * Returns categories/flags from the API response.
 */
async function callNemotronContentSafety(text: string): Promise<string[]> {
  const apiKey = config.NVIDIA_NEMOTRON_API_KEY;
  if (!apiKey) {
    return [];
  }

  const response = await axios.post(
    config.NVIDIA_NEMOTRON_BASE_URL,
    {
      model: config.NVIDIA_NEMOTRON_MODEL,
      messages: [{ role: "user", content: text }],
      max_tokens: 897,
      temperature: 0.2,
      top_p: 0.7,
      stream: false,
      chat_template_kwargs: { request_categories: "/categories" },
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
      timeout: 15_000,
    },
  );

  const data = response.data;
  const categories: string[] = [];

  // Parse the LLM response for category flags
  const content = data?.choices?.[0]?.message?.content ?? "";
  if (content) {
    const lowerContent = content.toLowerCase();
    for (const category of NVIDIA_BAD_CATEGORIES) {
      // Check if the category appears as a key in the response
      // The Nemotron content safety model returns structured data with category scores
      if (lowerContent.includes(category)) {
        categories.push(CATEGORY_TO_BADWORD_LABEL[category] ?? category);
      }
    }
  }

  // Also check for structured response fields
  const choice = data?.choices?.[0];
  if (choice?.message?.content) {
    try {
      const parsed = JSON.parse(choice.message.content);
      if (parsed.categories && Array.isArray(parsed.categories)) {
        for (const cat of parsed.categories) {
          if (NVIDIA_BAD_CATEGORIES.has(cat.name ?? cat)) {
            categories.push(CATEGORY_TO_BADWORD_LABEL[cat.name ?? cat] ?? cat);
          }
        }
      }
    } catch {
      // Not JSON — already handled via text search above
    }
  }

  return Array.from(new Set(categories));
}

/**
 * Detect badwords in text using NVIDIA Nemotron-3 Content Safety API.
 * Falls back to local lexical list if API key is missing or call fails.
 */
export async function detectIndonesianBadwords(
  text: string,
): Promise<string[]> {
  // Always run local detection first (fast, no network dependency)
  const localHits = detectLocalBadwords(text);

  // Try NVIDIA API if key is configured
  const apiKey = config.NVIDIA_NEMOTRON_API_KEY;
  if (apiKey) {
    try {
      const apiCategories = await callNemotronContentSafety(text);
      const allHits = Array.from(new Set([...localHits, ...apiCategories]));
      return allHits;
    } catch (error) {
      log.warn(
        { error },
        "NVIDIA Nemotron API call failed, falling back to local detection",
      );
    }
  }

  return localHits;
}

// ---------------------------------------------------------------------------
// Async evidence builders
// ---------------------------------------------------------------------------

export async function buildModerationTextEvidence(
  text: string,
): Promise<ModerationTextEvidence> {
  const emojiNormalized = normalizeDiscordCustomEmoji(text);
  const slangNormalized = normalizeIndonesianSlang(emojiNormalized.text);
  const badwordHits = await detectIndonesianBadwords(slangNormalized.text);
  const notes = [...slangNormalized.notes];

  for (const emojiName of emojiNormalized.emojiNames) {
    notes.push(
      `emoji:${emojiName}=Discord custom emoji/expression; not text offense by default`,
    );
  }

  if (badwordHits.length > 0) {
    notes.push(`Indonesian badword detected: ${badwordHits.join(", ")}`);
  } else {
    notes.push("no Indonesian badword detected");
  }

  return {
    raw: text,
    normalized: slangNormalized.text,
    notes: Array.from(new Set(notes)),
    badwords: badwordHits,
    hasBadwords: badwordHits.length > 0,
  };
}

export async function formatModerationTextEvidenceForPrompt(
  text: string,
): Promise<string> {
  const evidence = await buildModerationTextEvidence(text);
  if (evidence.normalized === evidence.raw && evidence.notes.length === 0) {
    return "";
  }

  return [
    `[normalized_text: ${evidence.normalized}]`,
    evidence.notes.length > 0
      ? `[normalization_notes: ${evidence.notes.join("; ")}]`
      : null,
  ]
    .filter(Boolean)
    .join(" ");
}
