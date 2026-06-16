# SPJ BOS Otomatis — Integrasi Arcas

Aplikasi web untuk **otomatisasi pencetakan dokumen Surat Pertanggungjawaban
(SPJ) Dana BOS** dengan koneksi langsung ke database **Arcas / ARKAS**
(Aplikasi Rencana Kegiatan dan Anggaran Sekolah).

Dibangun dengan **Flask** + **WeasyPrint** (generator PDF dari template HTML
dinamis), membaca database lokal Arcas berbasis **SQLite**.

## Fitur

| Fitur | Keterangan |
|---|---|
| 🔄 **Sinkronisasi Arcas** | Tombol "Sinkron" menarik transaksi langsung dari file SQLite Arcas: nama toko, alamat, telepon penyedia, dan rincian transaksi. Pemetaan tabel/kolom dapat disesuaikan. |
| 📄 **Dokumen Otomatis** | Generate **Kuitansi**, **Pesanan & Faktur**, **BAST**, dan **Berita Acara Pemeriksaan Barang** dari data transaksi. |
| 🖨️ **Cetak Massal** | Satu klik menghasilkan seluruh SPJ untuk periode tertentu sebagai ZIP, **tersusun dalam folder per nomor BPU**. |
| ✏️ **Editor & Narasi** | Preview/Edit sebelum cetak: isi nama pemilik toko (yang kosong di Arcas) dan **rangkum banyak item kecil menjadi narasi induk** (mis. "Belanja ATK"). |
| 💰 **Honor & Transport** | Tombol "Cetak Dokumen Honor". Volume terisi **otomatis** dari total pengeluaran ÷ harga satuan RKAS. Daftar penerima fleksibel. |
| ⚙️ **Pengaturan** | Unggah Logo Pemda & Logo Sekolah, data Satuan Pendidikan, pejabat, dan Tim Pemeriksa Barang. |
| 📅 **Filter** | Berdasarkan bulan & tahun anggaran (mendukung s.d. 2026). |
| 🧠 **Smart Arcas** | Panduan menentukan kode program, kegiatan, dan rekening saat input di Arcas. |

## Menjalankan

```bash
cd app
./run.sh           # membuat venv, memasang dependensi, menjalankan server
# atau manual:
pip install -r requirements.txt
python app.py
```

Buka <http://127.0.0.1:5000>.

> **Catatan WeasyPrint:** memerlukan pustaka sistem Pango/Cairo. Di Debian/Ubuntu:
> `apt install libpango-1.0-0 libpangocairo-1.0-0 libgdk-pixbuf2.0-0 libffi-dev`

## Memulai Cepat

1. Buka **Pengaturan** → klik **Buat Database Contoh** (membuat `data/sample_arcas.db`
   meniru skema Arcas) dan otomatis menghubungkannya. Atau isi path database Arcas asli.
2. Lengkapi identitas sekolah, pejabat, tim pemeriksa, dan unggah logo.
3. Di **Dashboard**, pilih bulan/tahun lalu klik **Sinkron dari Arcas**.
4. Buka **Transaksi** → **Edit** untuk merapikan narasi & nama pemilik → **PDF**
   atau gunakan **Cetak Massal**.

## Menghubungkan Database Arcas Asli

Arcas menyimpan data pada SQLite lokal. Atur path file `.db` di **Pengaturan**.
Bila nama tabel/kolom berbeda dari skema default, sesuaikan dictionary
`DEFAULT_MAPPING` di `spjarcas/arcas.py` (atau simpan override `mapping` di
`data/settings.json`). Skema default yang diharapkan:

```
penyedia(id, nama_toko, alamat, telepon, pemilik)
transaksi(id, no_bpu, tanggal, kegiatan, kode_program, kode_kegiatan,
          kode_rekening, uraian, penyedia_id, bulan, tahun)
transaksi_item(id, transaksi_id, nama_barang, volume, satuan, harga_satuan)
```

## Struktur

```
app/
├── app.py                 # Rute Flask
├── spjarcas/
│   ├── arcas.py           # Pembaca SQLite Arcas + generator data contoh
│   ├── store.py           # Penyimpanan pengaturan/cache/override/honor (JSON)
│   ├── documents.py       # Penggabungan data, perhitungan honor, render PDF
│   └── terbilang.py       # Angka → teks bahasa Indonesia
├── templates/
│   ├── documents/         # Template dokumen (HTML A4, siap PDF)
│   │   └── body/          # Partial isi dokumen (dipakai ulang oleh bundle)
│   └── *.html             # Halaman aplikasi
├── static/                # CSS, JS, logo
└── output/                # Hasil PDF, tersusun per folder BPU (runtime)
```

Output cetak mengikuti format administrasi pendidikan (kertas A4, kop surat
berlogo ganda, kolom rincian, dan blok tanda tangan pejabat).
