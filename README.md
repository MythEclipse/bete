# 🎙️ Discord Voice Recorder Bot

Bot Discord yang **otomatis join ke voice channel** saat startup dan **merekam suara** semua pengguna yang bicara. File audio disimpan secara lokal dalam format `.ogg`.

Dibangun dengan **Bun** + **discord.js** + **@discordjs/voice**.

---

## 📋 Prasyarat

- [Bun](https://bun.sh) >= 1.0
- FFmpeg (untuk encoding audio)
  ```bash
  # Ubuntu/Debian
  sudo apt install ffmpeg
  
  # Arch
  sudo pacman -S ffmpeg
  ```
- Discord Bot dengan permission:
  - `Connect` (join voice channel)
  - `Use Voice Activity`
  - `Read Messages/View Channels`
  - Privileged Intents: **Server Members Intent** (aktifkan di Developer Portal)

---

## ⚙️ Setup

### 1. Clone & Install
```bash
cd /path/to/bot
bun install
```

### 2. Konfigurasi `.env`
```bash
cp .env.example .env
```

Edit `.env`:
```env
DISCORD_TOKEN=your_bot_token_here
VOICE_CHANNEL_ID=your_voice_channel_id_here
GUILD_ID=your_guild_id_here
RECORDINGS_DIR=./recordings
```

**Cara mendapatkan ID:**
- Aktifkan **Developer Mode** di Discord (Settings → Advanced → Developer Mode)
- Klik kanan pada voice channel → **Copy Channel ID** → paste ke `VOICE_CHANNEL_ID`
- Klik kanan pada server/guild → **Copy Server ID** → paste ke `GUILD_ID`
- Token bot dari [Discord Developer Portal](https://discord.com/developers/applications) → Bot → Reset Token

### 3. Invite Bot ke Server
Di Developer Portal → OAuth2 → URL Generator:
- Scopes: `bot`
- Bot Permissions: `Connect`, `Use Voice Activity`, `View Channels`

Copy URL, buka di browser, pilih server.

---

## 🚀 Menjalankan Bot

```bash
# Development (auto-restart saat file berubah)
bun run dev

# Production
bun run start
```

Bot akan langsung join ke voice channel yang ditentukan dalam `.env`.

---

## 📁 Struktur File Rekaman

```
recordings/
  ├── 123456789-1709900000000.ogg   # <user-id>-<timestamp>.ogg
  ├── 987654321-1709900001234.ogg
  └── ...
```

Setiap kali user bicara dan berhenti (>1 detik diam), satu file `.ogg` baru dibuat.

---

## 📁 Struktur Proyek

```
bot/
├── src/
│   ├── index.ts       # Entry point — login & auto-join
│   └── recorder.ts    # Core recording logic
├── recordings/        # File audio tersimpan (otomatis dibuat)
├── .env               # Konfigurasi (buat dari .env.example)
├── .env.example
├── package.json
└── tsconfig.json
```
