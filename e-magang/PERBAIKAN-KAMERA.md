# Perbaikan: Kamera tidak bisa diakses untuk absensi peserta

## Penyebab
Aplikasi ini adalah **Google Apps Script Web App**. Isi HTML selalu dirender di
dalam **iframe lintas-asal (cross-origin) yang tersandbox** (`*.googleusercontent.com`).
Peramban modern memblokir `navigator.mediaDevices.getUserMedia({ video })` untuk
kamera di dalam iframe lintas-asal, kecuali frame induk mendelegasikannya lewat
atribut `allow="camera"` — dan iframe pembungkus milik Google **tidak** melakukannya.

Akibatnya:
- Langkah GPS berfungsi (geolocation ada di allow-list iframe Apps Script).
- Langkah **kamera gagal** dengan `NotAllowedError`, sementara `.catch()` lama
  hanya menampilkan pesan umum sehingga penyebab aslinya tersembunyi.

## Perbaikan (hanya di `Index.html`, sisi klien)
1. **Diagnostik nyata** — `nyalakanKamera()` kini melaporkan jenis galat
   (`NotAllowedError`, `NotFoundError`, `NotReadableError`, dll.) dan memeriksa
   `window.isSecureContext` serta ketersediaan `mediaDevices`.
2. **Jalur cadangan "Kamera perangkat"** — tombol `<input type="file"
   accept="image/*" capture="user">`. Ini memakai aplikasi kamera bawaan
   perangkat (bukan `getUserMedia`), sehingga **tidak tunduk pada Permissions
   Policy iframe** dan bekerja andal di HP di dalam Apps Script.
3. **Pipeline watermark dipakai bersama** — foto dari kamera langsung maupun
   dari kamera perangkat melewati fungsi `finalisasiFoto()` yang sama, jadi
   watermark, format JPEG dataURL, dan pengiriman ke server tidak berubah.
4. `video.play()` dipanggil eksplisit agar pratinjau andal (khususnya iOS).

Tidak ada perubahan pada `Code.gs`; server `simpanFoto()` tetap menerima
`data:image/jpeg;base64,...` seperti sebelumnya.

## Cara pakai bagi peserta
Jika pratinjau kamera langsung tidak muncul, tekan tombol **"Kamera perangkat"**
pada Langkah 2 untuk mengambil swafoto — hasilnya tetap berwatermark dan valid.
