#!/usr/bin/env bash
# Jalankan aplikasi SPJ BOS Otomatis.
set -e
cd "$(dirname "$0")"

if [ ! -d ".venv" ]; then
  echo "[*] Membuat virtual environment..."
  python3 -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate

echo "[*] Memasang dependensi..."
pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt

echo "[*] Menjalankan di http://127.0.0.1:5000"
python app.py
