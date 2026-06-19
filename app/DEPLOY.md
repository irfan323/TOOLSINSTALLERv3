# Cara Online-kan Aplikasi (Tinggal Buka Link)

Panduan ini membuat aplikasi bisa diakses lewat **link di browser/HP**, tanpa
menjalankan apa pun di komputer Anda. Gratis, memakai **Render.com**.

## Langkah (sekali setup, ±5 menit)

1. Buka <https://render.com> → **Get Started** → **Sign in with GitHub**
   (pakai akun GitHub yang sama dengan repo ini).
2. Klik **New +** (kanan atas) → pilih **Blueprint**.
3. Pilih repository **TOOLSINSTALLERv3** lalu klik **Connect**.
   - Render otomatis membaca berkas `render.yaml` di repo ini.
4. Klik **Apply** / **Create**. Render akan membangun aplikasi (3–5 menit).
5. Setelah selesai, muncul link seperti:
   **`https://spj-bos-otomatis.onrender.com`** ← inilah link yang Anda buka.

Selesai. Bagikan/simpan link itu. Setiap kali ada pembaruan kode, Render
otomatis memperbarui aplikasinya.

## Catatan Penting

- **Paket gratis "tidur" saat tidak dipakai.** Saat dibuka setelah lama
  menganggur, butuh ±30–50 detik untuk bangun. Setelah itu lancar.
- **Penyimpanan bersifat sementara.** Pada paket gratis, setiap kali aplikasi
  diperbarui/restart, *pengaturan, logo, dan hasil sinkron bisa ter-reset*.
  Untuk pemakaian rutin yang menyimpan data permanen, naikkan ke paket berbayar
  + tambahkan *Disk* (1 GB sudah cukup), atau jalankan secara lokal.
- **Database Arcas.** Aplikasi online tidak bisa membaca file Arcas yang ada di
  komputer Anda secara langsung. Untuk online, pakai fitur **Buat Database
  Contoh**, atau unggah file `.db` Arcas (fitur unggah DB bisa saya tambahkan
  bila diperlukan). Untuk membaca Arcas asli di PC, lebih cocok dijalankan
  **lokal** (lihat README → `./run.sh`).

## Alternatif

- **Hugging Face Spaces** (juga gratis, ada link publik): buat akun di
  <https://huggingface.co> → **New Space** → pilih **Docker** → unggah isi
  folder `app/`. `Dockerfile` di folder ini sudah siap pakai.
- **Lokal di 1 komputer** (paling pas untuk baca Arcas asli): jalankan
  `cd app && ./run.sh`, lalu buka `http://127.0.0.1:5000`.

## Untuk yang paham teknis

`app/Dockerfile` sudah memuat semua pustaka WeasyPrint dan menjalankan
`gunicorn`. Bisa dideploy ke mana saja yang mendukung Docker:

```bash
cd app
docker build -t spj-bos .
docker run -p 8000:8000 spj-bos    # buka http://localhost:8000
```
