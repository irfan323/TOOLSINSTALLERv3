# Aplikasi SPJ — BBPVP Makassar

Generator dokumen **Surat Pertanggungjawaban (SPJ)** beserta seluruh **lampiran
dalam format Excel (.xlsx)** untuk kegiatan:

> **Pengadaan Bahan Pelatihan Berbasis Kompetensi**
> Kejuruan **Peracikan Minuman Kopi** (Barista) & **Junior Make Up Artist** (Tata Kecantikan)
> Tahun Anggaran 2026

Dibuat berdasarkan berkas SPJ asli (CV. Ponegoro Group — BBPVP Makassar).

---

## Cara Pakai

```bash
pip install -r requirements.txt          # sekali saja (butuh openpyxl)
python3 generate_spj.py                   # hasil: SPJ_BBPVP_Makassar.xlsx
python3 generate_spj.py -o Hasil.xlsx     # tentukan nama file sendiri
```

File Excel yang dihasilkan berisi **14 sheet**:

| No | Sheet | Keterangan |
|----|-------|------------|
| 1 | Daftar Isi | Ringkasan & nilai kontrak |
| 2 | Kuitansi | Kuitansi / bukti pembayaran (Rp 45.970.000) |
| 3–4 | HPS - Kopi / Make Up | Harga Perkiraan Sendiri (dengan harga) |
| 5–6 | SP - Kopi / Make Up | Lampiran Surat Pesanan / daftar permintaan (tanpa harga) |
| 7–8 | BA Pemeriksaan | Lampiran BA Penelitian & Pemeriksaan (tanpa harga, "Kondisi Baik dan Lengkap") |
| 9–10 | BA Serah Terima | Lampiran BA Serah Terima Hasil Pekerjaan |
| 11–12 | BA Pembayaran | Lampiran BA Pembayaran (dengan harga, nilai kontrak) |
| 13–14 | Invoice | Lampiran Invoice Tagihan (dengan harga, nilai kontrak) |

Setiap lampiran sudah lengkap dengan kop surat/judul, tabel barang, baris
**TOTAL**, **terbilang**, dan blok **tanda tangan**. Format angka rupiah,
border, dan pengaturan cetak (fit-to-width) sudah diterapkan.

---

## Struktur Proyek

```
spj/
  config.py      # data instansi, penyedia, pejabat, nomor dokumen, nilai kontrak
  items.py       # data master barang kedua paket (nama, spesifikasi, volume, harga)
  terbilang.py   # konversi angka -> huruf (Bahasa Indonesia)
  excel.py       # generator workbook Excel + seluruh lampiran
generate_spj.py  # titik masuk (CLI)
requirements.txt
```

## Mengubah Data

Semua data yang biasa berubah cukup diedit pada dua berkas:

- **`spj/config.py`** — nama pejabat/penyedia, NIP, alamat, nomor & tanggal
  dokumen, dan `NILAI_KONTRAK` (nilai hasil negosiasi).
- **`spj/items.py`** — daftar barang per paket. Setiap baris:
  `("Nama", "Spesifikasi", volume, "Satuan", harga_satuan)`.
  Total dihitung otomatis.

### Catatan Nilai

- Jumlah harga satuan (**HPS**): Kopi `Rp 29.500.000`, Make Up `Rp 16.500.000`.
- **Nilai kontrak** hasil negosiasi (dipakai di Kuitansi, BA Pembayaran,
  Invoice): Kopi `Rp 29.490.000`, Make Up `Rp 16.480.000`,
  **Total `Rp 45.970.000`**.
