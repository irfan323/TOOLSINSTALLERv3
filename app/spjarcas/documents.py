"""Penggabungan data + generator dokumen PDF.

- merge_transaksi: menggabungkan data Arcas (cache) dengan override pengguna
  (nama pemilik toko, narasi induk belanja, dll) menjadi satu konteks dokumen.
- ringkas_narasi: merangkum banyak item kecil menjadi narasi induk.
- render & export PDF memakai WeasyPrint, output dirapikan per-folder BPU.
"""

from __future__ import annotations

import os
import re

from . import store
from .terbilang import terbilang, rupiah

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "output")

BULAN_ID = [
    "", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
]


def tanggal_indo(iso: str) -> str:
    """'2026-01-08' -> '8 Januari 2026'."""
    m = re.match(r"(\d{4})-(\d{2})-(\d{2})", iso or "")
    if not m:
        return iso or ""
    y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
    return f"{d} {BULAN_ID[mo]} {y}"


def ringkas_narasi(items: list[dict]) -> str:
    """Membuat narasi induk default dari kumpulan item."""
    if not items:
        return "Belanja Barang/Jasa"
    teks = " ".join(it.get("nama", "").lower() for it in items)
    if any(k in teks for k in ("kertas", "pulpen", "spidol", "tinta", "map", "atk")):
        return "Belanja Alat Tulis Kantor (ATK)"
    if any(k in teks for k in ("sapu", "pel", "pembersih", "sampah", "kebersih")):
        return "Belanja Alat/Bahan Kebersihan"
    if any(k in teks for k in ("fotokopi", "foto copy", "jilid", "gandaan", "cetak")):
        return "Belanja Penggandaan/Fotokopi"
    if len(items) == 1:
        return items[0].get("nama", "Belanja Barang/Jasa")
    return "Belanja Barang/Jasa"


def merge_transaksi(tx: dict) -> dict:
    """Gabungkan transaksi + override menjadi konteks dokumen lengkap."""
    ov = store.get_override(tx["id"])
    data = dict(tx)
    items = [dict(it) for it in tx.get("items", [])]
    for it in items:
        it["jumlah"] = float(it.get("volume", 0)) * float(it.get("harga", 0))
        it["harga_rp"] = rupiah(it["harga"])
        it["jumlah_rp"] = rupiah(it["jumlah"])
    total = sum(it["jumlah"] for it in items)

    penyedia = dict(tx.get("penyedia") or {})
    # override nama pemilik toko (sering kosong di Arcas)
    if ov.get("pemilik"):
        penyedia["pemilik"] = ov["pemilik"]
    if ov.get("nama_toko"):
        penyedia["nama"] = ov["nama_toko"]
    if ov.get("alamat"):
        penyedia["alamat"] = ov["alamat"]
    if ov.get("telepon"):
        penyedia["telepon"] = ov["telepon"]

    narasi = ov.get("narasi") or tx.get("uraian") or ringkas_narasi(items)
    tanggal = ov.get("tanggal") or tx.get("tanggal")

    data.update({
        "items": items,
        "total": total,
        "total_rp": rupiah(total),
        "terbilang": terbilang(total),
        "penyedia": penyedia,
        "narasi": narasi,
        "tanggal": tanggal,
        "tanggal_indo": tanggal_indo(tanggal),
        "override": ov,
    })
    return data


def doc_context(tx_id: str) -> dict:
    tx = store.get_transaksi(tx_id)
    if not tx:
        return {}
    settings = store.get_settings()
    data = merge_transaksi(tx)
    return {"tx": data, "s": settings, "rupiah": rupiah}


# --- Perhitungan honorarium -------------------------------------------------
def hitung_honor(total: float, harga_satuan: float, penerima: list[dict]) -> dict:
    """Generate rincian honor.

    Volume terisi otomatis berdasarkan total pengeluaran dan harga satuan
    (sesuai RKAS). Total volume = total / harga_satuan, dibagi rata ke penerima
    dengan pembulatan, sisa dialokasikan ke penerima pertama.
    """
    total = float(total or 0)
    harga = float(harga_satuan or 0)
    n = max(len(penerima), 1)
    total_vol = int(round(total / harga)) if harga else 0
    base = total_vol // n
    sisa = total_vol - base * n
    rows = []
    for i, p in enumerate(penerima):
        vol = base + (sisa if i == 0 else 0)
        jml = vol * harga
        rows.append({
            "no": i + 1,
            "nama": p.get("nama", ""),
            "jabatan": p.get("jabatan", ""),
            "nip": p.get("nip", ""),
            "volume": vol,
            "satuan": p.get("satuan", "OK"),
            "harga": harga,
            "harga_rp": rupiah(harga),
            "jumlah": jml,
            "jumlah_rp": rupiah(jml),
        })
    grand = sum(r["jumlah"] for r in rows)
    return {
        "rows": rows,
        "total": grand,
        "total_rp": rupiah(grand),
        "terbilang": terbilang(grand),
        "total_volume": total_vol,
    }


# --- Generator PDF ----------------------------------------------------------
def render_pdf(html: str, base_url: str | None = None) -> bytes:
    from weasyprint import HTML
    return HTML(string=html, base_url=base_url).write_pdf()


def safe_name(name: str) -> str:
    return re.sub(r"[^A-Za-z0-9_.-]+", "_", (name or "").strip()) or "TANPA_BPU"


def output_path_for_bpu(no_bpu: str, filename: str) -> str:
    folder = os.path.join(OUTPUT_DIR, safe_name(no_bpu))
    os.makedirs(folder, exist_ok=True)
    return os.path.join(folder, filename)
