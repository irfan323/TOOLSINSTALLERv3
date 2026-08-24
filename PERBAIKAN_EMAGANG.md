# Perbaikan e‑Magang — "Jam tidak bisa disimpan" & "Aplikasi sangat berat"

Dua berkas aplikasi absensi e‑Magang diperbaiki:

- `1code.gs` — kode Apps Script (backend). Di editor Apps Script namanya `Code`.
- `Index_tampilan_glass.html` — tampilan (frontend). Di editor Apps Script berkas
  HTML **wajib bernama `Index`** karena `doGet()` memanggil
  `HtmlService.createHtmlOutputFromFile('Index')`.

---

## 1. Jam kerja tidak bisa disimpan — DIPERBAIKI

**Penyebab.** Saat menulis teks seperti `"07:30"` ke sel, Google Sheets otomatis
mengubahnya menjadi **objek waktu (Date)**. Ketika dibaca kembali, nilainya menjadi
`"Sat Dec 30 1899 07:30:00 GMT+…"`, bukan `"07:30"`. Akibatnya:

- Kolom `<input type="time">` pada form tidak bisa membaca nilai itu → tampak kosong,
  seolah jam **tidak tersimpan**.
- `jamKeMenit()` gagal mengurai nilai tersebut → jendela absensi rusak dan absen
  ditolak dengan pesan *"Jam kerja … belum diatur"*.

**Perbaikan (di `1code.gs`).**
- Fungsi baru `normalisasiJam()` mengembalikan nilai apa pun (Date, string kacau,
  `"7:30"`) menjadi `"HH:mm"` yang bersih.
- `getJamKerja()` kini menormalkan jam masuk/pulang saat membaca.
- `simpanJamKerja()` **memaksa kolom jam menjadi TEKS** (`setNumberFormats('@')`)
  sebelum menulis, sehingga `"07:30"` tidak lagi diubah menjadi waktu.
- `setupSistem()` juga menyetel kolom jam sebagai teks saat pertama kali dibuat.
- Fungsi baru **`perbaikiJamKerja()`** — jalankan **sekali** dari editor Apps Script
  untuk memperbaiki spreadsheet lama yang jamnya sudah terlanjur rusak.

## 2. Aplikasi sangat berat — DIPERBAIKI

**Penyebab utama (backend).** Beberapa fungsi membaca **seluruh isi sheet berulang
kali di dalam perulangan**. Contoh terparah: rekap memanggil `hitungHariKe()` untuk
**tiap peserta**, dan tiap panggilan membaca sheet `jam_kerja` **7×** + `hari_libur`
1×, ditambah `cariJabatan()`/`cariUnit()` per peserta. Untuk 50 peserta ini menjadi
**ratusan pembacaan sheet** — sumber utama lambatnya dashboard & rekap.

**Perbaikan (di `1code.gs`).** Ditambahkan cache per‑eksekusi untuk `jam_kerja`,
`hari_libur`, `unit`, `jabatan`, dan `batch` (`petaJamKerja`, `petaLibur`, `petaUnit`,
`petaJabatan`, `petaBatch`). Tiap sheet kini dibaca **paling banyak sekali** per
permintaan. Karena setiap `google.script.run` adalah eksekusi baru, cache otomatis
segar; fungsi simpan/hapus terkait mengosongkan cache-nya.

**Frontend.** Animasi "aurora" pada halaman masuk diubah menjadi geser saja
(tanpa `scale`) agar lapisan blur tidak dirender ulang tiap frame, dan jumlah partikel
dikurangi. Beban GPU pada ponsel kelas bawah turun tanpa mengubah tampilan.

---

## Cara menerapkan

1. Buka proyek Apps Script, ganti isi berkas `Code` dengan `1code.gs`.
2. Ganti isi berkas HTML `Index` dengan `Index_tampilan_glass.html`.
3. **Jika sudah pernah dipakai** (data lama): jalankan `perbaikiJamKerja()` satu kali
   dari editor (menu *Run*). Untuk instalasi baru cukup `setupSistem()`.
4. Buka menu *Hari & Jam Kerja*, pastikan jam tampil benar, simpan.
5. *Deploy → Manage deployments → Edit → Version: New version* agar perubahan aktif.

> Catatan lanjutan (opsional): untuk produksi, sebaiknya Tailwind tidak memakai
> `cdn.tailwindcss.com` (Play CDN mengompilasi CSS di browser). Mengganti dengan CSS
> Tailwind yang sudah dibangun akan mempercepat pemuatan awal lebih jauh.
