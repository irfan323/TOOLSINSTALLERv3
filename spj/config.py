"""Konfigurasi data SPJ.

Seluruh data kepala surat, instansi, penyedia, pejabat, dan nomor dokumen
dikumpulkan di sini agar mudah diubah tanpa menyentuh kode generator.
"""

# --------------------------------------------------------------------------
# KOP SURAT / INSTANSI
# --------------------------------------------------------------------------
INSTANSI = {
    "kementerian": "KEMENTERIAN KETENAGAKERJAAN REPUBLIK INDONESIA",
    "direktorat": "DIREKTORAT JENDERAL PEMBINAAN PELATIHAN VOKASI DAN PRODUKTIVITAS",
    "balai": "BALAI BESAR PELATIHAN VOKASI DAN PRODUKTIVITAS",
    "kota": "MAKASSAR",
    "alamat": (
        "Jalan Taman Makam Pahlawan No 4 RT 005/RW 002 Kelurahan Paropo, "
        "Kecamatan Panakukang, Kota Makassar, Provinsi Sulawesi Selatan 90231"
    ),
    "kontak": "https://blkmakassar-kemnaker.com  blkmakassar@kemnaker.go.id  (0411) 442322",
}

# --------------------------------------------------------------------------
# PEJABAT
# --------------------------------------------------------------------------
PPK = {  # Pejabat Pembuat Komitmen
    "nama": "Yuda Susanto, S.H",
    "nip": "19810516 200901 1 003",
    "jabatan": "Pejabat Pembuat Komitmen BBPVP Makassar",
    "alamat": "Jl. Taman Makam Pahlawan No. 4 Panaikang Makassar",
}

PEJABAT_PENGADAAN = {
    "nama": "Imam Budiarto",
    "nip": "19871104 201502 1 001",
    "jabatan": "Pejabat Pengadaan Barang/Jasa BBPVP Makassar",
}

# --------------------------------------------------------------------------
# PENYEDIA / VENDOR
# --------------------------------------------------------------------------
PENYEDIA = {
    "nama": "CV. Ponegoro Group",
    "direktur": "Sulkipli, S. IP",
    "jabatan": "Direktur",
    "alamat": (
        "Jl. Martadinata BTN Zarindah Blok I Nomor 10, Kel. Simboro, "
        "Kec. Simboro Kab. Mamuju, Provinsi Sulawesi Barat"
    ),
    "bank": "PT. Bank SULSELBAR Cabang Utama Mamuju",
    "rekening": "071-003-000018809-5",
    "npwp": "63.157.615.4-814.000",
}

# --------------------------------------------------------------------------
# DOKUMEN / NOMOR / TANGGAL
# --------------------------------------------------------------------------
DOKUMEN = {
    "tahun_anggaran": "2026",
    "sumber_dana": "DIPA 2026",
    "kegiatan": (
        "Pengadaan Bahan Pelatihan Berbasis Kompetensi, Kejuruan "
        "Peracikan Minuman Kopi dan Junior Make Up Artist"
    ),
    "tanggal_dokumen": "13 April 2026",
    "hari_tanggal": "Senin Tanggal Tiga Belas bulan April tahun Dua Ribu Dua Puluh Enam",
    "kota_tanggal": "Makassar, April 2026",
    # nomor-nomor dokumen (sesuaikan bila sudah terbit nomor resmi)
    "no_surat_pesanan": "SP.    /PAN/BBPVPMKS-MAMUJU/IV/2026",
    "no_ba_pemeriksaan": "BA.    /PPK/BBPVPMKS-MAMUJU/IV/2026",
    "no_ba_serah_terima": "B.    /PPK/BBPVPMKS-MAMUJU/IV/2026",
    "no_ba_pembayaran": "B.    /PPK/BBPVPMKS-MAMUJU/IV/2026",
    "no_invoice": "005/CV.PG.MMJ/IV/2026",
}

# --------------------------------------------------------------------------
# NILAI KONTRAK / NEGOSIASI
# --------------------------------------------------------------------------
# HPS (jumlah harga satuan) : Kopi 29.500.000 | Make Up 16.500.000
# Nilai kontrak hasil negosiasi (dipakai pada Kuitansi, Invoice, BA Pembayaran)
NILAI_KONTRAK = {
    "kopi": 29490000,
    "makeup": 16480000,
}
NILAI_KONTRAK["total"] = NILAI_KONTRAK["kopi"] + NILAI_KONTRAK["makeup"]  # 45.970.000
