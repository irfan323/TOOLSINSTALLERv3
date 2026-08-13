# Panduan UX Copy — E-Absensi Sekolah

Panduan gaya penulisan untuk semua teks yang dilihat pengguna (guru, admin, siswa)
di aplikasi **E-Absensi**. Dokumen ini mendefinisikan suara & nada, aturan mekanis,
glosarium istilah baku, dan daftar lengkap perubahan **sebelum → sesudah** yang sudah
diterapkan ke `code.gs` dan `index.html`.

- Tanggal: 2026-08-13
- Cakupan: `code.gs` (pesan server) + `index.html` (teks antarmuka)
- Bahasa: Bahasa Indonesia (audiens sekolah)

---

## 1. Suara & Nada

Aplikasi ini dipakai kepala sekolah, guru, admin, dan siswa. Teks harus terasa
**ramah, jelas, dan tenang** — membantu, bukan menyalahkan.

- **Tenang saat error.** Jangan berteriak (`DITUTUP`, `GAGAL!`) atau menakut-nakuti.
  Jelaskan apa yang terjadi dan apa langkah berikutnya.
- **Sopan & profesional** untuk guru/admin. Gunakan sapaan **"Anda"**.
- **Singkat & memberi semangat** untuk siswa saat scan.
- **Jujur, bukan teknis.** Pengguna tidak perlu melihat `error.toString()`,
  `token`, atau nama fungsi. Terjemahkan ke bahasa manusia.

---

## 2. Aturan Mekanis

1. **Kapitalisasi kalimat (sentence case).** Tanpa HURUF KAPITAL untuk menekankan.
   *Pengecualian:* label ringkas pada HUD pemindai QR (mis. `SCAN QR PULANG`) boleh
   kapital karena berfungsi sebagai label alat, bukan pesan.
2. **Tanda baca.** Kalimat lengkap diakhiri titik. Maksimal satu tanda seru, hanya
   untuk kabar baik singkat (mis. "Berhasil!"). Hindari `Gagal!` yang mengejutkan.
3. **Ikon & emoji.** Satu ikon status lewat komponen UI — jangan tempel `✓`/`❌`
   di dalam teks pesan.
4. **Jangan bocorkan error mentah.** Bungkus dengan pesan manusiawi + langkah lanjutan.
   Detail teknis boleh disisakan dalam kurung untuk debugging:
   `Terjadi kesalahan. Silakan coba lagi. (…)`.
5. **Bahasa baku & hangat.** `diperbarui` (bukan `diupdate`), `impor` (bukan `import`),
   `masuk` (bukan `login`) di antarmuka.
6. **Pesan error = apa yang salah + apa yang harus dilakukan.**
7. **Satu konsep, satu istilah.** Lihat glosarium (§3).
8. **Waktu pakai "pukul HH:MM"** untuk titik waktu (bukan "jam 07:15").

---

## 3. Glosarium Istilah Baku

| Konsep | Gunakan | Hindari |
| --- | --- | --- |
| NISN tidak ada di data | **NISN tidak terdaftar** | "tidak ditemukan", "tidak terdaftar di database" |
| Menyimpan perubahan data | **diperbarui** | "diupdate", "diedit" |
| Kabar berhasil | **berhasil** (huruf kecil di tengah kalimat) | "BERHASIL", "Berhasil ✓" |
| Memasukkan data dari file | **impor** | "import" |
| Masuk ke akun | **masuk** | "login" (di teks UI) |
| Akun pengajar | **akun guru** | "guru" saat yang dimaksud akunnya |
| Jenis absen | **absen masuk / pulang / sholat** | kapitalisasi acak |
| Absensi tidak dibuka | **ditutup** / **libur** | "DITUTUP" |
| Titik waktu | **pukul 07:15** | "jam 07:15" |
| Aksi tidak diizinkan | **tidak memiliki akses** | "Akses Ditolak:", "Ditolak!" |

> **Catatan penting:** token status yang **disimpan ke spreadsheet** dan dipakai
> logika — `Terlambat`, `Pulang Cepat`, `Tepat Waktu`, `Hadir` — **sengaja tidak
> diubah**. Mengubahnya akan merusak pengecekan `.includes('Terlambat')` dan
> konsistensi data histori.

---

## 4. Sebelum → Sesudah

### 4.1 Error teknis yang bocor ke pengguna

| Sebelum | Sesudah |
| --- | --- |
| `"Login Error: " + error.toString()` | `Gagal masuk. Silakan coba lagi sebentar. (…)` |
| `"Error Server: " + error.toString()` | `Terjadi kesalahan di server. Silakan coba lagi. (…)` |
| `"GAGAL: " + error.message` | `(pesan bersih dari verifikasi sesi)` |
| `message: error.toString()` (mentah) | `Terjadi kesalahan. Silakan coba lagi. (…)` |
| `Gagal terhubung ke server: …` | `Gagal terhubung ke server. Periksa koneksi internet Anda, lalu coba lagi.` |

### 4.2 Konsistensi istilah (NISN)

| Sebelum | Sesudah |
| --- | --- |
| `NISN tidak ditemukan` | `NISN tidak terdaftar. Periksa kembali nomornya.` |
| `NISN tidak terdaftar di database.` | `NISN tidak terdaftar.` |
| `NISN tidak terdaftar` (tanpa titik) | `NISN tidak terdaftar.` |

### 4.3 Absensi ditutup / batas waktu (berhenti berteriak)

| Sebelum | Sesudah |
| --- | --- |
| `Absensi DITUTUP. Hari ini libur rutin: Hari Minggu` | `Absensi ditutup. Hari ini libur: Minggu.` |
| `Absensi Ditutup! Sudah melewati batas waktu (17:00).` | `Absensi sudah ditutup. Batas waktu 17:00 telah lewat.` |
| `Gagal! Batas waktu pulang (17:00) sudah lewat.` | `Sudah melewati batas absen pulang (17:00).` |
| `Absensi belum dibuka. Buka mulai jam 07:15.` | `Absensi belum dibuka. Dibuka mulai pukul 07:15.` |

### 4.4 Pesan sukses (konsisten, tanpa ✓ menempel)

| Sebelum | Sesudah |
| --- | --- |
| `Absen Sholat Berhasil ✓` | `Absen sholat berhasil.` |
| `Siswa berhasil ditambahkan (Aman)` | `Siswa berhasil ditambahkan.` |
| `Siswa berhasil diupdate` | `Data siswa berhasil diperbarui.` |
| `Status berhasil diubah` | `Status kehadiran berhasil diperbarui.` |
| `Konfigurasi waktu berhasil disimpan` | `Pengaturan waktu berhasil disimpan.` |
| `Guru berhasil ditambahkan` | `Akun guru berhasil ditambahkan.` |

### 4.5 Nada penolakan & sesi

| Sebelum | Sesudah |
| --- | --- |
| `Ditolak! Siswa ini kelas X. Anda hanya bisa scan kelas Y.` | `Siswa ini dari kelas X. Anda hanya dapat melakukan scan untuk kelas Y.` |
| `Terlalu Cepat! Tunggu sebentar lagi.` | `Terlalu cepat. Tunggu sebentar sebelum scan lagi.` |
| `Akses Ditolak: Anda tidak memiliki izin.` | `Anda tidak memiliki akses untuk tindakan ini.` |
| `Sesi berakhir. Silakan login ulang.` | `Sesi Anda telah berakhir. Silakan masuk kembali.` |
| `Token tidak valid atau tidak ditemukan.` | `Sesi tidak ditemukan. Silakan masuk kembali.` |
| `siswa sudah absen masuk hari ini. Tidak ada absen lanjutan (mode 1x).` | `siswa sudah absen hari ini.` |

### 4.6 Antarmuka (index.html)

| Sebelum | Sesudah |
| --- | --- |
| `MASUK SEKARANG` (tombol) | `Masuk Sekarang` |
| Badge `Secure` / `Fast` | `Aman` / `Cepat` |
| Judul error masuk `Akses Ditolak` | `Gagal masuk` |
| `Prev` / `Next` (paginasi, ×10) | `Sebelumnya` / `Berikutnya` |
| `Import Excel` (×3) | `Impor Excel` |
| `Import selesai. Berhasil: 5, Duplikat/Gagal: 2` | `Impor selesai. Berhasil: 5, dilewati: 2.` |
| `Scan semua siswa → Submit sekaligus` | `Scan semua siswa, lalu kirim sekaligus` |
| Judul dialog `TUTUP TAHUN AJARAN?` | `Tutup Tahun Ajaran?` |

---

## 5. Ringkasan Perubahan

**`code.gs`** — ± 80 string `message:` ditulis ulang:
- Semua error teknis mentah dibungkus pesan manusiawi (detail disisakan dalam kurung).
- Istilah diseragamkan (NISN, impor, pukul, diperbarui).
- Kapitalisasi kalimat; `DITUTUP`/`GAGAL!`/`Ditolak!` dihapus.
- Pesan verifikasi sesi dirapikan (tanpa "token", tanpa prefiks ganda).
- Sintaks tervalidasi (`node --check` lulus).

**`index.html`** — layar masuk (CTA, badge, heading error, teks bantuan),
navigasi (`Sebelumnya`/`Berikutnya`), `Impor Excel`, judul dialog, dan teks bantuan.
Struktur tag tetap seimbang.

**Sengaja dipertahankan:** token status penyimpan data (`Terlambat`, `Pulang Cepat`,
`Tepat Waktu`, `Hadir`) dan label HUD pemindai QR yang ringkas.
