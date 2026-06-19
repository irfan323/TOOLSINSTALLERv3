"""Penyimpanan data aplikasi (pengaturan, hasil sinkron, override, honor).

Disimpan sebagai berkas JSON di folder data/ agar mudah dibaca, dicadangkan,
dan transparan. Transaksi hasil sinkron dari Arcas di-cache di sini sehingga
aplikasi tetap berfungsi walau Arcas sedang ditutup.
"""

from __future__ import annotations

import json
import os
import threading

_LOCK = threading.Lock()

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
SETTINGS_FILE = os.path.join(DATA_DIR, "settings.json")
CACHE_FILE = os.path.join(DATA_DIR, "transaksi_cache.json")
OVERRIDE_FILE = os.path.join(DATA_DIR, "overrides.json")
HONOR_FILE = os.path.join(DATA_DIR, "honor.json")

DEFAULT_SETTINGS = {
    "nama_pemda": "PEMERINTAH KABUPATEN/KOTA",
    "nama_dinas": "DINAS PENDIDIKAN",
    "satuan_pendidikan": "SD NEGERI CONTOH 1",
    "npsn": "20200000",
    "alamat_sekolah": "Jl. Pendidikan No. 1",
    "desa": "",
    "kecamatan": "Kecamatan Contoh",
    "kabupaten": "Kabupaten Contoh",
    "provinsi": "Jawa Barat",
    "kepala_sekolah": "Drs. Budi Santoso, M.Pd.",
    "nip_kepala": "19700101 199001 1 001",
    "bendahara": "Siti Aminah, S.Pd.",
    "nip_bendahara": "19800202 200502 2 002",
    "tahun_anggaran": 2026,
    "logo_pemda": "",
    "logo_sekolah": "",
    "arcas_db_path": "",
    "tim_pemeriksa": [
        {"nama": "Ahmad Fauzi, S.Pd.", "jabatan": "Ketua", "nip": "19750505 200001 1 003"},
        {"nama": "Dewi Lestari, S.Pd.", "jabatan": "Anggota", "nip": "19850606 201001 2 004"},
    ],
    "mapping": {},
}


def _read(path, default):
    if not os.path.exists(path):
        return json.loads(json.dumps(default))
    try:
        with open(path, "r", encoding="utf-8") as fh:
            return json.load(fh)
    except (json.JSONDecodeError, OSError):
        return json.loads(json.dumps(default))


def _write(path, data):
    os.makedirs(DATA_DIR, exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2)
    os.replace(tmp, path)


# --- Pengaturan -------------------------------------------------------------
def get_settings() -> dict:
    s = dict(DEFAULT_SETTINGS)
    s.update(_read(SETTINGS_FILE, {}))
    return s


def save_settings(updates: dict) -> dict:
    with _LOCK:
        s = get_settings()
        s.update(updates)
        _write(SETTINGS_FILE, s)
    return s


# --- Cache transaksi hasil sinkron -----------------------------------------
def save_cache(transaksi: list[dict]):
    with _LOCK:
        _write(CACHE_FILE, transaksi)


def get_cache() -> list[dict]:
    return _read(CACHE_FILE, [])


def get_transaksi(tx_id: str) -> dict | None:
    for t in get_cache():
        if str(t["id"]) == str(tx_id):
            return t
    return None


# --- Override (edit data yang tidak ada/ tidak lengkap di Arcas) ------------
def get_overrides() -> dict:
    return _read(OVERRIDE_FILE, {})


def get_override(tx_id: str) -> dict:
    return get_overrides().get(str(tx_id), {})


def save_override(tx_id: str, data: dict):
    with _LOCK:
        ov = get_overrides()
        ov[str(tx_id)] = data
        _write(OVERRIDE_FILE, ov)


# --- Honorarium -------------------------------------------------------------
def get_honor_list() -> list[dict]:
    return _read(HONOR_FILE, [])


def save_honor_list(items: list[dict]):
    with _LOCK:
        _write(HONOR_FILE, items)
