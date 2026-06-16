"""Smoke tests untuk aplikasi SPJ BOS Otomatis.

Menguji jalur inti: pembacaan database Arcas contoh, sinkronisasi, perhitungan
honor, terbilang, serta pembuatan dokumen HTML & PDF lewat rute Flask.
"""

import os
import sys

import pytest

# Pastikan paket aplikasi dapat diimpor saat dijalankan dari root repo.
APP_DIR = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, os.path.abspath(APP_DIR))

import app as A  # noqa: E402
from spjarcas import arcas, store, documents  # noqa: E402
from spjarcas.terbilang import terbilang, rupiah  # noqa: E402


@pytest.fixture()
def client(tmp_path):
    # arahkan penyimpanan ke folder sementara agar tes terisolasi
    store.DATA_DIR = str(tmp_path)
    store.SETTINGS_FILE = str(tmp_path / "settings.json")
    store.CACHE_FILE = str(tmp_path / "cache.json")
    store.OVERRIDE_FILE = str(tmp_path / "overrides.json")
    store.HONOR_FILE = str(tmp_path / "honor.json")
    documents.OUTPUT_DIR = str(tmp_path / "output")

    db = str(tmp_path / "sample_arcas.db")
    arcas.build_sample_db(db)
    A.SAMPLE_DB = db
    store.save_settings({"arcas_db_path": db})

    A.app.config.update(TESTING=True)
    c = A.app.test_client()
    c.post("/sync", data={"tahun": 2026})
    return c


def test_terbilang():
    assert terbilang(1500000) == "Satu juta lima ratus ribu rupiah"
    assert terbilang(0) == "Nol rupiah"
    assert rupiah(1500000) == "Rp 1.500.000"


def test_arcas_fetch():
    db = arcas.build_sample_db(A.SAMPLE_DB if A.SAMPLE_DB.endswith(".db")
                               else "/tmp/s.db")
    data = arcas.ArcasReader(db).fetch(tahun=2026)
    assert len(data) == 3
    assert data[0].total > 0
    assert data[0].penyedia.nama


def test_honor_calc():
    h = documents.hitung_honor(1500000, 150000,
                               [{"nama": "A"}, {"nama": "B"}, {"nama": "C"}])
    assert h["total_volume"] == 10
    assert sum(r["volume"] for r in h["rows"]) == 10


def test_routes_ok(client):
    for path in ["/", "/transactions?tahun=2026", "/honor",
                 "/smart-arcas", "/settings"]:
        assert client.get(path).status_code == 200


def test_documents_pdf(client):
    tx_id = store.get_cache()[0]["id"]
    for d in ["kuitansi", "pesanan", "bast", "pemeriksaan"]:
        r = client.get(f"/transaction/{tx_id}/doc/{d}")
        assert r.status_code == 200
        r = client.get(f"/transaction/{tx_id}/doc/{d}.pdf")
        assert r.status_code == 200 and r.data[:4] == b"%PDF"

    r = client.get(f"/transaction/{tx_id}/bundle.pdf")
    assert r.status_code == 200 and r.data[:4] == b"%PDF"


def test_cetak_massal_zip(client):
    r = client.get("/cetak-massal?tahun=2026")
    assert r.status_code == 200 and r.data[:2] == b"PK"


def test_edit_override(client):
    tx_id = store.get_cache()[0]["id"]
    client.post(f"/transaction/{tx_id}/edit",
                data={"pemilik": "H. Abdullah", "narasi": "Belanja ATK"})
    m = documents.merge_transaksi(store.get_transaksi(tx_id))
    assert m["penyedia"]["pemilik"] == "H. Abdullah"
    assert m["narasi"] == "Belanja ATK"
