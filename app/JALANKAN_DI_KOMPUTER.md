# Menjalankan di Komputer Sendiri (Gratis, Tanpa Kartu)

Cara ini menjalankan aplikasi langsung di komputer Anda. Data tersimpan
permanen dan bisa membaca database Arcas asli. **Tidak perlu internet hosting
dan tidak perlu kartu.**

---

## Windows (paling mudah)

### 1. Pasang Python (sekali saja)
- Unduh dari <https://www.python.org/downloads/>
- Saat memasang, **centang "Add Python to PATH"** (penting!), lalu **Install**.

### 2. Unduh aplikasi
- Buka halaman GitHub repo ini → tombol hijau **Code** → **Download ZIP**.
- **Ekstrak** ZIP-nya (klik kanan → Extract All).

### 3. Jalankan
- Masuk ke folder hasil ekstrak, buka folder **`app`**.
- **Klik dua kali** file **`start_windows.bat`**.
- Pertama kali akan menyiapkan dulu (agak lama). Setelah itu **browser terbuka
  otomatis** ke aplikasi. Selesai! 🎉

> Untuk menjalankan lagi di lain waktu: cukup klik dua kali `start_windows.bat`.
> Untuk berhenti: tutup jendela hitam (Command Prompt) yang muncul.

---

## Mac / Linux

Buka **Terminal**, lalu:

```bash
cd app
./run.sh
```

Buka <http://127.0.0.1:5000> di browser bila tidak terbuka otomatis.

---

## Cara Cetak PDF

Aplikasi bisa berjalan hanya dengan Flask (ringan, mudah dipasang). Untuk
menyimpan dokumen jadi PDF, ada **2 cara** — keduanya menghasilkan PDF rapi:

1. **Lewat browser (selalu bisa, tanpa pasang apa pun):**
   - Klik **Preview** dokumen → tekan **Ctrl+P** (⌘+P di Mac).
   - Pada pilihan printer, pilih **"Simpan sebagai PDF" / "Save as PDF"** → Save.
   - Untuk banyak dokumen sekaligus, klik **Cetak Massal** → satu halaman berisi
     semua dokumen → Ctrl+P → Simpan sebagai PDF.

2. **Tombol "Unduh PDF" langsung (opsional):** muncul otomatis bila WeasyPrint
   berhasil terpasang. `start_windows.bat` sudah mencoba memasangnya; bila gagal,
   abaikan saja dan pakai cara browser di atas.

---

## Menghubungkan Database Arcas Asli

1. Cari file database Arcas di komputer (biasanya berakhiran `.db`).
2. Di aplikasi → menu **Pengaturan** → isi **Path Database Arcas** dengan lokasi
   file tersebut → **Simpan**.
3. Ke **Dashboard** → pilih bulan/tahun → **Sinkron dari Arcas**.

Belum tahu lokasinya? Pakai dulu tombol **Buat Database Contoh** untuk mencoba.
