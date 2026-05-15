#!/usr/bin/env sh
set -eu

if command -v yt-dlp >/dev/null 2>&1; then
  echo "yt-dlp already installed: $(command -v yt-dlp)"
  yt-dlp --version
  exit 0
fi

if command -v pacman >/dev/null 2>&1; then
  sudo pacman -S --needed yt-dlp
elif command -v apt-get >/dev/null 2>&1; then
  sudo apt-get update
  sudo apt-get install -y yt-dlp
elif command -v dnf >/dev/null 2>&1; then
  sudo dnf install -y yt-dlp
elif command -v brew >/dev/null 2>&1; then
  brew install yt-dlp
elif command -v pipx >/dev/null 2>&1; then
  pipx install yt-dlp
elif command -v python3 >/dev/null 2>&1; then
  python3 -m pip install --user --upgrade yt-dlp
else
  echo "Could not find pacman, apt-get, dnf, brew, pipx, or python3 to install yt-dlp." >&2
  exit 1
fi

if ! command -v yt-dlp >/dev/null 2>&1; then
  echo "yt-dlp installed but is not on PATH. Restart your shell or add the installer bin directory to PATH." >&2
  exit 1
fi

echo "yt-dlp installed: $(command -v yt-dlp)"
yt-dlp --version
