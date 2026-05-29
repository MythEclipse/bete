export interface SlangLexiconEntry {
  normalized: string;
  note: string;
  safeByDefault?: boolean;
}

export const INDONESIAN_SLANG_LEXICON: Record<string, SlangLexiconEntry> = {
  gw: { normalized: "gue", note: "first-person informal pronoun" },
  gue: { normalized: "gue", note: "first-person informal pronoun" },
  gua: { normalized: "gue", note: "first-person informal pronoun" },
  lo: { normalized: "lu", note: "second-person informal pronoun" },
  lu: { normalized: "lu", note: "second-person informal pronoun" },
  loe: { normalized: "lu", note: "second-person informal pronoun" },
  yg: { normalized: "yang", note: "common abbreviation" },
  emg: { normalized: "memang", note: "common abbreviation" },
  kyk: { normalized: "kayak", note: "common abbreviation" },
  tdk: { normalized: "tidak", note: "common abbreviation" },
  krn: { normalized: "karena", note: "common abbreviation" },
  jgn: { normalized: "jangan", note: "common abbreviation" },
  woy: {
    normalized: "woy",
    note: "casual Indonesian interjection/greeting; not SARA/hate/harassment by default",
    safeByDefault: true,
  },
  woi: {
    normalized: "woi",
    note: "casual Indonesian interjection/greeting; not SARA/hate/harassment by default",
    safeByDefault: true,
  },
  oi: {
    normalized: "oi",
    note: "casual call/interjection; not offensive by default",
    safeByDefault: true,
  },
  hadeh: {
    normalized: "hadeh",
    note: "facepalm/tired expression; not offensive by default",
    safeByDefault: true,
  },
  hadeuh: {
    normalized: "hadeh",
    note: "facepalm/tired expression; not offensive by default",
    safeByDefault: true,
  },
};
