export interface SlangLexiconEntry {
  normalized: string;
  note: string;
  safeByDefault?: boolean;
}

export const INDONESIAN_SLANG_LEXICON: Record<string, SlangLexiconEntry> = {
  // =========================================================================
  // Pronouns & common abbreviations (neutral)
  // =========================================================================
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
  dh: { normalized: "sudah", note: "common abbreviation", safeByDefault: true },
  udh: {
    normalized: "sudah",
    note: "common abbreviation",
    safeByDefault: true,
  },
  blm: {
    normalized: "belum",
    note: "common abbreviation",
    safeByDefault: true,
  },
  sdh: {
    normalized: "sudah",
    note: "common abbreviation",
    safeByDefault: true,
  },
  dg: {
    normalized: "dengan",
    note: "common abbreviation",
    safeByDefault: true,
  },
  dr: { normalized: "dari", note: "common abbreviation", safeByDefault: true },
  dlm: {
    normalized: "dalam",
    note: "common abbreviation",
    safeByDefault: true,
  },
  gt: { normalized: "gitu", note: "common abbreviation", safeByDefault: true },
  doang: {
    normalized: "doang",
    note: "Indonesian 'only/just'",
    safeByDefault: true,
  },
  si: { normalized: "si", note: "Indonesian particle", safeByDefault: true },
  kah: {
    normalized: "kah",
    note: "Indonesian question particle",
    safeByDefault: true,
  },
  ku: {
    normalized: "aku",
    note: "first-person informal pronoun",
    safeByDefault: true,
  },
  mu: {
    normalized: "kamu",
    note: "second-person informal pronoun suffix",
    safeByDefault: true,
  },
  nya: {
    normalized: "nya",
    note: "Indonesian possessive suffix",
    safeByDefault: true,
  },

  // =========================================================================
  // Profanity — consonant-dropped / vowelless slang
  // =========================================================================
  ajg: { normalized: "anjing", note: "slang for 'anjing' (profanity)" },
  anjg: { normalized: "anjing", note: "slang for 'anjing' (profanity)" },
  njing: { normalized: "anjing", note: "slang for 'anjing' (profanity)" },
  aj: {
    normalized: "anjing",
    note: "ultra-short slang for 'anjing' (profanity)",
  },
  anj: { normalized: "anjing", note: "short slang for 'anjing' (profanity)" },
  anjingg: { normalized: "anjing", note: "elongated 'anjing' (profanity)" },
  ajgg: {
    normalized: "anjing",
    note: "vowelless + elongated 'anjing' (profanity)",
  },
  // anjir variants
  anjir: { normalized: "anjing", note: "slang for 'anjing' (profanity)" },
  njir: { normalized: "anjing", note: "slang for 'anjing' (profanity)" },
  njr: { normalized: "anjing", note: "vowelless 'anjir' (profanity)" },
  anjay: { normalized: "anjing", note: "slang 'anjay' (profanity-adjacent)" },
  bjir: {
    normalized: "anjing",
    note: "slang interjection 'bjir' (profanity-adjacent)",
  },
  bjirr: {
    normalized: "anjing",
    note: "elongated 'bjir' (profanity-adjacent)",
  },
  // bangsat variants
  bgsd: { normalized: "bangsat", note: "slang for 'bangsat' (profanity)" },
  bgst: { normalized: "bangsat", note: "slang for 'bangsat' (profanity)" },
  bngst: { normalized: "bangsat", note: "slang for 'bangsat' (profanity)" },
  bngsat: { normalized: "bangsat", note: "slang for 'bangsat' (profanity)" },
  bgsat: { normalized: "bangsat", note: "slang for 'bangsat' (profanity)" },
  bngstd: { normalized: "bangsat", note: "vowelless 'bangsat' (profanity)" },
  // brengsek
  brngsk: { normalized: "brengsek", note: "slang for 'brengsek' (profanity)" },
  // bajingan
  bjngn: { normalized: "bajingan", note: "slang for 'bajingan' (profanity)" },
  bjgn: { normalized: "bajingan", note: "slang for 'bajingan' (profanity)" },
  // kontol
  kntl: { normalized: "kontol", note: "slang for 'kontol' (profanity)" },
  knt: { normalized: "kontol", note: "slang for 'kontol' (profanity)" },
  kontl: { normalized: "kontol", note: "slang for 'kontol' (profanity)" },
  kntll: { normalized: "kontol", note: "elongated 'kontol' (profanity)" },
  // memek
  mmk: { normalized: "memek", note: "slang for 'memek' (profanity)" },
  memk: { normalized: "memek", note: "slang for 'memek' (profanity)" },
  mmkk: { normalized: "memek", note: "elongated 'memek' (profanity)" },
  // tai
  tae: { normalized: "tai", note: "slang for 'tai' (profanity)" },
  ty: { normalized: "tai", note: "slang for 'tai' (profanity)" },
  // goblok
  gblk: { normalized: "goblok", note: "slang for 'goblok' (profanity)" },
  goblog: { normalized: "goblok", note: "slang for 'goblok' (profanity)" },
  gblkkk: { normalized: "goblok", note: "elongated 'goblok' (profanity)" },
  // tolol
  tlol: { normalized: "tolol", note: "slang for 'tolol' (profanity)" },
  tloll: { normalized: "tolol", note: "elongated 'tolol' (profanity)" },
  // bego
  bgo: { normalized: "bego", note: "slang for 'bego' (profanity)" },
  bgoo: { normalized: "bego", note: "elongated 'bego' (profanity)" },
  // sialan
  slan: { normalized: "sialan", note: "slang for 'sialan' (profanity)" },
  sln: { normalized: "sialan", note: "slang for 'sialan' (profanity)" },
  sialann: { normalized: "sialan", note: "elongated 'sialan' (profanity)" },
  // jancuk (Javanese)
  jncuk: {
    normalized: "jancuk",
    note: "Javanese slang for 'jancuk' (profanity)",
  },
  jcuk: {
    normalized: "jancuk",
    note: "Javanese slang for 'jancuk' (profanity)",
  },
  jncukk: { normalized: "jancuk", note: "elongated 'jancuk' (profanity)" },
  // kampret
  kmprt: { normalized: "kampret", note: "slang for 'kampret' (profanity)" },
  kmpret: { normalized: "kampret", note: "slang for 'kampret' (profanity)" },
  // pepek
  ppk: { normalized: "pepek", note: "slang for 'pepek' (profanity)" },
  // jembut
  jmbt: { normalized: "jembut", note: "slang for 'jembut' (profanity)" },
  // ngentot
  ngntt: { normalized: "ngentot", note: "slang for 'ngentot' (profanity)" },
  ngnt: { normalized: "ngentot", note: "slang for 'ngentot' (profanity)" },
  // ngewe
  ngw: { normalized: "ngewe", note: "slang for 'ngewe' (profanity)" },
  // coli
  cli: { normalized: "coli", note: "slang for 'coli' (profanity)" },
  // celaka
  clka: { normalized: "celaka", note: "slang for 'celaka' (profanity)" },
  // laknat
  lknt: { normalized: "laknat", note: "slang for 'laknat' (profanity)" },
  // pantek
  pntk: { normalized: "pantek", note: "slang for 'pantek' (profanity)" },
  pntek: { normalized: "pantek", note: "slang for 'pantek' (profanity)" },
  // entod
  ntd: { normalized: "entod", note: "slang for 'entod' (profanity)" },
  // Javanese insults
  ndasmu: {
    normalized: "ndasmu",
    note: "Javanese insult 'ndasmu' (profanity)",
  },
  ndas: { normalized: "ndas", note: "Javanese insult 'ndas' (profanity)" },
  // piyo (Javanese profanity)
  piyoo: { normalized: "piyo", note: "Javanese slang 'piyo' (profanity)" },

  // =========================================================================
  // Sexual deviation / prohibited identity topics
  // =========================================================================
  lgbt: { normalized: "LGBT", note: "sexual deviation / prohibited topic" },
  lgbtq: { normalized: "LGBTQ", note: "sexual deviation / prohibited topic" },
  lgbtqi: { normalized: "LGBTQI", note: "sexual deviation / prohibited topic" },
  lgbtqa: { normalized: "LGBTQA", note: "sexual deviation / prohibited topic" },
  lgb: { normalized: "LGBT", note: "abbreviation for LGBT / prohibited topic" },
  lgbti: { normalized: "LGBTI", note: "sexual deviation / prohibited topic" },
  // furry subculture
  furry: { normalized: "furry", note: "furry / prohibited topic" },
  furries: { normalized: "furry", note: "furry / prohibited topic" },
  transfurry: {
    normalized: "transfurry",
    note: "transfurry / prohibited topic",
  },
  transfur: {
    normalized: "transfurry",
    note: "slang for 'transfurry' / prohibited topic",
  },
  protogen: {
    normalized: "protogen",
    note: "furry subculture / prohibited topic",
  },
  therian: { normalized: "therian", note: "therianthropy / prohibited topic" },
  therianthropy: {
    normalized: "therianthropy",
    note: "therianthropy / prohibited topic",
  },
  otherkin: {
    normalized: "otherkin",
    note: "otherkin identity / prohibited topic",
  },
  // furry-adjacent terms
  yiff: { normalized: "yiff", note: "furry sexual content / prohibited topic" },
  fursona: { normalized: "fursona", note: "furry persona / prohibited topic" },
  fursonas: {
    normalized: "fursona",
    note: "furry personas / prohibited topic",
  },
  fursuit: { normalized: "fursuit", note: "furry costume / prohibited topic" },
  fursuits: {
    normalized: "fursuit",
    note: "furry costumes / prohibited topic",
  },
  // sexual orientation terms
  gayy: { normalized: "gay", note: "elongated 'gay' / prohibited topic" },
  lesbi: { normalized: "lesbian", note: "lesbian / prohibited topic" },
  lesbii: {
    normalized: "lesbian",
    note: "slang for 'lesbian' / prohibited topic",
  },
  homo: { normalized: "homo", note: "homosexual slur / prohibited topic" },
  waria: { normalized: "waria", note: "waria / prohibited topic" },
  trans: { normalized: "transgender", note: "transgender / prohibited topic" },
  nonbinary: {
    normalized: "nonbinary",
    note: "nonbinary identity / prohibited topic",
  },
  nb: {
    normalized: "nonbinary",
    note: "nonbinary abbreviation / prohibited topic",
  },
  genderfluid: {
    normalized: "genderfluid",
    note: "genderfluid / prohibited topic",
  },
  pansexual: { normalized: "pansexual", note: "pansexual / prohibited topic" },
  asexual: { normalized: "asexual", note: "asexual / prohibited topic" },
  ace: {
    normalized: "asexual",
    note: "asexual abbreviation / prohibited topic",
  },
  enby: { normalized: "enby", note: "NB/nonbinary slang / prohibited topic" },

  // =========================================================================
  // Interjections / safe expressions (NOT profanity)
  // =========================================================================
  woy: {
    normalized: "woy",
    note: "casual Indonesian interjection/greeting; not SARA/hate/harassment by default",
    safeByDefault: true,
  },
  woyy: {
    normalized: "woy",
    note: "elongated 'woy'",
    safeByDefault: true,
  },
  woi: {
    normalized: "woi",
    note: "casual Indonesian interjection/greeting; not SARA/hate/harassment by default",
    safeByDefault: true,
  },
  woii: {
    normalized: "woi",
    note: "elongated 'woi'",
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
  hadehh: {
    normalized: "hadeh",
    note: "elongated 'hadeh'",
    safeByDefault: true,
  },
  astaga: {
    normalized: "astaga",
    note: "Indonesian exclamation of surprise",
    safeByDefault: true,
  },
  astagfirullah: {
    normalized: "astagfirullah",
    note: "Islamic exclamation",
    safeByDefault: true,
  },
  masyaallah: {
    normalized: "masyaallah",
    note: "Islamic exclamation",
    safeByDefault: true,
  },
  allahu: {
    normalized: "allahu",
    note: "Islamic exclamation",
    safeByDefault: true,
  },
  aduh: {
    normalized: "aduh",
    note: "Indonesian expression of pain/surprise",
    safeByDefault: true,
  },
  aduhh: {
    normalized: "aduh",
    note: "elongated 'aduh'",
    safeByDefault: true,
  },
  buset: {
    normalized: "buset",
    note: "mild Indonesian exclamation",
    safeByDefault: true,
  },
  busyet: {
    normalized: "buset",
    note: "variant of 'buset'",
    safeByDefault: true,
  },
  gila: {
    normalized: "gila",
    note: "'crazy' — context-dependent; can be exclamation or insult",
  },
  gilaa: {
    normalized: "gila",
    note: "elongated 'gila' — context-dependent",
  },
  stres: {
    normalized: "stres",
    note: "stress expression",
    safeByDefault: true,
  },
  pusing: {
    normalized: "pusing",
    note: "dizzy/confused expression",
    safeByDefault: true,
  },

  // =========================================================================
  // Laughter expressions (safe)
  // =========================================================================
  wkwk: {
    normalized: "wkwk",
    note: "Indonesian laughter expression",
    safeByDefault: true,
  },
  wkwkwk: {
    normalized: "wkwk",
    note: "Indonesian laughter expression",
    safeByDefault: true,
  },
  wk: {
    normalized: "wkwk",
    note: "Indonesian laughter expression",
    safeByDefault: true,
  },
  wkwkwkwk: {
    normalized: "wkwk",
    note: "Indonesian laughter expression",
    safeByDefault: true,
  },
  lol: {
    normalized: "lol",
    note: "English laughter",
    safeByDefault: true,
  },
  lmao: {
    normalized: "lmao",
    note: "English laughter",
    safeByDefault: true,
  },
  rofl: {
    normalized: "rofl",
    note: "English laughter",
    safeByDefault: true,
  },
  xixixi: {
    normalized: "xixixi",
    note: "laughter expression",
    safeByDefault: true,
  },
  hehe: {
    normalized: "hehe",
    note: "laughter expression",
    safeByDefault: true,
  },
  hahaha: {
    normalized: "hahaha",
    note: "laughter expression",
    safeByDefault: true,
  },

  // =========================================================================
  // Casual Indonesian slang (safe)
  // =========================================================================
  santuy: {
    normalized: "santai",
    note: "relaxed/casual Indonesian",
    safeByDefault: true,
  },
  gaskeun: {
    normalized: "gaskeun",
    note: "Indonesian slang for 'let's go'",
    safeByDefault: true,
  },
  gas: {
    normalized: "gas",
    note: "Indonesian slang for 'go/yes'",
    safeByDefault: true,
  },
  baka: {
    normalized: "baka",
    note: "Japanese 'idiot' (anime slang)",
    safeByDefault: true,
  },
  kawai: {
    normalized: "kawaii",
    note: "Japanese 'cute' (anime slang)",
    safeByDefault: true,
  },
  sugoi: {
    normalized: "sugoi",
    note: "Japanese 'amazing' (anime slang)",
    safeByDefault: true,
  },
  nani: {
    normalized: "nani",
    note: "Japanese 'what' (anime slang)",
    safeByDefault: true,
  },
  bts: {
    normalized: "bts",
    note: "K-pop group abbreviation",
    safeByDefault: true,
  },
  otw: {
    normalized: "on the way",
    note: "common internet abbreviation",
    safeByDefault: true,
  },
  brb: {
    normalized: "be right back",
    note: "common internet abbreviation",
    safeByDefault: true,
  },
  afk: {
    normalized: "away from keyboard",
    note: "common internet abbreviation",
    safeByDefault: true,
  },
  btw: {
    normalized: "by the way",
    note: "English common abbreviation",
    safeByDefault: true,
  },
  omg: {
    normalized: "oh my god",
    note: "English interjection",
    safeByDefault: true,
  },
  pls: {
    normalized: "please",
    note: "English common abbreviation",
    safeByDefault: true,
  },
  thx: {
    normalized: "thanks",
    note: "English common abbreviation",
    safeByDefault: true,
  },
  tq: {
    normalized: "thanks",
    note: "English common abbreviation",
    safeByDefault: true,
  },
  imo: {
    normalized: "in my opinion",
    note: "English common abbreviation",
    safeByDefault: true,
  },
  tbh: {
    normalized: "to be honest",
    note: "English common abbreviation",
    safeByDefault: true,
  },
  idk: {
    normalized: "I don't know",
    note: "English common abbreviation",
    safeByDefault: true,
  },
  rn: {
    normalized: "right now",
    note: "English common abbreviation",
    safeByDefault: true,
  },
  sm: {
    normalized: "sama",
    note: "Indonesian 'same' or 'with'",
    safeByDefault: true,
  },
  gpp: {
    normalized: "gapapa",
    note: "Indonesian 'it's okay'",
    safeByDefault: true,
  },
  gapapa: {
    normalized: "gapapa",
    note: "Indonesian 'it's okay'",
    safeByDefault: true,
  },
  // =========================================================================
  // Spam / scam / self-promo indicators
  // =========================================================================
  gcash: { normalized: "gcash", note: "potential scam/crypto term" },
  airdrop: { normalized: "airdrop", note: "potential crypto scam" },
  giveaway: { normalized: "giveaway", note: "potential spam — check context" },
  follow4follow: { normalized: "follow4follow", note: "spam engagement" },
  f4f: { normalized: "follow4follow", note: "spam engagement abbreviation" },
  sub4sub: { normalized: "sub4sub", note: "spam engagement" },
  s4s: { normalized: "sub4sub", note: "spam engagement abbreviation" },
  like4like: { normalized: "like4like", note: "spam engagement" },
  l4l: { normalized: "like4like", note: "spam engagement abbreviation" },
  dm: {
    normalized: "DM",
    note: "direct message — check for spam/scam context",
  },
  pm: {
    normalized: "PM",
    note: "private message — check for spam/scam context",
  },
  click: { normalized: "click", note: "potential clickbait/scam" },
  link: { normalized: "link", note: "potential spam link — check context" },
  free: { normalized: "free", note: "potential spam bait — check context" },
  nitro: {
    normalized: "nitro",
    note: "Discord Nitro — common in scam/free nitro spam",
  },

  // =========================================================================
  // Drug / substance slang
  // =========================================================================
  ganja: { normalized: "ganja", note: "marijuana / prohibited topic" },
  weed: { normalized: "ganja", note: "marijuana slang / prohibited topic" },
  sabu: { normalized: "sabu", note: "methamphetamine / prohibited topic" },
  narkotika: { normalized: "narkotika", note: "narcotics / prohibited topic" },
  narkoba: { normalized: "narkoba", note: "narcotics / prohibited topic" },
  kokain: { normalized: "kokain", note: "cocaine / prohibited topic" },
  ekstasi: { normalized: "ekstasi", note: "ecstasy / prohibited topic" },
  shabu: {
    normalized: "sabu",
    note: "variant spelling 'sabu' / prohibited topic",
  },

  // =========================================================================
  // Violence / threat indicators
  // =========================================================================
  bunuh: { normalized: "bunuh", note: "kill / violence indicator" },
  bunuhdiri: {
    normalized: "bunuh diri",
    note: "suicide / self-harm indicator",
  },
  mati: { normalized: "mati", note: "die / death — context-dependent" },
  matiin: {
    normalized: "matikan",
    note: "turn off / kill — context-dependent",
  },
  ancam: { normalized: "ancam", note: "threat indicator" },
  ancamn: { normalized: "ancaman", note: "threat indicator" },
  bakar: { normalized: "bakar", note: "burn / violence indicator" },
  pukul: { normalized: "pukul", note: "hit/punch / violence indicator" },
  tikam: { normalized: "tikam", note: "stab / violence indicator" },
  tembak: { normalized: "tembak", note: "shoot / violence indicator" },
  bom: { normalized: "bom", note: "bomb / violence indicator" },
  teror: { normalized: "teror", note: "terror / violence indicator" },
  perang: { normalized: "perang", note: "war / conflict indicator" },

  // =========================================================================
  // Religious / cultural sensitivity terms (context-dependent, not flagged by
  // default — LLM must evaluate context carefully)
  // =========================================================================
  kafir: { normalized: "kafir", note: "religious slur — context-dependent" },
  musrik: { normalized: "musyrik", note: "religious term — context-dependent" },
  kufur: { normalized: "kufur", note: "religious term — context-dependent" },
  sesat: { normalized: "sesat", note: "heretic — context-dependent" },
  halal: {
    normalized: "halal",
    note: "Islamic term",
    safeByDefault: true,
  },
  haram: {
    normalized: "haram",
    note: "Islamic prohibition term — context-dependent",
  },
  dosa: {
    normalized: "dosa",
    note: "sin — context-dependent",
  },
  taubat: {
    normalized: "taubat",
    note: "repentance — context-dependent",
    safeByDefault: true,
  },
  shalat: {
    normalized: "shalat",
    note: "Islamic prayer",
    safeByDefault: true,
  },
  sholat: {
    normalized: "sholat",
    note: "Islamic prayer (variant)",
    safeByDefault: true,
  },
  puasa: {
    normalized: "puasa",
    note: "fasting",
    safeByDefault: true,
  },
  ramadhan: {
    normalized: "ramadhan",
    note: "Ramadan",
    safeByDefault: true,
  },
  idul: {
    normalized: "idul",
    note: "Islamic holiday prefix",
    safeByDefault: true,
  },
  fitri: {
    normalized: "fitri",
    note: "Islamic holiday suffix",
    safeByDefault: true,
  },
  qurban: {
    normalized: "qurban",
    note: "Islamic sacrifice",
    safeByDefault: true,
  },
  kurban: {
    normalized: "kurban",
    note: "Islamic sacrifice (variant)",
    safeByDefault: true,
  },
  masjid: {
    normalized: "masjid",
    note: "mosque",
    safeByDefault: true,
  },
  gereja: {
    normalized: "gereja",
    note: "church",
    safeByDefault: true,
  },
  vihara: {
    normalized: "vihara",
    note: "Buddhist temple",
    safeByDefault: true,
  },
  pura: {
    normalized: "pura",
    note: "Hindu temple",
    safeByDefault: true,
  },
  klenteng: {
    normalized: "klenteng",
    note: "Chinese temple",
    safeByDefault: true,
  },

  // =========================================================================
  // NSFW / sexual content terms (outside furry/LGBT scope)
  // =========================================================================
  hentai: { normalized: "hentai", note: "anime porn / NSFW content" },
  porn: { normalized: "porno", note: "pornography / NSFW content" },
  porno: { normalized: "porno", note: "pornography / NSFW content" },
  bokep: { normalized: "bokep", note: "pornography / NSFW content" },
  bokap: {
    normalized: "bokap",
    note: "'father' slang — NOT bokep",
    safeByDefault: true,
  },
  ngeseks: { normalized: "ngeseks", note: "having sex / NSFW content" },
  masturbasi: { normalized: "masturbasi", note: "masturbation / NSFW content" },
  onani: { normalized: "onani", note: "masturbation / NSFW content" },
  colok: { normalized: "colok", note: "sexual act / NSFW context" },
  blowjob: { normalized: "blowjob", note: "sexual act / NSFW content" },
  bj: { normalized: "blowjob", note: "sexual act abbreviation / NSFW content" },
  cumshot: { normalized: "cumshot", note: "sexual act / NSFW content" },
  creampie: { normalized: "creampie", note: "sexual act / NSFW content" },
  threesome: { normalized: "threesome", note: "sexual act / NSFW content" },
  orgy: { normalized: "orgy", note: "sexual act / NSFW content" },
  gangbang: { normalized: "gangbang", note: "sexual act / NSFW content" },
  milf: { normalized: "milf", note: "sexual category / NSFW content" },
  loli: { normalized: "loli", note: "underage sexual content / illegal" },
  shota: { normalized: "shota", note: "underage sexual content / illegal" },
  cp: { normalized: "cp", note: "child pornography abbreviation / illegal" },
  pedo: { normalized: "pedo", note: "pedophilia / illegal" },
  pedofil: { normalized: "pedofil", note: "pedophile / illegal" },

  // =========================================================================
  // Gambling
  // =========================================================================
  judi: { normalized: "judi", note: "gambling / prohibited topic" },
  slot: { normalized: "slot", note: "slot gambling — check context" },
  slotgacor: { normalized: "slot gacor", note: "gambling spam term" },
  gacor: {
    normalized: "gacor",
    note: "gambling spam term — but also slang for 'good', context-dependent",
  },
  togel: { normalized: "togel", note: "lottery gambling / prohibited topic" },
  poker: { normalized: "poker", note: "poker gambling — check context" },
  sbobet: { normalized: "sbobet", note: "gambling site / prohibited topic" },
  parlay: { normalized: "parlay", note: "gambling term / prohibited topic" },
  maxwin: { normalized: "maxwin", note: "gambling spam term" },
  rtp: { normalized: "rtp", note: "gambling RTP term — check context" },
  depo: {
    normalized: "deposit",
    note: "deposit — common in gambling spam, check context",
  },
  wd: { normalized: "withdraw", note: "withdraw — common in gambling spam" },
  jackpot: {
    normalized: "jackpot",
    note: "jackpot — common in gambling spam, check context",
  },

  // =========================================================================
  // Money / financial scam indicators
  // =========================================================================
  investment: {
    normalized: "investment",
    note: "potential investment scam — check context",
  },
  investasi: {
    normalized: "investasi",
    note: "potential investment scam — check context",
  },
  crypto: { normalized: "crypto", note: "crypto scam — check context" },
  bitcoin: { normalized: "bitcoin", note: "crypto — check context" },
  btc: { normalized: "bitcoin", note: "crypto — check context" },
  usdt: { normalized: "usdt", note: "crypto stablecoin — check context" },
  binance: { normalized: "binance", note: "crypto exchange — check context" },
  forex: { normalized: "forex", note: "forex trading — check context" },
  trading: { normalized: "trading", note: "trading — check context" },
  profit: { normalized: "profit", note: "scam bait — check context" },
  bonus: { normalized: "bonus", note: "spam bait — check context" },
  hadiah: { normalized: "hadiah", note: "prize scam — check context" },
  menang: { normalized: "menang", note: "win — check context" },
  claim: { normalized: "claim", note: "scam bait — check context" },
  klaim: { normalized: "klaim", note: "scam bait — check context" },
  verify: { normalized: "verify", note: "potential phishing — check context" },
  verifikasi: {
    normalized: "verifikasi",
    note: "potential phishing — check context",
  },
  wallet: { normalized: "wallet", note: "crypto wallet — check context" },
  seed: {
    normalized: "seed phrase",
    note: "crypto seed phrase — check context",
  },
  recovery: {
    normalized: "recovery phrase",
    note: "crypto recovery — check context",
  },
};
