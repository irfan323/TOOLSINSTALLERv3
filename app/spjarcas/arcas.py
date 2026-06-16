"""Integrasi database Arcas / ARKAS.

Arcas (Aplikasi Rencana Kegiatan dan Anggaran Sekolah) menyimpan data pada
basis data lokal berbasis SQLite. Modul ini:

1. Menyediakan ArcasReader yang membaca transaksi langsung dari file .db Arcas
   dengan pemetaan tabel/kolom yang dapat dikonfigurasi (default mengikuti
   skema contoh di bawah).
2. Menyediakan pembuat database contoh (build_sample_db) sehingga aplikasi
   tetap dapat didemokan tanpa instalasi Arcas yang sebenarnya.

Karena skema Arcas asli dapat berbeda antar versi, pemetaan kolom dibuat
fleksibel melalui dictionary MAPPING. Sesuaikan bila perlu di Pengaturan.
"""

from __future__ import annotations

import os
import sqlite3
from dataclasses import dataclass, field, asdict
from datetime import date


# --- Skema yang diharapkan dari database Arcas ------------------------------
# Bila database Arcas asli memakai nama tabel/kolom berbeda, ubah pemetaan
# ini lewat halaman Pengaturan -> Mapping.
DEFAULT_MAPPING = {
    "transaksi_table": "transaksi",
    "item_table": "transaksi_item",
    "penyedia_table": "penyedia",
    # kolom transaksi
    "t_id": "id",
    "t_bpu": "no_bpu",
    "t_tanggal": "tanggal",
    "t_kegiatan": "kegiatan",
    "t_kode_kegiatan": "kode_kegiatan",
    "t_kode_rekening": "kode_rekening",
    "t_kode_program": "kode_program",
    "t_uraian": "uraian",
    "t_penyedia_id": "penyedia_id",
    "t_bulan": "bulan",
    "t_tahun": "tahun",
    # kolom item
    "i_transaksi_id": "transaksi_id",
    "i_nama": "nama_barang",
    "i_volume": "volume",
    "i_satuan": "satuan",
    "i_harga": "harga_satuan",
    # kolom penyedia
    "p_id": "id",
    "p_nama": "nama_toko",
    "p_alamat": "alamat",
    "p_telepon": "telepon",
    "p_pemilik": "pemilik",
}


@dataclass
class Item:
    nama: str
    volume: float
    satuan: str
    harga: float

    @property
    def jumlah(self) -> float:
        return float(self.volume) * float(self.harga)


@dataclass
class Penyedia:
    id: str
    nama: str = ""
    alamat: str = ""
    telepon: str = ""
    pemilik: str = ""


@dataclass
class Transaksi:
    id: str
    no_bpu: str
    tanggal: str
    kegiatan: str = ""
    kode_program: str = ""
    kode_kegiatan: str = ""
    kode_rekening: str = ""
    uraian: str = ""
    bulan: int = 0
    tahun: int = 0
    penyedia: Penyedia = field(default_factory=lambda: Penyedia(id=""))
    items: list = field(default_factory=list)

    @property
    def total(self) -> float:
        return sum(it.jumlah for it in self.items)

    def to_dict(self):
        d = asdict(self)
        d["total"] = self.total
        return d


class ArcasReader:
    """Membaca data transaksi dari file SQLite Arcas."""

    def __init__(self, db_path: str, mapping: dict | None = None):
        self.db_path = db_path
        self.mapping = dict(DEFAULT_MAPPING)
        if mapping:
            self.mapping.update(mapping)

    def _connect(self):
        if not self.db_path or not os.path.exists(self.db_path):
            raise FileNotFoundError(f"Database Arcas tidak ditemukan: {self.db_path}")
        con = sqlite3.connect(self.db_path)
        con.row_factory = sqlite3.Row
        return con

    def test_connection(self) -> tuple[bool, str]:
        try:
            con = self._connect()
            m = self.mapping
            cur = con.execute(
                f"SELECT COUNT(*) AS n FROM {m['transaksi_table']}"
            )
            n = cur.fetchone()["n"]
            con.close()
            return True, f"Terhubung. {n} transaksi ditemukan."
        except Exception as exc:  # pragma: no cover - dilaporkan ke UI
            return False, str(exc)

    def fetch(self, bulan: int | None = None, tahun: int | None = None) -> list[Transaksi]:
        m = self.mapping
        con = self._connect()
        try:
            penyedia = {}
            for row in con.execute(f"SELECT * FROM {m['penyedia_table']}"):
                p = Penyedia(
                    id=str(row[m["p_id"]]),
                    nama=row[m["p_nama"]] or "",
                    alamat=row[m["p_alamat"]] or "",
                    telepon=row[m["p_telepon"]] or "",
                    pemilik=(row[m["p_pemilik"]] if m["p_pemilik"] in row.keys() else "") or "",
                )
                penyedia[p.id] = p

            items_by_tx: dict[str, list] = {}
            for row in con.execute(f"SELECT * FROM {m['item_table']}"):
                tid = str(row[m["i_transaksi_id"]])
                items_by_tx.setdefault(tid, []).append(
                    Item(
                        nama=row[m["i_nama"]] or "",
                        volume=row[m["i_volume"]] or 0,
                        satuan=row[m["i_satuan"]] or "",
                        harga=row[m["i_harga"]] or 0,
                    )
                )

            where, params = [], []
            if bulan:
                where.append(f"{m['t_bulan']} = ?")
                params.append(int(bulan))
            if tahun:
                where.append(f"{m['t_tahun']} = ?")
                params.append(int(tahun))
            sql = f"SELECT * FROM {m['transaksi_table']}"
            if where:
                sql += " WHERE " + " AND ".join(where)
            sql += f" ORDER BY {m['t_tanggal']}"

            out = []
            for row in con.execute(sql, params):
                tid = str(row[m["t_id"]])
                pid = str(row[m["t_penyedia_id"]])
                out.append(
                    Transaksi(
                        id=tid,
                        no_bpu=str(row[m["t_bpu"]] or ""),
                        tanggal=str(row[m["t_tanggal"]] or ""),
                        kegiatan=row[m["t_kegiatan"]] or "",
                        kode_program=(row[m["t_kode_program"]] if m["t_kode_program"] in row.keys() else "") or "",
                        kode_kegiatan=(row[m["t_kode_kegiatan"]] if m["t_kode_kegiatan"] in row.keys() else "") or "",
                        kode_rekening=row[m["t_kode_rekening"]] or "",
                        uraian=(row[m["t_uraian"]] if m["t_uraian"] in row.keys() else "") or "",
                        bulan=int(row[m["t_bulan"]] or 0),
                        tahun=int(row[m["t_tahun"]] or 0),
                        penyedia=penyedia.get(pid, Penyedia(id=pid)),
                        items=items_by_tx.get(tid, []),
                    )
                )
            return out
        finally:
            con.close()


# --- Database contoh --------------------------------------------------------
def build_sample_db(path: str) -> str:
    """Membuat database SQLite contoh yang meniru skema Arcas."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if os.path.exists(path):
        os.remove(path)
    con = sqlite3.connect(path)
    con.executescript(
        """
        CREATE TABLE penyedia (
            id INTEGER PRIMARY KEY,
            nama_toko TEXT, alamat TEXT, telepon TEXT, pemilik TEXT
        );
        CREATE TABLE transaksi (
            id INTEGER PRIMARY KEY,
            no_bpu TEXT, tanggal TEXT, kegiatan TEXT,
            kode_program TEXT, kode_kegiatan TEXT, kode_rekening TEXT,
            uraian TEXT, penyedia_id INTEGER, bulan INTEGER, tahun INTEGER
        );
        CREATE TABLE transaksi_item (
            id INTEGER PRIMARY KEY,
            transaksi_id INTEGER, nama_barang TEXT,
            volume REAL, satuan TEXT, harga_satuan REAL
        );
        """
    )
    penyedia = [
        (1, "Toko Berkah Jaya", "Jl. Merdeka No. 12, Bandung", "0812-3456-7890", ""),
        (2, "CV. Sumber Rejeki", "Jl. Sudirman No. 45, Bandung", "0822-1111-2222", "Hendra"),
        (3, "UD. Maju Bersama", "Jl. Asia Afrika No. 8, Bandung", "0813-9999-8888", ""),
    ]
    con.executemany("INSERT INTO penyedia VALUES (?,?,?,?,?)", penyedia)

    transaksi = [
        (1, "BPU-001", "2026-01-08", "Pengembangan Standar Isi",
         "01", "01.02", "5.1.02.01.01.0024",
         "Belanja Alat Tulis Kantor", 1, 1, 2026),
        (2, "BPU-002", "2026-01-15", "Pengembangan Standar Sarana dan Prasarana",
         "02", "02.05", "5.1.02.01.01.0026",
         "Belanja Alat/Bahan Kebersihan", 3, 1, 2026),
        (3, "BPU-003", "2026-02-05", "Pengembangan Pendidik dan Tenaga Kependidikan",
         "03", "03.01", "5.1.02.02.01.0052",
         "Belanja Penggandaan / Fotokopi", 2, 2, 2026),
    ]
    con.executemany(
        "INSERT INTO transaksi VALUES (?,?,?,?,?,?,?,?,?,?,?)", transaksi
    )

    items = [
        # BPU-001 ATK (banyak item kecil -> dirangkum jadi "Belanja ATK")
        (None, 1, "Kertas HVS A4 70gr", 5, "rim", 55000),
        (None, 1, "Pulpen Standard", 2, "lusin", 24000),
        (None, 1, "Spidol Whiteboard", 1, "lusin", 90000),
        (None, 1, "Tinta Printer Hitam", 3, "botol", 35000),
        (None, 1, "Map Snelhecter", 2, "lusin", 30000),
        # BPU-002 Kebersihan
        (None, 2, "Sapu Ijuk", 4, "buah", 25000),
        (None, 2, "Pel Lantai", 3, "buah", 35000),
        (None, 2, "Cairan Pembersih Lantai", 6, "botol", 18000),
        (None, 2, "Tempat Sampah", 5, "buah", 45000),
        # BPU-003 Penggandaan
        (None, 3, "Fotokopi Soal Ujian", 1200, "lembar", 250),
        (None, 3, "Penjilidan", 30, "buah", 5000),
    ]
    con.executemany(
        "INSERT INTO transaksi_item VALUES (?,?,?,?,?,?)", items
    )
    con.commit()
    con.close()
    return path
