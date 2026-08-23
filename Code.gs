/**
 * ============================================================================
 * e-MAGANG  —  DIGITAL ABSENSI MAGANG NASIONAL
 * Satuan Pelayanan Pelatihan Vokasi dan Produktivitas Mamuju
 * Balai Besar Pelatihan Vokasi dan Produktivitas Makassar
 * Kementerian Ketenagakerjaan Republik Indonesia
 * ----------------------------------------------------------------------------
 * Versi   : 1.0 (2026)
 * Metode  : Geofencing GPS (Haversine, dihitung di server)
 *           + swafoto berwatermark
 *           + deteksi lokasi palsu (fake GPS) & skor risiko
 * Naskah  : Permenaker No. 3 Tahun 2026 tentang Tata Naskah Dinas Kemnaker
 * ----------------------------------------------------------------------------
 * MODUL
 *   1. Dashboard & grafik analitik
 *   2. Rekap laporan harian, mingguan, bulanan
 *   3. Kalender hari kerja 5 hari (Senin–Jumat)
 *   4. Manajemen pengguna (admin / pembimbing / peserta)
 *   5. Manajemen jabatan & unit penempatan
 *   6. Ekspor–impor laporan format Excel dan PDF
 *   7. Absensi swafoto (selfie) berwatermark
 *   8. Keamanan: hash password bersalt, token sesi, rate limit, audit log
 *   9. Lokasi titik koordinat (geofence per unit penempatan)
 *  10. Deteksi fake GPS / mock location
 * ----------------------------------------------------------------------------
 * LANGKAH PEMASANGAN
 *   1. Isi SPREADSHEET_ID dan DRIVE_FOLDER_ID di bawah.
 *   2. Jalankan setupSistem()        -> membuat seluruh sheet + jam kerja 5 hari.
 *   3. Jalankan buatAdminPertama()   -> membuat akun admin (SEGERA GANTI SANDI).
 *   4. Jalankan isiDataContoh()      -> opsional, data simulasi untuk uji coba.
 *   5. Jalankan pasangTrigger()      -> pembersihan sesi + rekap otomatis.
 *   6. Deploy > New deployment > Web app
 *        Execute as         : Me
 *        Who has access     : Anyone with the link
 * ============================================================================
 */

// ====================================================================
// 1. KONFIGURASI
// ====================================================================

const SPREADSHEET_ID  = 'ISI_ID_SPREADSHEET_ANDA';
const DRIVE_FOLDER_ID = 'ISI_ID_FOLDER_DRIVE_ANDA';
const ZONA_WAKTU      = 'Asia/Makassar';            // WITA

const INSTANSI = {
  kementerian : 'KEMENTERIAN KETENAGAKERJAAN REPUBLIK INDONESIA',
  balai       : 'BALAI BESAR PELATIHAN VOKASI DAN PRODUKTIVITAS MAKASSAR',
  satpel      : 'SATUAN PELAYANAN PELATIHAN VOKASI DAN PRODUKTIVITAS MAMUJU',
  alamat      : 'Jalan Poros Mamuju – Kalukku KM 12, Kabupaten Mamuju, Sulawesi Barat',
  kontak      : 'Telepon (0426) 000000 | Surel: satpelpvpmamuju@kemnaker.go.id',
  program     : 'PROGRAM MAGANG NASIONAL'
};

/** Parameter operasional tunggal. Ubah di sini, bukan tersebar di banyak fungsi. */
const ATURAN = {
  toleransiTerlambatMenit : 15,   // lewat dari ini => Terlambat
  bukaSebelumMenit        : 60,   // absen masuk dibuka N menit sebelum jam masuk
  tutupMasukMenit         : 240,  // absen masuk ditutup N menit setelah jam masuk
  pulangSebelumMenit      : 60,   // absen pulang dibuka N menit sebelum jam pulang
  pulangTutupMenit        : 180,  // absen pulang ditutup N menit setelah jam pulang
  akurasiMaksimalMeter    : 100,  // akurasi GPS di atas ini meragukan
  sesiJam                 : 12,   // masa berlaku token sesi
  maksGagalLogin          : 5,
  blokirLoginMenit        : 15,
  ambangKehadiranLulus    : 80,   // persen minimal kehadiran untuk sertifikat
  ambangRawan             : 80,   // di bawah ini masuk daftar rawan
  minJamKerjaHarian       : 420,  // 7 jam efektif (menit) => "Jam kerja terpenuhi"
  panjangSandiMinimal     : 8
};

/** Ambang skor risiko absensi (0–100). */
const RISIKO = { aman: 30, perluCek: 60, tolak: 90 };

/** Peran yang dikenal sistem. */
const PERAN = { admin: 'admin', pembimbing: 'pembimbing', peserta: 'peserta' };

function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

// ====================================================================
// 2. PETA KOLOM — satu sumber kebenaran indeks kolom tiap sheet
// ====================================================================

const KOL = {
  peserta : { noReg:0, nama:1, nik:2, jk:3, tempatLahir:4, tglLahir:5, email:6, hp:7,
              institusi:8, jurusan:9, jenjang:10, batch:11, unit:12, jabatan:13,
              pembimbing:14, mulai:15, selesai:16, status:17 },
  batch   : { kode:0, nama:1, angkatan:2, mulai:3, selesai:4, totalHari:5, unit:6,
              status:7, penanggungJawab:8, keterangan:9 },
  unit    : { id:0, nama:1, lat:2, lng:3, radius:4, alamat:5, penanggungJawab:6 },
  jabatan : { kode:0, nama:1, unit:2, bidang:3, uraian:4, kuota:5 },
  jamKerja: { hari:0, namaHari:1, hariKerja:2, jamMasuk:3, jamPulang:4, istirahat:5, keterangan:6 },
  users   : { username:0, salt:1, hash:2, peran:3, nama:4, nip:5, jabatan:6, unit:7,
              batch:8, aktif:9, terakhirMasuk:10 },
  sessions: { token:0, identitas:1, peran:2, kedaluwarsa:3, dibuat:4, perangkat:5 },
  absensi : { tanggal:0, noReg:1, nama:2, batch:3, unit:4, jabatan:5, hariKe:6,
              jamMasuk:7, jamPulang:8, status:9, keterangan:10,
              lat:11, lng:12, jarak:13, foto:14, akurasi:15,
              latPulang:16, lngPulang:17, jarakPulang:18, fotoPulang:19,
              durasiMenit:20, perangkat:21, deviceHash:22, skorRisiko:23, flagRisiko:24,
              verifikasi:25, catatanAdmin:26, aktivitas:27 },
  izin    : { id:0, diajukan:1, noReg:2, nama:3, batch:4, tanggal:5, sampai:6, jenis:7,
              alasan:8, lampiran:9, status:10, diproses:11, waktuProses:12, catatan:13 },
  libur   : { tanggal:0, keterangan:1, jenis:2 },
  audit   : { waktu:0, aktor:1, peran:2, aksi:3, detail:4, ip:5 },
  gagal   : { waktu:0, noReg:1, nama:2, batch:3, alasan:4, jarak:5, lat:6, lng:7,
              akurasi:8, skor:9 }
};

const SKEMA = {
  peserta : ['No Registrasi','Nama Lengkap','NIK','Jenis Kelamin','Tempat Lahir','Tanggal Lahir',
             'Email','No HP','Asal Institusi','Jurusan/Kompetensi','Jenjang','Kode Batch',
             'ID Unit Penempatan','Kode Jabatan','Pembimbing','Tanggal Mulai','Tanggal Selesai','Status'],
  batch   : ['Kode Batch','Nama Batch','Angkatan','Tanggal Mulai','Tanggal Selesai','Total Hari Kerja',
             'ID Unit Penempatan','Status','Penanggung Jawab','Keterangan'],
  unit    : ['ID Unit','Nama Unit Penempatan','Latitude','Longitude','Radius (m)','Alamat','Penanggung Jawab'],
  jabatan : ['Kode Jabatan','Nama Jabatan','ID Unit','Bidang','Uraian Tugas','Kuota'],
  jam_kerja : ['Hari Ke','Nama Hari','Hari Kerja','Jam Masuk','Jam Pulang','Istirahat','Keterangan'],
  users   : ['Username','Salt','PasswordHash','Peran','Nama','NIP','Jabatan','ID Unit',
             'Kode Batch','Aktif','Terakhir Masuk'],
  sessions: ['Token','Identitas','Peran','Kedaluwarsa','Dibuat','Perangkat'],
  absensi : ['Tanggal','No Registrasi','Nama','Kode Batch','ID Unit','Kode Jabatan','Hari Ke',
             'Jam Masuk','Jam Pulang','Status','Keterangan',
             'Latitude','Longitude','Jarak (m)','Foto Masuk','Akurasi (m)',
             'Lat Pulang','Lng Pulang','Jarak Pulang (m)','Foto Pulang',
             'Durasi (menit)','Perangkat','Device Hash','Skor Risiko','Flag Risiko',
             'Verifikasi','Catatan Admin','Uraian Aktivitas'],
  izin    : ['ID','Waktu Pengajuan','No Registrasi','Nama','Kode Batch','Tanggal Mulai',
             'Tanggal Selesai','Jenis','Alasan','Lampiran','Status','Diproses Oleh',
             'Waktu Diproses','Catatan'],
  hari_libur : ['Tanggal','Keterangan','Jenis'],
  audit_log  : ['Waktu','Aktor','Peran','Aksi','Detail','Perangkat'],
  log_gagal  : ['Waktu','No Registrasi','Nama','Kode Batch','Alasan','Jarak (m)',
                'Latitude','Longitude','Akurasi (m)','Skor Risiko'],
  konfigurasi: ['Kunci','Nilai','Keterangan']
};

const URUTAN_SHEET = ['peserta','batch','unit','jabatan','jam_kerja','users','sessions',
                      'absensi','izin','hari_libur','audit_log','log_gagal','konfigurasi'];

// ====================================================================
// 3. ENTRY POINT
// ====================================================================

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('e-Magang | Absensi Magang Nasional Satpel PVP Mamuju')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getUrlAplikasi() {
  return ScriptApp.getService().getUrl();
}

// ====================================================================
// 4. UTILITAS DASAR
// ====================================================================

function formatWaktu(tanggal, pola) {
  return Utilities.formatDate(new Date(tanggal), ZONA_WAKTU, pola);
}

function hariIniStr() {
  return formatWaktu(new Date(), 'yyyy-MM-dd');
}

/** "HH:mm" -> menit sejak tengah malam. */
function jamKeMenit(jam) {
  const b = String(jam || '').trim().split(':');
  const j = parseInt(b[0], 10), m = parseInt(b[1], 10);
  if (isNaN(j) || isNaN(m)) return null;
  return j * 60 + m;
}

function formatMenit(menit) {
  if (menit === null || menit === undefined || isNaN(menit)) return '-';
  const m2 = Math.max(0, Math.min(1439, Math.round(menit)));
  return String(Math.floor(m2 / 60)).padStart(2, '0') + ':' + String(m2 % 60).padStart(2, '0');
}

/** Jarak dua koordinat dalam meter (Haversine). SELALU dihitung di server. */
function hitungJarak(lat1, lon1, lat2, lon2) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function ambilSheet(nama) {
  const sheet = getSpreadsheet().getSheetByName(nama);
  if (!sheet) throw new Error('Sheet "' + nama + '" tidak ditemukan. Jalankan setupSistem() terlebih dahulu.');
  return sheet;
}

function bacaSheet(nama) {
  return ambilSheet(nama).getDataRange().getValues();
}

function sukses(pesan, tambahan) {
  const h = { sukses: true, pesan: pesan || '' };
  if (tambahan) Object.keys(tambahan).forEach(function (k) { h[k] = tambahan[k]; });
  return h;
}

function gagal(pesan) {
  return { sukses: false, pesan: pesan };
}

/** Pembungkus seragam: menangkap error apa pun menjadi respons rapi. */
function jalankan(fn) {
  try { return fn(); }
  catch (err) { return gagal(err.message || String(err)); }
}

function bersihkanNamaBerkas(teks) {
  return String(teks).replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function lolosHtml(teks) {
  return String(teks === null || teks === undefined ? '' : teks)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function angkaAman(v) {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

function persen(bagian, total) {
  return total > 0 ? Math.round((bagian / total) * 1000) / 10 : 0;
}

// ====================================================================
// 5. PENANGGALAN BAHASA INDONESIA
// ====================================================================

var NAMA_HARI  = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
var NAMA_BULAN = ['Januari','Februari','Maret','April','Mei','Juni',
                  'Juli','Agustus','September','Oktober','November','Desember'];

function tanggalIndonesia(t) {
  const d = new Date(t);
  return d.getDate() + ' ' + NAMA_BULAN[d.getMonth()] + ' ' + d.getFullYear();
}

function tanggalIndonesiaLengkap(t) {
  const d = new Date(t);
  return NAMA_HARI[d.getDay()] + ', ' + tanggalIndonesia(d);
}

/** Nomor minggu ISO-8601 dalam tahun. */
function nomorMingguIso(tanggal) {
  const d = new Date(Date.UTC(tanggal.getFullYear(), tanggal.getMonth(), tanggal.getDate()));
  const hari = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - hari);
  const awalTahun = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - awalTahun) / 86400000) + 1) / 7);
}

/** Senin pada minggu yang memuat tanggal tersebut. */
function awalMinggu(tanggal) {
  const d = new Date(tanggal);
  d.setHours(0, 0, 0, 0);
  const geser = (d.getDay() + 6) % 7;   // Senin = 0
  d.setDate(d.getDate() - geser);
  return d;
}

// ====================================================================
// 6. AUDIT LOG
// ====================================================================

function catatAudit(aktor, peran, aksi, detail, perangkat) {
  try {
    ambilSheet('audit_log').appendRow([
      formatWaktu(new Date(), 'yyyy-MM-dd HH:mm:ss'),
      String(aktor || '-'), String(peran || '-'), String(aksi || '-'),
      String(detail || '').substring(0, 500),
      String(perangkat || '').substring(0, 120)
    ]);
  } catch (e) { /* audit tidak boleh menggagalkan alur utama */ }
}

function getAuditLog(token, batas) {
  return jalankan(function () {
    requireAuth(token, [PERAN.admin]);
    const A = KOL.audit;
    const data = bacaSheet('audit_log');
    const n = Number(batas) || 200;
    const hasil = [];
    for (let i = data.length - 1; i >= 1 && hasil.length < n; i--) {
      hasil.push({
        waktu : String(data[i][A.waktu]), aktor: String(data[i][A.aktor]),
        peran : String(data[i][A.peran]), aksi : String(data[i][A.aksi]),
        detail: String(data[i][A.detail]), perangkat: String(data[i][A.ip] || '')
      });
    }
    return sukses('', { data: hasil });
  });
}

// ====================================================================
// 7. KEAMANAN & AUTENTIKASI
// ====================================================================

function buatSalt() {
  return Utilities.getUuid().replace(/-/g, '').substring(0, 16);
}

function hashPassword(password, salt) {
  const byte = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256, salt + String(password), Utilities.Charset.UTF_8);
  return byte.map(function (b) {
    return (b < 0 ? b + 256 : b).toString(16).padStart(2, '0');
  }).join('');
}

function hashRingkas(teks) {
  const byte = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256, String(teks), Utilities.Charset.UTF_8);
  return byte.map(function (b) {
    return (b < 0 ? b + 256 : b).toString(16).padStart(2, '0');
  }).join('').substring(0, 24);
}

/** Jalankan sekali dari editor Apps Script. Tidak ada kredensial default di kode produksi. */
function buatAdminPertama() {
  const username = 'admin';
  const password = 'GANTI_SANDI_INI_2026';
  const nama     = 'Administrator e-Magang Satpel PVP Mamuju';

  const sheet = ambilSheet('users');
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][KOL.users.username]).trim() === username) {
      Logger.log('Akun admin sudah ada. Tidak ada perubahan.');
      return;
    }
  }
  const salt = buatSalt();
  sheet.appendRow([username, salt, hashPassword(password, salt), PERAN.admin, nama,
                   '-', 'Administrator Sistem', '', '', 'Ya', '']);
  Logger.log('Akun admin dibuat -> username: admin | sandi: ' + password +
             '\nSEGERA ganti sandi lewat menu Pengaturan.');
}

function cekBlokirLogin(kunci) {
  const cache = CacheService.getScriptCache();
  return Number(cache.get('gagal_' + kunci) || 0) >= ATURAN.maksGagalLogin;
}

function catatGagalLogin(kunci) {
  const cache = CacheService.getScriptCache();
  const n = Number(cache.get('gagal_' + kunci) || 0) + 1;
  cache.put('gagal_' + kunci, String(n), ATURAN.blokirLoginMenit * 60);
  return n;
}

function resetGagalLogin(kunci) {
  CacheService.getScriptCache().remove('gagal_' + kunci);
}

/**
 * Verifikasi token sesi. Dipanggil di baris pertama SETIAP fungsi yang
 * menyentuh data. Melempar error bila tidak berhak.
 */
function requireAuth(token, peranDiizinkan) {
  const data = bacaSheet('sessions');
  const sekarang = new Date();
  const K = KOL.sessions;

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][K.token]) !== String(token)) continue;

    const kedaluwarsa = data[i][K.kedaluwarsa];
    if (!(kedaluwarsa instanceof Date) || kedaluwarsa <= sekarang) {
      throw new Error('Sesi Anda berakhir. Silakan masuk kembali.');
    }
    const peran = String(data[i][K.peran]);
    if (peranDiizinkan && peranDiizinkan.indexOf(peran) === -1) {
      throw new Error('Anda tidak memiliki hak akses untuk tindakan ini.');
    }
    return { peran: peran, identitas: String(data[i][K.identitas]) };
  }
  throw new Error('Sesi tidak dikenali. Silakan masuk kembali.');
}

/**
 * Peserta magang masuk dengan Nomor Registrasi.
 * Admin / pembimbing masuk dengan username + kata sandi.
 */
function login(username, password, noRegistrasi, perangkat) {
  return jalankan(function () {
    const kunci = hashRingkas(String(username || noRegistrasi || '').trim().toLowerCase());
    if (cekBlokirLogin(kunci)) {
      return gagal('Terlalu banyak percobaan gagal. Coba lagi dalam ' +
                   ATURAN.blokirLoginMenit + ' menit.');
    }

    let pengguna = null;

    if (noRegistrasi) {
      const P = KOL.peserta;
      const peserta = bacaSheet('peserta');
      const cari = String(noRegistrasi).trim().toUpperCase();
      for (let i = 1; i < peserta.length; i++) {
        if (String(peserta[i][P.noReg]).trim().toUpperCase() !== cari) continue;
        const st = String(peserta[i][P.status] || 'Aktif');
        if (st && st !== 'Aktif') {
          return gagal('Status peserta: ' + st + '. Hubungi admin Satpel PVP Mamuju.');
        }
        pengguna = {
          peran: PERAN.peserta, identitas: String(peserta[i][P.noReg]).trim(),
          nama: peserta[i][P.nama], batch: peserta[i][P.batch]
        };
        break;
      }
      if (!pengguna) {
        catatGagalLogin(kunci);
        return gagal('Nomor registrasi tidak terdaftar sebagai peserta Magang Nasional.');
      }
    } else {
      const U = KOL.users;
      const users = bacaSheet('users');
      const cari = String(username).trim();
      for (let i = 1; i < users.length; i++) {
        if (String(users[i][U.username]).trim() !== cari) continue;
        if (String(users[i][U.aktif] || 'Ya') === 'Tidak') {
          return gagal('Akun dinonaktifkan. Hubungi administrator.');
        }
        if (hashPassword(password, String(users[i][U.salt])) !== String(users[i][U.hash])) break;
        pengguna = {
          peran: String(users[i][U.peran]), identitas: String(users[i][U.username]).trim(),
          nama: users[i][U.nama], batch: String(users[i][U.batch] || ''),
          unit: String(users[i][U.unit] || ''), baris: i + 1
        };
        break;
      }
      if (!pengguna) {
        const n = catatGagalLogin(kunci);
        return gagal('Username atau kata sandi salah. Percobaan ke-' + n +
                     ' dari ' + ATURAN.maksGagalLogin + '.');
      }
      ambilSheet('users').getRange(pengguna.baris, KOL.users.terakhirMasuk + 1)
        .setValue(formatWaktu(new Date(), 'yyyy-MM-dd HH:mm:ss'));
    }

    resetGagalLogin(kunci);

    const token = Utilities.getUuid();
    const kedaluwarsa = new Date(Date.now() + ATURAN.sesiJam * 3600 * 1000);
    ambilSheet('sessions').appendRow([
      token, pengguna.identitas, pengguna.peran, kedaluwarsa, new Date(),
      String(perangkat || '').substring(0, 120)
    ]);
    catatAudit(pengguna.identitas, pengguna.peran, 'MASUK', 'Login berhasil', perangkat);

    return sukses('', {
      token: token, peran: pengguna.peran, nama: pengguna.nama,
      identitas: pengguna.identitas, batch: pengguna.batch || ''
    });
  });
}

function logout(token) {
  return jalankan(function () {
    const sheet = ambilSheet('sessions');
    const data  = sheet.getDataRange().getValues();
    for (let i = data.length - 1; i >= 1; i--) {
      if (String(data[i][KOL.sessions.token]) === String(token)) sheet.deleteRow(i + 1);
    }
    return sukses('Anda telah keluar dari sistem.');
  });
}

/** Trigger harian. */
function bersihkanSesi() {
  const sheet = ambilSheet('sessions');
  const data = sheet.getDataRange().getValues();
  const sekarang = new Date();
  for (let i = data.length - 1; i >= 1; i--) {
    const k = data[i][KOL.sessions.kedaluwarsa];
    if (!(k instanceof Date) || k <= sekarang) sheet.deleteRow(i + 1);
  }
}

function pasangTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (['bersihkanSesi', 'tutupAbsensiHarian'].indexOf(t.getHandlerFunction()) > -1) {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger('bersihkanSesi').timeBased().atHour(1).everyDays(1).create();
  ScriptApp.newTrigger('tutupAbsensiHarian').timeBased().atHour(22).everyDays(1).create();
  Logger.log('Trigger dipasang: bersihkanSesi (01.00) & tutupAbsensiHarian (22.00).');
}

/**
 * Dijalankan otomatis tiap malam: peserta aktif yang tidak absen dan tidak
 * mengajukan izin pada hari kerja ditandai "Alpa".
 */
function tutupAbsensiHarian() {
  const hariIni = hariIniStr();
  const tgl = new Date();
  if (!apakahHariKerja(tgl)) return;

  const P = KOL.peserta, A = KOL.absensi, I = KOL.izin;
  const peserta = bacaSheet('peserta');
  const absensi = bacaSheet('absensi');
  const izin    = bacaSheet('izin');
  const sheetAbsensi = ambilSheet('absensi');

  const sudah = {};
  for (let i = 1; i < absensi.length; i++) {
    if (!absensi[i][A.tanggal]) continue;
    if (formatWaktu(absensi[i][A.tanggal], 'yyyy-MM-dd') !== hariIni) continue;
    sudah[String(absensi[i][A.noReg]).trim()] = true;
  }
  const berizin = {};
  for (let i = 1; i < izin.length; i++) {
    if (String(izin[i][I.status]) !== 'Disetujui') continue;
    if (!cakupTanggal(izin[i][I.tanggal], izin[i][I.sampai], hariIni)) continue;
    berizin[String(izin[i][I.noReg]).trim()] = String(izin[i][I.jenis]);
  }

  for (let i = 1; i < peserta.length; i++) {
    const noReg = String(peserta[i][P.noReg]).trim();
    if (!noReg) continue;
    if (String(peserta[i][P.status] || 'Aktif') !== 'Aktif') continue;
    if (sudah[noReg]) continue;
    if (!dalamPeriodeMagang(peserta[i], tgl)) continue;

    const status = berizin[noReg] || 'Alpa';
    const baris = new Array(SKEMA.absensi.length).fill('');
    baris[A.tanggal]    = hariIni;
    baris[A.noReg]      = "'" + noReg;
    baris[A.nama]       = peserta[i][P.nama];
    baris[A.batch]      = peserta[i][P.batch];
    baris[A.unit]       = peserta[i][P.unit];
    baris[A.jabatan]    = peserta[i][P.jabatan];
    baris[A.hariKe]     = hitungHariKe(peserta[i][P.mulai], tgl);
    baris[A.status]     = status;
    baris[A.keterangan] = berizin[noReg] ? 'Pengajuan ' + status + ' disetujui'
                                         : 'Tanpa keterangan (ditandai otomatis sistem)';
    baris[A.verifikasi] = 'Otomatis';
    sheetAbsensi.appendRow(baris);
  }
  catatAudit('SISTEM', 'sistem', 'TUTUP_HARIAN', 'Penandaan otomatis ' + hariIni);
}

function gantiPassword(token, lama, baru) {
  return jalankan(function () {
    const sesi = requireAuth(token, [PERAN.admin, PERAN.pembimbing]);
    if (String(baru || '').length < ATURAN.panjangSandiMinimal) {
      return gagal('Kata sandi baru minimal ' + ATURAN.panjangSandiMinimal + ' karakter.');
    }
    const U = KOL.users;
    const sheet = ambilSheet('users');
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][U.username]).trim() !== sesi.identitas) continue;
      if (hashPassword(lama, String(data[i][U.salt])) !== String(data[i][U.hash])) {
        return gagal('Kata sandi lama tidak cocok.');
      }
      const salt = buatSalt();
      sheet.getRange(i + 1, U.salt + 1, 1, 2).setValues([[salt, hashPassword(baru, salt)]]);
      catatAudit(sesi.identitas, sesi.peran, 'GANTI_SANDI', '');
      return sukses('Kata sandi berhasil diganti.');
    }
    return gagal('Akun tidak ditemukan.');
  });
}

function getProfil(token) {
  return jalankan(function () {
    const sesi = requireAuth(token);
    if (sesi.peran === PERAN.peserta) {
      const p = cariPeserta(sesi.identitas);
      if (!p) return gagal('Data peserta tidak ditemukan.');
      const b = cariBatch(p.batch);
      const u = cariUnit(p.unit);
      const j = cariJabatan(p.jabatan);
      return sukses('', { profil: {
        nama: p.nama, identitas: p.noRegistrasi, peran: PERAN.peserta,
        email: p.email, noHp: p.noHp, institusi: p.institusi, jurusan: p.jurusan,
        jenjang: p.jenjang, batch: b ? b.nama : p.batch,
        unit: u ? u.nama : p.unit, jabatan: j ? j.nama : p.jabatan,
        pembimbing: p.pembimbing,
        periode: (p.mulai ? tanggalIndonesia(p.mulai) : '-') + ' s.d. ' +
                 (p.selesai ? tanggalIndonesia(p.selesai) : '-')
      }});
    }
    const U = KOL.users;
    const users = bacaSheet('users');
    for (let i = 1; i < users.length; i++) {
      if (String(users[i][U.username]).trim() !== sesi.identitas) continue;
      return sukses('', { profil: {
        nama: users[i][U.nama], identitas: sesi.identitas, peran: sesi.peran,
        nip: String(users[i][U.nip] || '-'), jabatan: String(users[i][U.jabatan] || '-'),
        unit: String(users[i][U.unit] || '-'), batch: String(users[i][U.batch] || ''),
        terakhirMasuk: String(users[i][U.terakhirMasuk] || '-')
      }});
    }
    return gagal('Akun tidak ditemukan.');
  });
}

// ====================================================================
// 8. PENCARIAN DATA MASTER
// ====================================================================

function cariBatch(kodeBatch) {
  const K = KOL.batch;
  const data = bacaSheet('batch');
  const cari = String(kodeBatch).trim().toUpperCase();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][K.kode]).trim().toUpperCase() !== cari) continue;
    return {
      kode: String(data[i][K.kode]).trim(), nama: data[i][K.nama],
      angkatan: data[i][K.angkatan], tanggalMulai: data[i][K.mulai],
      tanggalSelesai: data[i][K.selesai], totalHari: angkaAman(data[i][K.totalHari]),
      idUnit: String(data[i][K.unit]).trim(), status: String(data[i][K.status] || 'Aktif'),
      penanggungJawab: String(data[i][K.penanggungJawab] || ''),
      keterangan: String(data[i][K.keterangan] || ''), baris: i + 1
    };
  }
  return null;
}

function cariUnit(idUnit) {
  const K = KOL.unit;
  const data = bacaSheet('unit');
  const cari = String(idUnit).trim().toUpperCase();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][K.id]).trim().toUpperCase() !== cari) continue;
    return {
      id: String(data[i][K.id]).trim(), nama: data[i][K.nama],
      lat: angkaAman(data[i][K.lat]), lng: angkaAman(data[i][K.lng]),
      radius: angkaAman(data[i][K.radius]) || 100, alamat: data[i][K.alamat],
      penanggungJawab: String(data[i][K.penanggungJawab] || ''), baris: i + 1
    };
  }
  return null;
}

function cariJabatan(kodeJabatan) {
  const K = KOL.jabatan;
  if (!kodeJabatan) return null;
  const data = bacaSheet('jabatan');
  const cari = String(kodeJabatan).trim().toUpperCase();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][K.kode]).trim().toUpperCase() !== cari) continue;
    return {
      kode: String(data[i][K.kode]).trim(), nama: data[i][K.nama],
      idUnit: String(data[i][K.unit] || ''), bidang: String(data[i][K.bidang] || ''),
      uraian: String(data[i][K.uraian] || ''), kuota: angkaAman(data[i][K.kuota]),
      baris: i + 1
    };
  }
  return null;
}

/** Nama jabatan yang terbaca manusia; jatuh kembali ke kodenya bila tak ditemukan. */
var _cacheJabatan = null;
function namaJabatan(kode) {
  if (!kode) return '-';
  if (!_cacheJabatan) {
    _cacheJabatan = {};
    const K = KOL.jabatan;
    const data = bacaSheet('jabatan');
    for (let i = 1; i < data.length; i++) {
      const k = String(data[i][K.kode]).trim().toUpperCase();
      if (k) _cacheJabatan[k] = String(data[i][K.nama]);
    }
  }
  return _cacheJabatan[String(kode).trim().toUpperCase()] || String(kode);
}

function cariPeserta(noRegistrasi) {
  const K = KOL.peserta;
  const data = bacaSheet('peserta');
  const cari = String(noRegistrasi).trim().toUpperCase();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][K.noReg]).trim().toUpperCase() !== cari) continue;
    return bentukPeserta(data[i], i + 1);
  }
  return null;
}

function bentukPeserta(baris, nomorBaris) {
  const K = KOL.peserta;
  return {
    noRegistrasi: String(baris[K.noReg]).trim(), nama: baris[K.nama],
    nik: String(baris[K.nik]), jenisKelamin: String(baris[K.jk] || ''),
    tempatLahir: String(baris[K.tempatLahir] || ''), tglLahir: baris[K.tglLahir],
    email: String(baris[K.email] || ''), noHp: String(baris[K.hp] || ''),
    institusi: String(baris[K.institusi] || ''), jurusan: String(baris[K.jurusan] || ''),
    jenjang: String(baris[K.jenjang] || ''), batch: String(baris[K.batch] || '').trim(),
    unit: String(baris[K.unit] || '').trim(), jabatan: String(baris[K.jabatan] || '').trim(),
    pembimbing: String(baris[K.pembimbing] || ''), mulai: baris[K.mulai],
    selesai: baris[K.selesai], status: String(baris[K.status] || 'Aktif'),
    baris: nomorBaris
  };
}

/** Unit efektif peserta: unit pada data peserta, jika kosong ambil dari batch. */
function unitEfektif(peserta) {
  if (peserta.unit) return cariUnit(peserta.unit);
  const b = cariBatch(peserta.batch);
  return b ? cariUnit(b.idUnit) : null;
}

/** Tanggal mulai/selesai efektif peserta (fallback ke batch). */
function periodeEfektif(peserta) {
  const b = cariBatch(peserta.batch);
  return {
    mulai  : peserta.mulai   || (b ? b.tanggalMulai   : null),
    selesai: peserta.selesai || (b ? b.tanggalSelesai : null),
    totalHari: b ? b.totalHari : 0,
    batch: b
  };
}

function dalamPeriodeMagang(barisPeserta, tanggal) {
  const K = KOL.peserta;
  const mulai = barisPeserta[K.mulai], selesai = barisPeserta[K.selesai];
  const t = new Date(tanggal); t.setHours(0, 0, 0, 0);
  if (mulai) { const m = new Date(mulai); m.setHours(0,0,0,0); if (t < m) return false; }
  if (selesai) { const s = new Date(selesai); s.setHours(23,59,59,0); if (t > s) return false; }
  return true;
}

function cakupTanggal(dari, sampai, tanggalStr) {
  if (!dari) return false;
  const a = formatWaktu(dari, 'yyyy-MM-dd');
  const b = sampai ? formatWaktu(sampai, 'yyyy-MM-dd') : a;
  return tanggalStr >= a && tanggalStr <= b;
}

// ====================================================================
// 9. HARI KERJA 5 HARI & HARI LIBUR
// ====================================================================

/** Konfigurasi jam kerja untuk indeks hari 0=Minggu .. 6=Sabtu. */
function getJamKerja(indeksHari) {
  const K = KOL.jamKerja;
  const data = bacaSheet('jam_kerja');
  for (let i = 1; i < data.length; i++) {
    if (Number(data[i][K.hari]) !== Number(indeksHari)) continue;
    return {
      hari: Number(data[i][K.hari]), namaHari: String(data[i][K.namaHari]),
      hariKerja: String(data[i][K.hariKerja] || 'Tidak') === 'Ya',
      jamMasuk: String(data[i][K.jamMasuk] || ''),
      jamPulang: String(data[i][K.jamPulang] || ''),
      istirahat: String(data[i][K.istirahat] || ''),
      keterangan: String(data[i][K.keterangan] || ''), baris: i + 1
    };
  }
  return { hari: indeksHari, namaHari: NAMA_HARI[indeksHari], hariKerja: false,
           jamMasuk: '', jamPulang: '', istirahat: '', keterangan: '' };
}

function getSemuaJamKerja(token) {
  return jalankan(function () {
    if (token) requireAuth(token, [PERAN.admin]);
    const hasil = [];
    for (let h = 0; h < 7; h++) hasil.push(getJamKerja(h));
    return sukses('', { data: hasil, jumlahHariKerja: hasil.filter(function (x) { return x.hariKerja; }).length });
  });
}

function simpanJamKerja(token, baris) {
  return jalankan(function () {
    const sesi = requireAuth(token, [PERAN.admin]);
    const K = KOL.jamKerja;
    const sheet = ambilSheet('jam_kerja');
    const data = sheet.getDataRange().getValues();
    (baris || []).forEach(function (b) {
      const h = Number(b.hari);
      for (let i = 1; i < data.length; i++) {
        if (Number(data[i][K.hari]) !== h) continue;
        sheet.getRange(i + 1, 1, 1, SKEMA.jam_kerja.length).setValues([[
          h, NAMA_HARI[h], b.hariKerja ? 'Ya' : 'Tidak',
          String(b.jamMasuk || ''), String(b.jamPulang || ''),
          String(b.istirahat || ''), String(b.keterangan || '')
        ]]);
        break;
      }
    });
    catatAudit(sesi.identitas, sesi.peran, 'UBAH_JAM_KERJA', 'Pengaturan hari & jam kerja diperbarui');
    return sukses('Pengaturan hari kerja tersimpan.');
  });
}

function cekHariLibur(tanggalStr) {
  const data = bacaSheet('hari_libur');
  for (let i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    if (formatWaktu(data[i][0], 'yyyy-MM-dd') === tanggalStr) {
      return String(data[i][1] || 'Hari libur');
    }
  }
  return null;
}

/** Hari kerja = terdaftar sebagai hari kerja pada sheet jam_kerja DAN bukan hari libur. */
function apakahHariKerja(tanggal) {
  const d = new Date(tanggal);
  if (!getJamKerja(d.getDay()).hariKerja) return false;
  return !cekHariLibur(formatWaktu(d, 'yyyy-MM-dd'));
}

/** Hari kerja ke-berapa sejak tanggal mulai. Sabtu, Minggu & libur tidak dihitung. */
function hitungHariKe(tanggalMulai, tanggalIni) {
  if (!tanggalMulai) return 0;
  const libur = bacaSheet('hari_libur').slice(1)
    .filter(function (b) { return b[0]; })
    .map(function (b) { return formatWaktu(b[0], 'yyyy-MM-dd'); });
  const peta = {};
  for (let h = 0; h < 7; h++) peta[h] = getJamKerja(h).hariKerja;

  const mulai = new Date(tanggalMulai); mulai.setHours(0, 0, 0, 0);
  const ini   = new Date(tanggalIni);   ini.setHours(0, 0, 0, 0);
  if (ini < mulai) return 0;

  let hitung = 0;
  const kursor = new Date(mulai);
  while (kursor <= ini) {
    const str = formatWaktu(kursor, 'yyyy-MM-dd');
    if (peta[kursor.getDay()] && libur.indexOf(str) === -1) hitung++;
    kursor.setDate(kursor.getDate() + 1);
  }
  return hitung;
}

/** Daftar tanggal hari kerja dalam rentang (untuk rekap mingguan/bulanan). */
function daftarHariKerja(dari, sampai) {
  const libur = {};
  bacaSheet('hari_libur').slice(1).forEach(function (b) {
    if (b[0]) libur[formatWaktu(b[0], 'yyyy-MM-dd')] = String(b[1] || 'Libur');
  });
  const peta = {};
  for (let h = 0; h < 7; h++) peta[h] = getJamKerja(h).hariKerja;

  const hasil = [];
  const kursor = new Date(dari); kursor.setHours(0, 0, 0, 0);
  const akhir  = new Date(sampai); akhir.setHours(0, 0, 0, 0);
  while (kursor <= akhir) {
    const str = formatWaktu(kursor, 'yyyy-MM-dd');
    if (peta[kursor.getDay()] && !libur[str]) {
      hasil.push({ tanggal: str, hari: NAMA_HARI[kursor.getDay()], indeksHari: kursor.getDay() });
    }
    kursor.setDate(kursor.getDate() + 1);
  }
  return hasil;
}

function getHariLibur(token) {
  return jalankan(function () {
    requireAuth(token, [PERAN.admin, PERAN.pembimbing]);
    const data = bacaSheet('hari_libur');
    const hasil = [];
    for (let i = 1; i < data.length; i++) {
      if (!data[i][0]) continue;
      hasil.push({
        tanggal: formatWaktu(data[i][0], 'yyyy-MM-dd'),
        tanggalIndo: tanggalIndonesiaLengkap(data[i][0]),
        keterangan: String(data[i][1] || ''), jenis: String(data[i][2] || 'Libur Nasional')
      });
    }
    hasil.sort(function (a, b) { return a.tanggal < b.tanggal ? -1 : 1; });
    return sukses('', { data: hasil });
  });
}

function simpanHariLibur(token, tanggal, keterangan, jenis) {
  return jalankan(function () {
    const sesi = requireAuth(token, [PERAN.admin]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(tanggal))) return gagal('Format tanggal tidak valid.');
    const sheet = ambilSheet('hari_libur');
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] && formatWaktu(data[i][0], 'yyyy-MM-dd') === tanggal) {
        sheet.getRange(i + 1, 2, 1, 2).setValues([[keterangan, jenis || 'Libur Nasional']]);
        return sukses('Hari libur diperbarui.');
      }
    }
    sheet.appendRow([tanggal, keterangan, jenis || 'Libur Nasional']);
    catatAudit(sesi.identitas, sesi.peran, 'TAMBAH_LIBUR', tanggal + ' ' + keterangan);
    return sukses('Hari libur ditambahkan.');
  });
}

function hapusHariLibur(token, tanggal) {
  return jalankan(function () {
    const sesi = requireAuth(token, [PERAN.admin]);
    const sheet = ambilSheet('hari_libur');
    const data = sheet.getDataRange().getValues();
    for (let i = data.length - 1; i >= 1; i--) {
      if (data[i][0] && formatWaktu(data[i][0], 'yyyy-MM-dd') === String(tanggal)) {
        sheet.deleteRow(i + 1);
        catatAudit(sesi.identitas, sesi.peran, 'HAPUS_LIBUR', String(tanggal));
        return sukses('Hari libur dihapus.');
      }
    }
    return gagal('Data hari libur tidak ditemukan.');
  });
}

/** Isi cepat libur nasional (dapat disunting kemudian oleh admin). */
function isiLiburNasional(token, tahun) {
  return jalankan(function () {
    requireAuth(token, [PERAN.admin]);
    const th = Number(tahun) || new Date().getFullYear();
    const daftar = [
      ['01-01', 'Tahun Baru Masehi'],
      ['05-01', 'Hari Buruh Internasional'],
      ['06-01', 'Hari Lahir Pancasila'],
      ['08-17', 'Hari Kemerdekaan Republik Indonesia'],
      ['12-25', 'Hari Raya Natal']
    ];
    let n = 0;
    daftar.forEach(function (d) {
      const hasil = simpanHariLibur(token, th + '-' + d[0], d[1], 'Libur Nasional');
      if (hasil.sukses) n++;
    });
    return sukses(n + ' hari libur nasional tahun ' + th +
                  ' dimuat. Lengkapi libur keagamaan & cuti bersama secara manual sesuai SKB 3 Menteri.');
  });
}

// ====================================================================
// 10. DETEKSI FAKE GPS & SKOR RISIKO
// ====================================================================

/**
 * Skor risiko 0–100 dari sinyal klien + kondisi data server.
 * Skor tidak memblokir absensi kecuali indikasi sangat kuat (>= RISIKO.tolak);
 * tugasnya menandai baris agar admin dapat memverifikasi.
 */
function hitungSkorRisiko(konteks) {
  let skor = 0;
  const catatan = [];

  // 1. Akurasi GPS
  const akurasi = angkaAman(konteks.akurasi);
  if (akurasi <= 0)                                  { skor += 15; catatan.push('Akurasi GPS tidak dilaporkan'); }
  else if (akurasi > ATURAN.akurasiMaksimalMeter)    { skor += 30; catatan.push('Akurasi GPS ' + Math.round(akurasi) + ' m'); }
  else if (akurasi > 50)                             { skor += 10; catatan.push('Akurasi GPS sedang'); }

  // 2. Indikasi aplikasi lokasi palsu / mock provider
  if (konteks.mockTerdeteksi)   { skor += 50; catatan.push('Indikasi aplikasi lokasi palsu'); }
  if (konteks.apiDimodifikasi)  { skor += 40; catatan.push('Fungsi geolocation dimodifikasi'); }
  if (konteks.emulator)         { skor += 30; catatan.push('Indikasi emulator/perangkat virtual'); }

  // 3. Koordinat statis sempurna (GPS asli selalu bergetar)
  if (konteks.koordinatBeku)    { skor += 20; catatan.push('Koordinat tidak bergerak sama sekali'); }

  // 4. Kecepatan perpindahan tidak wajar antar pembacaan
  if (konteks.lompatanJauh)     { skor += 35; catatan.push('Perpindahan lokasi tidak wajar'); }

  // 5. Satu perangkat dipakai beberapa peserta pada hari yang sama
  if (konteks.perangkatGanda)   { skor += 40; catatan.push('Perangkat sama dipakai ' + konteks.perangkatGanda + ' peserta hari ini'); }

  // 6. Tanpa swafoto
  if (!konteks.adaFoto)         { skor += 25; catatan.push('Tanpa swafoto'); }

  // 7. Tepat di tepi radius
  if (konteks.rasioRadius > 0.9){ skor += 10; catatan.push('Posisi di tepi batas area'); }

  // 8. Selisih waktu perangkat vs server
  if (konteks.selisihJamDetik > 300) { skor += 15; catatan.push('Jam perangkat berbeda jauh dari server'); }

  if (skor > 100) skor = 100;
  const flag = skor < RISIKO.aman ? 'Aman'
             : (skor < RISIKO.perluCek ? 'Perlu Dicek' : 'Mencurigakan');
  return { skor: skor, flag: flag, catatan: catatan.join('; ') };
}

/** Berapa peserta lain memakai sidik perangkat ini hari ini. */
function hitungPemakaiPerangkat(deviceHash, noRegSekarang, tanggalStr) {
  if (!deviceHash) return 0;
  const A = KOL.absensi;
  const data = bacaSheet('absensi');
  const set = {};
  for (let i = 1; i < data.length; i++) {
    if (!data[i][A.tanggal]) continue;
    if (formatWaktu(data[i][A.tanggal], 'yyyy-MM-dd') !== tanggalStr) continue;
    if (String(data[i][A.deviceHash] || '') !== String(deviceHash)) continue;
    const noReg = String(data[i][A.noReg]).trim();
    if (noReg !== String(noRegSekarang).trim()) set[noReg] = true;
  }
  return Object.keys(set).length;
}

function catatPercobaanGagal(peserta, kodeBatch, alasan, jarak, lat, lng, akurasi, skor) {
  try {
    ambilSheet('log_gagal').appendRow([
      formatWaktu(new Date(), 'yyyy-MM-dd HH:mm:ss'),
      "'" + peserta.noRegistrasi, peserta.nama, kodeBatch,
      alasan, jarak || '', lat || '', lng || '', akurasi || '', skor || ''
    ]);
  } catch (e) { /* diabaikan */ }
}

function getLogGagal(token, batas) {
  return jalankan(function () {
    requireAuth(token, [PERAN.admin, PERAN.pembimbing]);
    const G = KOL.gagal;
    const data = bacaSheet('log_gagal');
    const n = Number(batas) || 100;
    const hasil = [];
    for (let i = data.length - 1; i >= 1 && hasil.length < n; i--) {
      hasil.push({
        waktu: String(data[i][G.waktu]), noReg: String(data[i][G.noReg]).replace(/^'/, ''),
        nama: String(data[i][G.nama]), batch: String(data[i][G.batch]),
        alasan: String(data[i][G.alasan]), jarak: data[i][G.jarak],
        akurasi: data[i][G.akurasi], skor: data[i][G.skor]
      });
    }
    return sukses('', { data: hasil });
  });
}

function getAbsensiBerisiko(token, kodeBatch) {
  return jalankan(function () {
    requireAuth(token, [PERAN.admin, PERAN.pembimbing]);
    const A = KOL.absensi;
    const data = bacaSheet('absensi');
    const filter = String(kodeBatch || '').trim();
    const hasil = [];
    for (let i = data.length - 1; i >= 1 && hasil.length < 150; i--) {
      const skor = angkaAman(data[i][A.skorRisiko]);
      if (skor < RISIKO.aman) continue;
      if (filter && String(data[i][A.batch]).trim() !== filter) continue;
      hasil.push({
        tanggal: data[i][A.tanggal] ? formatWaktu(data[i][A.tanggal], 'yyyy-MM-dd') : '',
        noReg: String(data[i][A.noReg]).replace(/^'/, ''), nama: String(data[i][A.nama]),
        batch: String(data[i][A.batch]), jamMasuk: String(data[i][A.jamMasuk] || '-'),
        jarak: angkaAman(data[i][A.jarak]), akurasi: angkaAman(data[i][A.akurasi]),
        skor: skor, flag: String(data[i][A.flagRisiko] || ''),
        verifikasi: String(data[i][A.verifikasi] || ''), foto: String(data[i][A.foto] || '')
      });
    }
    return sukses('', { data: hasil });
  });
}

// ====================================================================
// 11. JADWAL & STATUS ABSENSI HARI INI (PESERTA)
// ====================================================================

function getJadwalHariIni(token) {
  return jalankan(function () {
    const sesi = requireAuth(token, [PERAN.peserta]);
    const peserta = cariPeserta(sesi.identitas);
    if (!peserta) return gagal('Data peserta tidak ditemukan.');

    const per = periodeEfektif(peserta);
    const batch = per.batch;
    if (batch && batch.status !== 'Aktif') {
      return gagal('Batch ' + batch.nama + ' berstatus ' + batch.status + '.');
    }

    const unit = unitEfektif(peserta);
    if (!unit) return gagal('Unit penempatan / titik koordinat belum diatur. Hubungi admin.');

    const sekarang = new Date();
    const hariIni  = hariIniStr();
    const jk = getJamKerja(sekarang.getDay());
    const libur = cekHariLibur(hariIni);

    let bukaAbsensi = true, alasanTutup = '';
    if (!jk.hariKerja) { bukaAbsensi = false; alasanTutup = 'Hari ' + jk.namaHari + ' bukan hari kerja (pola 5 hari kerja Senin–Jumat).'; }
    else if (libur)    { bukaAbsensi = false; alasanTutup = 'Hari ini libur: ' + libur + '.'; }
    else if (per.mulai && new Date(hariIni) < new Date(formatWaktu(per.mulai, 'yyyy-MM-dd'))) {
      bukaAbsensi = false; alasanTutup = 'Periode magang Anda dimulai ' + tanggalIndonesia(per.mulai) + '.';
    } else if (per.selesai && new Date(hariIni) > new Date(formatWaktu(per.selesai, 'yyyy-MM-dd'))) {
      bukaAbsensi = false; alasanTutup = 'Periode magang Anda berakhir ' + tanggalIndonesia(per.selesai) + '.';
    }

    // Absensi hari ini
    const A = KOL.absensi;
    const absensi = bacaSheet('absensi');
    let sudahAbsen = null;
    for (let i = absensi.length - 1; i >= 1; i--) {
      if (!absensi[i][A.tanggal]) continue;
      if (formatWaktu(absensi[i][A.tanggal], 'yyyy-MM-dd') !== hariIni) continue;
      if (String(absensi[i][A.noReg]).trim().replace(/^'/, '') !== peserta.noRegistrasi) continue;
      sudahAbsen = {
        jamMasuk  : String(absensi[i][A.jamMasuk] || ''),
        jamPulang : String(absensi[i][A.jamPulang] || ''),
        status    : String(absensi[i][A.status] || ''),
        keterangan: String(absensi[i][A.keterangan] || ''),
        jarak     : angkaAman(absensi[i][A.jarak]),
        durasi    : angkaAman(absensi[i][A.durasiMenit]),
        aktivitas : String(absensi[i][A.aktivitas] || '')
      };
      break;
    }

    // Izin aktif hari ini
    const I = KOL.izin;
    const izin = bacaSheet('izin');
    let izinHariIni = null;
    for (let i = izin.length - 1; i >= 1; i--) {
      if (String(izin[i][I.noReg]).trim().replace(/^'/, '') !== peserta.noRegistrasi) continue;
      if (!cakupTanggal(izin[i][I.tanggal], izin[i][I.sampai], hariIni)) continue;
      izinHariIni = { jenis: String(izin[i][I.jenis]), status: String(izin[i][I.status]) };
      break;
    }

    const mMasuk  = jamKeMenit(jk.jamMasuk);
    const mPulang = jamKeMenit(jk.jamPulang);
    const jab = cariJabatan(peserta.jabatan);

    return sukses('', {
      peserta: {
        nama: peserta.nama, noRegistrasi: peserta.noRegistrasi,
        institusi: peserta.institusi, jurusan: peserta.jurusan,
        jabatan: jab ? jab.nama : peserta.jabatan, pembimbing: peserta.pembimbing
      },
      batch: batch ? {
        kode: batch.kode, nama: batch.nama, angkatan: batch.angkatan,
        hariKe: hitungHariKe(per.mulai, sekarang), totalHari: per.totalHari
      } : { kode: peserta.batch, nama: peserta.batch, hariKe: hitungHariKe(per.mulai, sekarang), totalHari: 0 },
      unit: { id: unit.id, nama: unit.nama, lat: unit.lat, lng: unit.lng,
              radius: unit.radius, alamat: unit.alamat },
      jamKerja: {
        namaHari: jk.namaHari, hariKerja: jk.hariKerja, jamMasuk: jk.jamMasuk,
        jamPulang: jk.jamPulang, istirahat: jk.istirahat
      },
      jendela: {
        masukBuka  : mMasuk  !== null ? formatMenit(mMasuk - ATURAN.bukaSebelumMenit) : '-',
        masukTutup : mMasuk  !== null ? formatMenit(mMasuk + ATURAN.tutupMasukMenit) : '-',
        pulangBuka : mPulang !== null ? formatMenit(mPulang - ATURAN.pulangSebelumMenit) : '-',
        pulangTutup: mPulang !== null ? formatMenit(mPulang + ATURAN.pulangTutupMenit) : '-',
        toleransi  : ATURAN.toleransiTerlambatMenit
      },
      bukaAbsensi: bukaAbsensi, alasanTutup: alasanTutup,
      sudahAbsen: sudahAbsen, izinHariIni: izinHariIni,
      waktuServer: formatWaktu(sekarang, 'HH:mm:ss'),
      tanggalServer: tanggalIndonesiaLengkap(sekarang),
      epochServer: sekarang.getTime()
    });
  });
}

// ====================================================================
// 12. ABSENSI MASUK
// ====================================================================

function submitAbsensi(token, data) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return gagal('Sistem sedang sibuk. Coba lagi beberapa detik.');

  try {
    const sesi = requireAuth(token, [PERAN.peserta]);
    const peserta = cariPeserta(sesi.identitas);
    if (!peserta) return gagal('Data peserta tidak ditemukan.');
    if (peserta.status !== 'Aktif') return gagal('Status peserta: ' + peserta.status + '.');

    const per = periodeEfektif(peserta);
    if (per.batch && per.batch.status !== 'Aktif') {
      return gagal('Batch berstatus ' + per.batch.status + '.');
    }
    const unit = unitEfektif(peserta);
    if (!unit) return gagal('Unit penempatan belum diatur. Hubungi admin.');

    const sekarang  = new Date();
    const hariIni   = formatWaktu(sekarang, 'yyyy-MM-dd');
    const menitKini = jamKeMenit(formatWaktu(sekarang, 'HH:mm'));
    const jk = getJamKerja(sekarang.getDay());

    // 1. Hari kerja & libur
    if (!jk.hariKerja) return gagal('Hari ' + jk.namaHari + ' bukan hari kerja. Absensi tidak dibuka.');
    const libur = cekHariLibur(hariIni);
    if (libur) return gagal('Hari ini libur: ' + libur + '.');

    // 2. Periode magang
    if (per.mulai && hariIni < formatWaktu(per.mulai, 'yyyy-MM-dd')) {
      return gagal('Periode magang Anda dimulai ' + tanggalIndonesia(per.mulai) + '.');
    }
    if (per.selesai && hariIni > formatWaktu(per.selesai, 'yyyy-MM-dd')) {
      return gagal('Periode magang Anda berakhir ' + tanggalIndonesia(per.selesai) + '.');
    }

    // 3. Jendela waktu
    const mMasuk = jamKeMenit(jk.jamMasuk);
    if (mMasuk === null) return gagal('Jam kerja hari ' + jk.namaHari + ' belum diatur. Hubungi admin.');
    if (menitKini < mMasuk - ATURAN.bukaSebelumMenit) {
      return gagal('Absen masuk dibuka pukul ' + formatMenit(mMasuk - ATURAN.bukaSebelumMenit) + ' WITA.');
    }
    if (menitKini > mMasuk + ATURAN.tutupMasukMenit) {
      return gagal('Absen masuk sudah ditutup pukul ' + formatMenit(mMasuk + ATURAN.tutupMasukMenit) +
                   ' WITA. Ajukan izin atau hubungi pembimbing.');
    }

    // 4. Koordinat & geofence (dihitung di server, bukan di perangkat)
    const lat = Number(data.lat), lng = Number(data.lng);
    const akurasi = angkaAman(data.akurasi);
    if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) {
      return gagal('Koordinat tidak terbaca. Aktifkan GPS lalu coba lagi.');
    }
    const jarak = hitungJarak(lat, lng, unit.lat, unit.lng);
    if (jarak > unit.radius) {
      catatPercobaanGagal(peserta, peserta.batch, 'Di luar radius', jarak, lat, lng, akurasi, '');
      return gagal('Anda berada ' + jarak + ' m dari ' + unit.nama + '. Batas area ' +
                   unit.radius + ' m. Mendekat ke lokasi lalu coba lagi.');
    }

    // 5. Duplikasi
    const A = KOL.absensi;
    const sheetAbsensi = ambilSheet('absensi');
    const absensi = sheetAbsensi.getDataRange().getValues();
    for (let i = 1; i < absensi.length; i++) {
      if (!absensi[i][A.tanggal]) continue;
      if (formatWaktu(absensi[i][A.tanggal], 'yyyy-MM-dd') !== hariIni) continue;
      if (String(absensi[i][A.noReg]).trim().replace(/^'/, '') !== peserta.noRegistrasi) continue;
      return gagal('Anda sudah tercatat hadir hari ini pukul ' + absensi[i][A.jamMasuk] + '.');
    }

    // 6. Skor risiko / anti fake GPS
    const deviceHash = data.sidikPerangkat ? hashRingkas(data.sidikPerangkat) : '';
    const selisihJam = data.waktuPerangkat
      ? Math.abs(Math.round((Number(data.waktuPerangkat) - sekarang.getTime()) / 1000)) : 0;
    const risiko = hitungSkorRisiko({
      akurasi         : akurasi,
      mockTerdeteksi  : !!data.mockTerdeteksi,
      apiDimodifikasi : !!data.apiDimodifikasi,
      emulator        : !!data.emulator,
      koordinatBeku   : !!data.koordinatBeku,
      lompatanJauh    : !!data.lompatanJauh,
      perangkatGanda  : hitungPemakaiPerangkat(deviceHash, peserta.noRegistrasi, hariIni),
      adaFoto         : !!data.foto,
      rasioRadius     : unit.radius > 0 ? jarak / unit.radius : 0,
      selisihJamDetik : selisihJam
    });

    if (risiko.skor >= RISIKO.tolak) {
      catatPercobaanGagal(peserta, peserta.batch, 'Ditolak sistem keamanan: ' + risiko.catatan,
                          jarak, lat, lng, akurasi, risiko.skor);
      catatAudit(peserta.noRegistrasi, PERAN.peserta, 'ABSEN_DITOLAK', risiko.catatan, data.perangkat);
      return gagal('Absensi ditolak sistem keamanan. ' + risiko.catatan +
                   '. Silakan absen manual kepada petugas Satpel.');
    }

    // 7. Status kehadiran
    let status = 'Hadir', keterangan = 'Tepat waktu';
    if (menitKini > mMasuk + ATURAN.toleransiTerlambatMenit) {
      status = 'Terlambat';
      keterangan = 'Terlambat ' + (menitKini - mMasuk) + ' menit';
    }

    // 8. Swafoto
    let urlFoto = '';
    if (data.foto) urlFoto = simpanFoto(data.foto, peserta, sekarang, 'masuk');

    // 9. Catat
    const baris = new Array(SKEMA.absensi.length).fill('');
    baris[A.tanggal]    = hariIni;
    baris[A.noReg]      = "'" + peserta.noRegistrasi;
    baris[A.nama]       = peserta.nama;
    baris[A.batch]      = peserta.batch;
    baris[A.unit]       = unit.id;
    baris[A.jabatan]    = peserta.jabatan;
    baris[A.hariKe]     = hitungHariKe(per.mulai, sekarang);
    baris[A.jamMasuk]   = formatWaktu(sekarang, 'HH:mm:ss');
    baris[A.status]     = status;
    baris[A.keterangan] = keterangan;
    baris[A.lat]        = lat;
    baris[A.lng]        = lng;
    baris[A.jarak]      = jarak;
    baris[A.foto]       = urlFoto;
    baris[A.akurasi]    = Math.round(akurasi);
    baris[A.perangkat]  = String(data.perangkat || '').substring(0, 120);
    baris[A.deviceHash] = deviceHash;
    baris[A.skorRisiko] = risiko.skor;
    baris[A.flagRisiko] = risiko.flag + (risiko.catatan ? ' — ' + risiko.catatan : '');
    baris[A.verifikasi] = risiko.flag === 'Aman' ? 'Otomatis' : 'Perlu Verifikasi';
    sheetAbsensi.appendRow(baris);

    catatAudit(peserta.noRegistrasi, PERAN.peserta, 'ABSEN_MASUK',
               status + ', ' + jarak + ' m, risiko ' + risiko.skor, data.perangkat);

    return sukses(status === 'Hadir' ? 'Absen masuk tercatat.'
                                     : 'Absen masuk tercatat, ' + keterangan.toLowerCase() + '.', {
      nama: peserta.nama, jam: formatWaktu(sekarang, 'HH:mm'), status: status,
      jarak: jarak, lokasi: unit.nama, akurasi: Math.round(akurasi),
      skorRisiko: risiko.skor, flagRisiko: risiko.flag, jenis: 'masuk',
      tanggal: tanggalIndonesiaLengkap(sekarang)
    });
  } catch (err) {
    return gagal(err.message);
  } finally {
    lock.releaseLock();
  }
}

// ====================================================================
// 13. ABSENSI PULANG
// ====================================================================

function submitAbsensiPulang(token, data) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return gagal('Sistem sedang sibuk. Coba lagi beberapa detik.');

  try {
    const sesi = requireAuth(token, [PERAN.peserta]);
    const peserta = cariPeserta(sesi.identitas);
    if (!peserta) return gagal('Data peserta tidak ditemukan.');

    const unit = unitEfektif(peserta);
    if (!unit) return gagal('Unit penempatan belum diatur.');

    const sekarang  = new Date();
    const hariIni   = formatWaktu(sekarang, 'yyyy-MM-dd');
    const menitKini = jamKeMenit(formatWaktu(sekarang, 'HH:mm'));
    const jk = getJamKerja(sekarang.getDay());
    const mPulang = jamKeMenit(jk.jamPulang);

    if (mPulang === null) return gagal('Jam pulang hari ' + jk.namaHari + ' belum diatur.');
    if (menitKini < mPulang - ATURAN.pulangSebelumMenit) {
      return gagal('Absen pulang dibuka pukul ' +
                   formatMenit(mPulang - ATURAN.pulangSebelumMenit) + ' WITA.');
    }
    if (menitKini > mPulang + ATURAN.pulangTutupMenit) {
      return gagal('Absen pulang sudah ditutup pukul ' +
                   formatMenit(mPulang + ATURAN.pulangTutupMenit) + ' WITA.');
    }

    const lat = Number(data.lat), lng = Number(data.lng);
    if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) {
      return gagal('Koordinat tidak terbaca. Aktifkan GPS lalu coba lagi.');
    }
    const jarak = hitungJarak(lat, lng, unit.lat, unit.lng);
    if (jarak > unit.radius) {
      catatPercobaanGagal(peserta, peserta.batch, 'Pulang di luar radius', jarak, lat, lng, data.akurasi, '');
      return gagal('Anda berada ' + jarak + ' m dari ' + unit.nama +
                   '. Batas area ' + unit.radius + ' m.');
    }

    const A = KOL.absensi;
    const sheet = ambilSheet('absensi');
    const absensi = sheet.getDataRange().getValues();

    for (let i = 1; i < absensi.length; i++) {
      if (!absensi[i][A.tanggal]) continue;
      if (formatWaktu(absensi[i][A.tanggal], 'yyyy-MM-dd') !== hariIni) continue;
      if (String(absensi[i][A.noReg]).trim().replace(/^'/, '') !== peserta.noRegistrasi) continue;

      if (String(absensi[i][A.jamPulang] || '')) {
        return gagal('Anda sudah absen pulang pukul ' + absensi[i][A.jamPulang] + '.');
      }

      const jamPulang = formatWaktu(sekarang, 'HH:mm:ss');
      const menitMasuk = jamKeMenit(String(absensi[i][A.jamMasuk]).substring(0, 5));
      const durasi = (menitMasuk !== null) ? Math.max(0, menitKini - menitMasuk) : '';

      let urlFoto = '';
      if (data.foto) urlFoto = simpanFoto(data.foto, peserta, sekarang, 'pulang');

      sheet.getRange(i + 1, A.jamPulang + 1).setValue(jamPulang);
      sheet.getRange(i + 1, A.latPulang + 1, 1, 4).setValues([[lat, lng, jarak, urlFoto]]);
      sheet.getRange(i + 1, A.durasiMenit + 1).setValue(durasi);
      if (data.aktivitas) {
        sheet.getRange(i + 1, A.aktivitas + 1).setValue(String(data.aktivitas).substring(0, 500));
      }

      catatAudit(peserta.noRegistrasi, PERAN.peserta, 'ABSEN_PULANG',
                 jamPulang + ', ' + durasi + ' menit', data.perangkat);

      return sukses('Absen pulang tercatat.', {
        nama: peserta.nama, jam: formatWaktu(sekarang, 'HH:mm'), status: 'Pulang',
        jarak: jarak, lokasi: unit.nama, durasi: durasi, jenis: 'pulang',
        jamKerjaTerpenuhi: durasi !== '' && durasi >= ATURAN.minJamKerjaHarian,
        tanggal: tanggalIndonesiaLengkap(sekarang)
      });
    }
    return gagal('Anda belum absen masuk hari ini.');
  } catch (err) {
    return gagal(err.message);
  } finally {
    lock.releaseLock();
  }
}

// ====================================================================
// 14. PENYIMPANAN SWAFOTO
// ====================================================================

/** Simpan swafoto ke Drive: /<Batch>/<Tanggal>/<noreg>_<waktu>_<jenis>.jpg */
function simpanFoto(base64, peserta, waktu, jenis) {
  try {
    const bersih = String(base64).replace(/^data:image\/\w+;base64,/, '');
    const blob = Utilities.newBlob(
      Utilities.base64Decode(bersih), 'image/jpeg',
      peserta.noRegistrasi + '_' + formatWaktu(waktu, 'yyyyMMdd_HHmmss') +
      '_' + (jenis || 'masuk') + '.jpg');

    const induk = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    const folderBatch = ambilAtauBuatFolder(induk, peserta.batch || 'TANPA_BATCH');
    const folderTanggal = ambilAtauBuatFolder(folderBatch, formatWaktu(waktu, 'yyyy-MM-dd'));
    return folderTanggal.createFile(blob).getUrl();
  } catch (e) {
    return 'GAGAL_UNGGAH: ' + e.message;
  }
}

function ambilAtauBuatFolder(induk, nama) {
  const it = induk.getFoldersByName(nama);
  return it.hasNext() ? it.next() : induk.createFolder(nama);
}

// ====================================================================
// 15. RIWAYAT & STATISTIK PESERTA
// ====================================================================

function getRiwayatPeserta(token, jumlah) {
  return jalankan(function () {
    const sesi = requireAuth(token, [PERAN.peserta]);
    const peserta = cariPeserta(sesi.identitas);
    if (!peserta) return gagal('Data peserta tidak ditemukan.');
    const per = periodeEfektif(peserta);

    const A = KOL.absensi;
    const data = bacaSheet('absensi');
    const batas = Number(jumlah) || 30;
    const hasil = [];
    let hadir = 0, terlambat = 0, izin = 0, sakit = 0, alpa = 0, totalMenit = 0;

    for (let i = data.length - 1; i >= 1; i--) {
      if (String(data[i][A.noReg]).trim().replace(/^'/, '') !== sesi.identitas) continue;
      const st = String(data[i][A.status]);
      if (st === 'Terlambat') terlambat++;
      else if (st === 'Izin') izin++;
      else if (st === 'Sakit') sakit++;
      else if (st === 'Alpa') alpa++;
      else if (st === 'Hadir') hadir++;
      totalMenit += angkaAman(data[i][A.durasiMenit]);

      if (hasil.length < batas) {
        hasil.push({
          tanggal   : data[i][A.tanggal] ? formatWaktu(data[i][A.tanggal], 'yyyy-MM-dd') : '',
          tanggalIndo: data[i][A.tanggal] ? tanggalIndonesia(data[i][A.tanggal]) : '',
          hari      : data[i][A.tanggal] ? NAMA_HARI[new Date(data[i][A.tanggal]).getDay()] : '',
          hariKe    : data[i][A.hariKe],
          jamMasuk  : String(data[i][A.jamMasuk] || '-'),
          jamPulang : String(data[i][A.jamPulang] || '-'),
          durasi    : angkaAman(data[i][A.durasiMenit]),
          status    : st,
          keterangan: String(data[i][A.keterangan] || ''),
          foto      : String(data[i][A.foto] || '')
        });
      }
    }

    const hariBerjalan = per.mulai
      ? Math.min(hitungHariKe(per.mulai, new Date()), per.totalHari || 9999) : 0;
    const efektif = hadir + terlambat;
    const persentase = hariBerjalan > 0 ? Math.round((efektif / hariBerjalan) * 100) : 0;

    return sukses('', {
      data: hasil,
      statistik: {
        hadir: hadir, terlambat: terlambat, izin: izin, sakit: sakit,
        alpa: Math.max(alpa, Math.max(0, hariBerjalan - efektif - izin - sakit)),
        hariBerjalan: hariBerjalan, totalHari: per.totalHari,
        persentase: persentase, ambang: ATURAN.ambangKehadiranLulus,
        totalJam: Math.round(totalMenit / 6) / 10,
        rataJam: efektif > 0 ? Math.round(totalMenit / efektif / 6) / 10 : 0
      }
    });
  });
}

// ====================================================================
// 16. PENGAJUAN IZIN / SAKIT / DINAS
// ====================================================================

function ajukanIzin(token, data) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return gagal('Sistem sibuk, coba lagi.');
  try {
    const sesi = requireAuth(token, [PERAN.peserta]);
    const peserta = cariPeserta(sesi.identitas);
    if (!peserta) return gagal('Data peserta tidak ditemukan.');

    const jenis = String(data.jenis || '').trim();
    if (['Izin', 'Sakit', 'Dinas Luar', 'Cuti'].indexOf(jenis) === -1) {
      return gagal('Jenis pengajuan tidak dikenali.');
    }
    const tanggal = String(data.tanggal || '').trim();
    const sampai  = String(data.sampai || tanggal).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) return gagal('Tanggal mulai tidak valid.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(sampai))  return gagal('Tanggal selesai tidak valid.');
    if (sampai < tanggal) return gagal('Tanggal selesai tidak boleh mendahului tanggal mulai.');
    if (String(data.alasan || '').trim().length < 10) {
      return gagal('Alasan minimal 10 karakter agar dapat diverifikasi.');
    }

    const I = KOL.izin;
    const sheet = ambilSheet('izin');
    const ada = sheet.getDataRange().getValues();
    for (let i = 1; i < ada.length; i++) {
      if (String(ada[i][I.noReg]).trim().replace(/^'/, '') !== peserta.noRegistrasi) continue;
      if (String(ada[i][I.status]) === 'Ditolak') continue;
      if (cakupTanggal(ada[i][I.tanggal], ada[i][I.sampai], tanggal) ||
          cakupTanggal(ada[i][I.tanggal], ada[i][I.sampai], sampai)) {
        return gagal('Sudah ada pengajuan yang beririsan pada tanggal tersebut (' +
                     ada[i][I.status] + ').');
      }
    }

    let urlLampiran = '';
    if (data.lampiran) {
      try {
        const cocok = String(data.lampiran).match(/^data:([^;]+);base64,(.*)$/);
        const mime = cocok ? cocok[1] : 'image/jpeg';
        const isi  = cocok ? cocok[2] : String(data.lampiran);
        const ext  = mime.indexOf('pdf') > -1 ? '.pdf' : '.jpg';
        const blob = Utilities.newBlob(Utilities.base64Decode(isi), mime,
          peserta.noRegistrasi + '_' + bersihkanNamaBerkas(jenis) + '_' +
          tanggal.replace(/-/g, '') + ext);
        const folder = ambilAtauBuatFolder(DriveApp.getFolderById(DRIVE_FOLDER_ID), 'Lampiran Izin');
        urlLampiran = folder.createFile(blob).getUrl();
      } catch (e) { urlLampiran = 'GAGAL_UNGGAH'; }
    }

    const id = 'IZ' + formatWaktu(new Date(), 'yyyyMMddHHmmss');
    sheet.appendRow([
      id, formatWaktu(new Date(), 'yyyy-MM-dd HH:mm:ss'), "'" + peserta.noRegistrasi,
      peserta.nama, peserta.batch, tanggal, sampai, jenis,
      String(data.alasan).substring(0, 500), urlLampiran, 'Menunggu', '', '', ''
    ]);
    catatAudit(peserta.noRegistrasi, PERAN.peserta, 'AJUKAN_IZIN', jenis + ' ' + tanggal + ' s.d. ' + sampai);
    return sukses('Pengajuan ' + jenis.toLowerCase() +
                  ' terkirim. Menunggu verifikasi pembimbing/petugas.', { id: id });
  } catch (err) {
    return gagal(err.message);
  } finally {
    lock.releaseLock();
  }
}

function getIzinSaya(token) {
  return jalankan(function () {
    const sesi = requireAuth(token, [PERAN.peserta]);
    const I = KOL.izin;
    const data = bacaSheet('izin');
    const hasil = [];
    for (let i = data.length - 1; i >= 1; i--) {
      if (String(data[i][I.noReg]).trim().replace(/^'/, '') !== sesi.identitas) continue;
      hasil.push({
        id: String(data[i][I.id]),
        diajukan: String(data[i][I.diajukan]),
        tanggal: data[i][I.tanggal] ? formatWaktu(data[i][I.tanggal], 'yyyy-MM-dd') : '',
        sampai : data[i][I.sampai]  ? formatWaktu(data[i][I.sampai], 'yyyy-MM-dd') : '',
        jenis: String(data[i][I.jenis]), alasan: String(data[i][I.alasan]),
        status: String(data[i][I.status]), catatan: String(data[i][I.catatan] || ''),
        lampiran: String(data[i][I.lampiran] || '')
      });
    }
    return sukses('', { data: hasil });
  });
}

function getDaftarIzin(token, statusFilter, kodeBatch) {
  return jalankan(function () {
    const sesi = requireAuth(token, [PERAN.admin, PERAN.pembimbing]);
    const I = KOL.izin;
    const data = bacaSheet('izin');
    const fs = String(statusFilter || '').trim();
    const fb = String(kodeBatch || '').trim();
    const hasil = [];
    for (let i = data.length - 1; i >= 1; i--) {
      if (fs && String(data[i][I.status]) !== fs) continue;
      if (fb && String(data[i][I.batch]).trim() !== fb) continue;
      hasil.push({
        id: String(data[i][I.id]), diajukan: String(data[i][I.diajukan]),
        noReg: String(data[i][I.noReg]).replace(/^'/, ''), nama: String(data[i][I.nama]),
        batch: String(data[i][I.batch]),
        tanggal: data[i][I.tanggal] ? formatWaktu(data[i][I.tanggal], 'yyyy-MM-dd') : '',
        sampai : data[i][I.sampai]  ? formatWaktu(data[i][I.sampai], 'yyyy-MM-dd') : '',
        jenis: String(data[i][I.jenis]), alasan: String(data[i][I.alasan]),
        lampiran: String(data[i][I.lampiran] || ''), status: String(data[i][I.status]),
        diproses: String(data[i][I.diproses] || ''), catatan: String(data[i][I.catatan] || '')
      });
    }
    return sukses('', { data: hasil, peran: sesi.peran });
  });
}

function prosesIzin(token, id, keputusan, catatan) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return gagal('Sistem sibuk, coba lagi.');
  try {
    const sesi = requireAuth(token, [PERAN.admin, PERAN.pembimbing]);
    if (['Disetujui', 'Ditolak'].indexOf(keputusan) === -1) return gagal('Keputusan tidak valid.');

    const I = KOL.izin;
    const sheet = ambilSheet('izin');
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][I.id]) !== String(id)) continue;
      if (String(data[i][I.status]) !== 'Menunggu') {
        return gagal('Pengajuan ini sudah diproses (' + data[i][I.status] + ').');
      }
      sheet.getRange(i + 1, I.status + 1, 1, 4).setValues([[
        keputusan, sesi.identitas, formatWaktu(new Date(), 'yyyy-MM-dd HH:mm:ss'),
        String(catatan || '').substring(0, 300)
      ]]);

      // Jika disetujui, tuliskan status pada seluruh hari kerja dalam rentang
      if (keputusan === 'Disetujui') {
        const jenis = String(data[i][I.jenis]);
        const status = (jenis === 'Sakit') ? 'Sakit' : (jenis === 'Dinas Luar' ? 'Dinas Luar' : 'Izin');
        const noReg = String(data[i][I.noReg]).replace(/^'/, '').trim();
        daftarHariKerja(data[i][I.tanggal], data[i][I.sampai] || data[i][I.tanggal])
          .forEach(function (h) {
            tulisStatusAbsensi(noReg, h.tanggal, status,
                               jenis + ' disetujui: ' + String(data[i][I.alasan]).substring(0, 120),
                               sesi.identitas);
          });
      }
      catatAudit(sesi.identitas, sesi.peran, 'PROSES_IZIN', id + ' -> ' + keputusan);
      return sukses('Pengajuan ' + keputusan.toLowerCase() + '.');
    }
    return gagal('Pengajuan tidak ditemukan.');
  } catch (err) {
    return gagal(err.message);
  } finally {
    lock.releaseLock();
  }
}

// ====================================================================
// 17. KOREKSI & VERIFIKASI ABSENSI (ADMIN / PEMBIMBING)
// ====================================================================

function tulisStatusAbsensi(noRegistrasi, tanggal, status, keterangan, aktor) {
  const A = KOL.absensi;
  const sheet = ambilSheet('absensi');
  const data = sheet.getDataRange().getValues();
  const noReg = String(noRegistrasi).trim();

  for (let i = 1; i < data.length; i++) {
    if (!data[i][A.tanggal]) continue;
    if (formatWaktu(data[i][A.tanggal], 'yyyy-MM-dd') !== tanggal) continue;
    if (String(data[i][A.noReg]).trim().replace(/^'/, '') !== noReg) continue;
    sheet.getRange(i + 1, A.status + 1, 1, 2).setValues([[status, keterangan]]);
    sheet.getRange(i + 1, A.catatanAdmin + 1).setValue('Dikoreksi oleh ' + aktor);
    return true;
  }

  const peserta = cariPeserta(noReg);
  if (!peserta) return false;
  const per = periodeEfektif(peserta);
  const baris = new Array(SKEMA.absensi.length).fill('');
  baris[A.tanggal]      = tanggal;
  baris[A.noReg]        = "'" + noReg;
  baris[A.nama]         = peserta.nama;
  baris[A.batch]        = peserta.batch;
  baris[A.unit]         = peserta.unit;
  baris[A.jabatan]      = peserta.jabatan;
  baris[A.hariKe]       = hitungHariKe(per.mulai, new Date(tanggal));
  baris[A.status]       = status;
  baris[A.keterangan]   = keterangan;
  baris[A.verifikasi]   = 'Manual';
  baris[A.catatanAdmin] = 'Dicatat oleh ' + aktor;
  sheet.appendRow(baris);
  return true;
}

function tandaiStatusManual(token, noRegistrasi, tanggal, status, keterangan) {
  return jalankan(function () {
    const sesi = requireAuth(token, [PERAN.admin, PERAN.pembimbing]);
    if (['Hadir','Terlambat','Izin','Sakit','Dinas Luar','Alpa'].indexOf(status) === -1) {
      return gagal('Status tidak valid.');
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(tanggal))) return gagal('Tanggal tidak valid.');
    const ok = tulisStatusAbsensi(noRegistrasi, tanggal, status,
                                  keterangan || 'Dicatat manual oleh petugas', sesi.identitas);
    if (!ok) return gagal('Peserta tidak ditemukan.');
    catatAudit(sesi.identitas, sesi.peran, 'KOREKSI_ABSENSI',
               noRegistrasi + ' ' + tanggal + ' -> ' + status);
    return sukses('Status kehadiran diperbarui.');
  });
}

function verifikasiAbsensi(token, noRegistrasi, tanggal, keputusan, catatan) {
  return jalankan(function () {
    const sesi = requireAuth(token, [PERAN.admin, PERAN.pembimbing]);
    if (['Sah', 'Tidak Sah'].indexOf(keputusan) === -1) return gagal('Keputusan tidak valid.');

    const A = KOL.absensi;
    const sheet = ambilSheet('absensi');
    const data = sheet.getDataRange().getValues();
    const noReg = String(noRegistrasi).trim();
    for (let i = 1; i < data.length; i++) {
      if (!data[i][A.tanggal]) continue;
      if (formatWaktu(data[i][A.tanggal], 'yyyy-MM-dd') !== String(tanggal)) continue;
      if (String(data[i][A.noReg]).trim().replace(/^'/, '') !== noReg) continue;

      sheet.getRange(i + 1, A.verifikasi + 1, 1, 2).setValues([[
        keputusan + ' (' + sesi.identitas + ')', String(catatan || '').substring(0, 300)
      ]]);
      if (keputusan === 'Tidak Sah') {
        sheet.getRange(i + 1, A.status + 1, 1, 2)
             .setValues([['Alpa', 'Absensi dibatalkan: ' + (catatan || 'tidak sah')]]);
      }
      catatAudit(sesi.identitas, sesi.peran, 'VERIFIKASI', noReg + ' ' + tanggal + ' -> ' + keputusan);
      return sukses('Verifikasi tersimpan.');
    }
    return gagal('Data absensi tidak ditemukan.');
  });
}

// ====================================================================
// 18. DASHBOARD & ANALITIK
// ====================================================================

/** Daftar batch yang boleh dilihat pengguna (pembimbing dibatasi). */
function batchDiizinkan(sesi) {
  if (sesi.peran === PERAN.admin) return null;   // null = semua
  const U = KOL.users;
  const users = bacaSheet('users');
  for (let i = 1; i < users.length; i++) {
    if (String(users[i][U.username]).trim() !== sesi.identitas) continue;
    return String(users[i][U.batch] || '').split(',')
      .map(function (k) { return k.trim(); }).filter(Boolean);
  }
  return [];
}

function getDaftarBatch(token) {
  return jalankan(function () {
    const sesi = requireAuth(token);
    const izin = batchDiizinkan(sesi);
    const K = KOL.batch;
    const data = bacaSheet('batch');
    const hasil = [];
    for (let i = 1; i < data.length; i++) {
      if (!data[i][K.kode]) continue;
      const kode = String(data[i][K.kode]).trim();
      if (izin && izin.length && izin.indexOf(kode) === -1) continue;
      const unit = cariUnit(data[i][K.unit]);
      hasil.push({
        kode: kode, nama: String(data[i][K.nama]), angkatan: String(data[i][K.angkatan] || ''),
        mulai: data[i][K.mulai] ? formatWaktu(data[i][K.mulai], 'yyyy-MM-dd') : '',
        selesai: data[i][K.selesai] ? formatWaktu(data[i][K.selesai], 'yyyy-MM-dd') : '',
        totalHari: angkaAman(data[i][K.totalHari]), unit: String(data[i][K.unit] || ''),
        namaUnit: unit ? unit.nama : '-', status: String(data[i][K.status] || 'Aktif'),
        penanggungJawab: String(data[i][K.penanggungJawab] || ''),
        keterangan: String(data[i][K.keterangan] || '')
      });
    }
    return sukses('', { data: hasil });
  });
}

/** Statistik kehadiran satu tanggal (default hari ini). */
function getStatistikHarian(token, kodeBatch, tanggal) {
  return jalankan(function () {
    const sesi = requireAuth(token, [PERAN.admin, PERAN.pembimbing]);
    const izinBatch = batchDiizinkan(sesi);
    const tgl = /^\d{4}-\d{2}-\d{2}$/.test(String(tanggal)) ? String(tanggal) : hariIniStr();
    const fb = String(kodeBatch || '').trim();

    const P = KOL.peserta, A = KOL.absensi;
    const peserta = bacaSheet('peserta');
    const absensi = bacaSheet('absensi');

    const aktif = {};
    let totalPeserta = 0;
    for (let i = 1; i < peserta.length; i++) {
      const noReg = String(peserta[i][P.noReg]).trim();
      if (!noReg) continue;
      if (String(peserta[i][P.status] || 'Aktif') !== 'Aktif') continue;
      const kb = String(peserta[i][P.batch]).trim();
      if (fb && kb !== fb) continue;
      if (izinBatch && izinBatch.length && izinBatch.indexOf(kb) === -1) continue;
      if (!dalamPeriodeMagang(peserta[i], new Date(tgl))) continue;
      aktif[noReg] = bentukPeserta(peserta[i], i + 1);
      totalPeserta++;
    }

    const hitung = { Hadir:0, Terlambat:0, Izin:0, Sakit:0, 'Dinas Luar':0, Alpa:0 };
    const rincian = [];
    const sudah = {};
    let totalMenit = 0, sudahPulang = 0, berisiko = 0;

    for (let i = 1; i < absensi.length; i++) {
      if (!absensi[i][A.tanggal]) continue;
      if (formatWaktu(absensi[i][A.tanggal], 'yyyy-MM-dd') !== tgl) continue;
      const noReg = String(absensi[i][A.noReg]).trim().replace(/^'/, '');
      if (!aktif[noReg]) continue;
      sudah[noReg] = true;

      const st = String(absensi[i][A.status] || 'Hadir');
      if (hitung[st] === undefined) hitung[st] = 0;
      hitung[st]++;
      const durasi = angkaAman(absensi[i][A.durasiMenit]);
      totalMenit += durasi;
      if (String(absensi[i][A.jamPulang] || '')) sudahPulang++;
      if (angkaAman(absensi[i][A.skorRisiko]) >= RISIKO.aman) berisiko++;

      const jab = namaJabatan(aktif[noReg].jabatan);
      rincian.push({
        noReg: noReg, nama: String(absensi[i][A.nama]), batch: String(absensi[i][A.batch]),
        jabatan: jab, jamMasuk: String(absensi[i][A.jamMasuk] || '-'),
        jamPulang: String(absensi[i][A.jamPulang] || '-'), status: st,
        keterangan: String(absensi[i][A.keterangan] || ''),
        jarak: angkaAman(absensi[i][A.jarak]), durasi: durasi,
        skor: angkaAman(absensi[i][A.skorRisiko]), foto: String(absensi[i][A.foto] || ''),
        verifikasi: String(absensi[i][A.verifikasi] || ''),
        institusi: aktif[noReg].institusi
      });
    }

    const belum = [];
    Object.keys(aktif).forEach(function (noReg) {
      if (sudah[noReg]) return;
      belum.push({
        noReg: noReg, nama: aktif[noReg].nama, batch: aktif[noReg].batch,
        institusi: aktif[noReg].institusi, noHp: aktif[noReg].noHp,
        jabatan: namaJabatan(aktif[noReg].jabatan)
      });
    });

    const hadirEfektif = hitung.Hadir + hitung.Terlambat;
    const jk = getJamKerja(new Date(tgl).getDay());

    return sukses('', {
      tanggal: tgl, tanggalIndo: tanggalIndonesiaLengkap(new Date(tgl)),
      hariKerja: jk.hariKerja && !cekHariLibur(tgl),
      keteranganHari: cekHariLibur(tgl) || (jk.hariKerja ? 'Hari kerja' : 'Bukan hari kerja'),
      jamKerja: jk.jamMasuk + ' – ' + jk.jamPulang,
      ringkasan: {
        totalPeserta: totalPeserta, hadir: hitung.Hadir, terlambat: hitung.Terlambat,
        izin: hitung.Izin, sakit: hitung.Sakit, dinas: hitung['Dinas Luar'],
        alpa: hitung.Alpa, belumAbsen: belum.length, sudahPulang: sudahPulang,
        berisiko: berisiko,
        persenKehadiran: persen(hadirEfektif, totalPeserta),
        rataJam: hadirEfektif > 0 ? Math.round(totalMenit / hadirEfektif / 6) / 10 : 0
      },
      rincian: rincian, belumAbsen: belum
    });
  });
}

/** Tren kehadiran N hari kerja terakhir untuk grafik garis. */
function getTrenKehadiran(token, kodeBatch, jumlahHari) {
  return jalankan(function () {
    const sesi = requireAuth(token, [PERAN.admin, PERAN.pembimbing]);
    const izinBatch = batchDiizinkan(sesi);
    const n = Number(jumlahHari) || 14;
    const fb = String(kodeBatch || '').trim();

    const akhir = new Date();
    const awal = new Date(); awal.setDate(awal.getDate() - (n * 2 + 10));
    const hariKerja = daftarHariKerja(awal, akhir).slice(-n);

    const A = KOL.absensi, P = KOL.peserta;
    const absensi = bacaSheet('absensi');
    const peserta = bacaSheet('peserta');

    const pesertaBatch = {};
    for (let i = 1; i < peserta.length; i++) {
      const noReg = String(peserta[i][P.noReg]).trim();
      if (!noReg) continue;
      const kb = String(peserta[i][P.batch]).trim();
      if (fb && kb !== fb) continue;
      if (izinBatch && izinBatch.length && izinBatch.indexOf(kb) === -1) continue;
      pesertaBatch[noReg] = peserta[i];
    }

    const peta = {};
    hariKerja.forEach(function (h) {
      peta[h.tanggal] = { hadir:0, terlambat:0, izin:0, sakit:0, alpa:0, total:0 };
    });

    for (let i = 1; i < absensi.length; i++) {
      if (!absensi[i][A.tanggal]) continue;
      const t = formatWaktu(absensi[i][A.tanggal], 'yyyy-MM-dd');
      if (!peta[t]) continue;
      const noReg = String(absensi[i][A.noReg]).trim().replace(/^'/, '');
      if (!pesertaBatch[noReg]) continue;
      const st = String(absensi[i][A.status]);
      if (st === 'Hadir') peta[t].hadir++;
      else if (st === 'Terlambat') peta[t].terlambat++;
      else if (st === 'Izin' || st === 'Dinas Luar') peta[t].izin++;
      else if (st === 'Sakit') peta[t].sakit++;
      else if (st === 'Alpa') peta[t].alpa++;
      peta[t].total++;
    }

    // Peserta aktif per tanggal (denominator)
    const hasil = hariKerja.map(function (h) {
      let aktif = 0;
      Object.keys(pesertaBatch).forEach(function (noReg) {
        const b = pesertaBatch[noReg];
        if (String(b[P.status] || 'Aktif') !== 'Aktif') return;
        if (dalamPeriodeMagang(b, new Date(h.tanggal))) aktif++;
      });
      const d = peta[h.tanggal];
      const efektif = d.hadir + d.terlambat;
      return {
        tanggal: h.tanggal, label: formatWaktu(new Date(h.tanggal), 'dd/MM'),
        hari: h.hari.substring(0, 3),
        hadir: d.hadir, terlambat: d.terlambat, izin: d.izin, sakit: d.sakit,
        alpa: Math.max(d.alpa, Math.max(0, aktif - efektif - d.izin - d.sakit)),
        aktif: aktif, persen: persen(efektif, aktif)
      };
    });

    return sukses('', { data: hasil });
  });
}

/** Ringkasan global untuk kartu dashboard. */
function getRingkasanGlobal(token) {
  return jalankan(function () {
    const sesi = requireAuth(token, [PERAN.admin, PERAN.pembimbing]);
    const izinBatch = batchDiizinkan(sesi);

    const P = KOL.peserta, B = KOL.batch, I = KOL.izin;
    const peserta = bacaSheet('peserta');
    const batch   = bacaSheet('batch');
    const izin    = bacaSheet('izin');

    let totalPeserta = 0, pesertaAktif = 0, lk = 0, pr = 0;
    const perInstitusi = {}, perUnit = {}, perJabatan = {};
    for (let i = 1; i < peserta.length; i++) {
      if (!String(peserta[i][P.noReg]).trim()) continue;
      const kb = String(peserta[i][P.batch]).trim();
      if (izinBatch && izinBatch.length && izinBatch.indexOf(kb) === -1) continue;
      totalPeserta++;
      if (String(peserta[i][P.status] || 'Aktif') === 'Aktif') pesertaAktif++;
      const jk = String(peserta[i][P.jk] || '').toUpperCase();
      if (jk.indexOf('L') === 0) lk++; else if (jk.indexOf('P') === 0) pr++;
      const inst = String(peserta[i][P.institusi] || 'Lainnya');
      perInstitusi[inst] = (perInstitusi[inst] || 0) + 1;
      const u = String(peserta[i][P.unit] || '-');
      perUnit[u] = (perUnit[u] || 0) + 1;
      const j = String(peserta[i][P.jabatan] || '-');
      perJabatan[j] = (perJabatan[j] || 0) + 1;
    }

    let batchAktif = 0, totalBatch = 0;
    for (let i = 1; i < batch.length; i++) {
      if (!String(batch[i][B.kode]).trim()) continue;
      const kode = String(batch[i][B.kode]).trim();
      if (izinBatch && izinBatch.length && izinBatch.indexOf(kode) === -1) continue;
      totalBatch++;
      if (String(batch[i][B.status] || 'Aktif') === 'Aktif') batchAktif++;
    }

    let izinMenunggu = 0;
    for (let i = 1; i < izin.length; i++) {
      if (String(izin[i][I.status]) === 'Menunggu') izinMenunggu++;
    }

    function keArray(obj) {
      return Object.keys(obj).map(function (k) { return { label: k, jumlah: obj[k] }; })
        .sort(function (a, b) { return b.jumlah - a.jumlah; });
    }

    // Nama unit & jabatan yang terbaca manusia
    const unitLabel = keArray(perUnit).map(function (x) {
      const u = cariUnit(x.label); return { label: u ? u.nama : x.label, jumlah: x.jumlah };
    });
    const jabatanLabel = keArray(perJabatan).map(function (x) {
      const j = cariJabatan(x.label); return { label: j ? j.nama : x.label, jumlah: x.jumlah };
    });

    return sukses('', {
      ringkasan: {
        totalPeserta: totalPeserta, pesertaAktif: pesertaAktif,
        lakiLaki: lk, perempuan: pr, totalBatch: totalBatch, batchAktif: batchAktif,
        izinMenunggu: izinMenunggu,
        jumlahHariKerja: [0,1,2,3,4,5,6].filter(function (h) { return getJamKerja(h).hariKerja; }).length
      },
      perInstitusi: keArray(perInstitusi).slice(0, 8),
      perUnit: unitLabel.slice(0, 8),
      perJabatan: jabatanLabel.slice(0, 8)
    });
  });
}

/** Peserta dengan persentase kehadiran di bawah ambang. */
function getPesertaRawan(token, kodeBatch) {
  return jalankan(function () {
    const rekap = getRekapBatch(token, kodeBatch);
    if (!rekap.sukses) return rekap;
    const rawan = rekap.data.filter(function (p) { return p.persentase < ATURAN.ambangRawan; })
      .sort(function (a, b) { return a.persentase - b.persentase; });
    return sukses('', { data: rawan, ambang: ATURAN.ambangRawan });
  });
}

// ====================================================================
// 19. REKAPITULASI — PER BATCH, HARIAN, MINGGUAN, BULANAN
// ====================================================================

/** Rekap kumulatif seluruh peserta pada satu batch (atau semua batch). */
function getRekapBatch(token, kodeBatch) {
  return jalankan(function () {
    const sesi = requireAuth(token, [PERAN.admin, PERAN.pembimbing]);
    const izinBatch = batchDiizinkan(sesi);
    const fb = String(kodeBatch || '').trim();

    const P = KOL.peserta, A = KOL.absensi;
    const peserta = bacaSheet('peserta');
    const absensi = bacaSheet('absensi');

    const daftar = {};
    for (let i = 1; i < peserta.length; i++) {
      const noReg = String(peserta[i][P.noReg]).trim();
      if (!noReg) continue;
      const kb = String(peserta[i][P.batch]).trim();
      if (fb && kb !== fb) continue;
      if (izinBatch && izinBatch.length && izinBatch.indexOf(kb) === -1) continue;
      const p = bentukPeserta(peserta[i], i + 1);
      const per = periodeEfektif(p);
      daftar[noReg] = {
        noReg: noReg, nama: p.nama, jk: p.jenisKelamin, batch: p.batch,
        institusi: p.institusi, jurusan: p.jurusan, jabatan: p.jabatan,
        unit: p.unit, pembimbing: p.pembimbing, status: p.status,
        hadir: 0, terlambat: 0, izin: 0, sakit: 0, dinas: 0, alpa: 0,
        totalMenit: 0, hariBerjalan: per.mulai ? Math.min(hitungHariKe(per.mulai, new Date()),
                                                          per.totalHari || 9999) : 0,
        totalHari: per.totalHari
      };
    }

    for (let i = 1; i < absensi.length; i++) {
      const noReg = String(absensi[i][A.noReg]).trim().replace(/^'/, '');
      const d = daftar[noReg];
      if (!d) continue;
      const st = String(absensi[i][A.status]);
      if (st === 'Hadir') d.hadir++;
      else if (st === 'Terlambat') d.terlambat++;
      else if (st === 'Izin') d.izin++;
      else if (st === 'Sakit') d.sakit++;
      else if (st === 'Dinas Luar') d.dinas++;
      else if (st === 'Alpa') d.alpa++;
      d.totalMenit += angkaAman(absensi[i][A.durasiMenit]);
    }

    const hasil = Object.keys(daftar).map(function (k) {
      const d = daftar[k];
      const efektif = d.hadir + d.terlambat + d.dinas;
      d.persentase = d.hariBerjalan > 0 ? Math.round((efektif / d.hariBerjalan) * 1000) / 10 : 0;
      d.alpa = Math.max(d.alpa, Math.max(0, d.hariBerjalan - efektif - d.izin - d.sakit));
      d.totalJam = Math.round(d.totalMenit / 6) / 10;
      d.keterangan = d.persentase >= ATURAN.ambangKehadiranLulus ? 'Memenuhi' : 'Belum memenuhi';
      const jab = cariJabatan(d.jabatan);
      d.namaJabatan = jab ? jab.nama : d.jabatan;
      const un = cariUnit(d.unit);
      d.namaUnit = un ? un.nama : d.unit;
      return d;
    }).sort(function (a, b) { return String(a.nama).localeCompare(String(b.nama)); });

    return sukses('', { data: hasil, ambang: ATURAN.ambangKehadiranLulus });
  });
}

/** Rekap MINGGUAN: matriks peserta x hari kerja dalam satu minggu. */
function getRekapMingguan(token, kodeBatch, tanggalAcuan) {
  return jalankan(function () {
    const sesi = requireAuth(token, [PERAN.admin, PERAN.pembimbing]);
    const izinBatch = batchDiizinkan(sesi);
    const acuan = /^\d{4}-\d{2}-\d{2}$/.test(String(tanggalAcuan))
      ? new Date(String(tanggalAcuan)) : new Date();
    const senin = awalMinggu(acuan);
    const jumat = new Date(senin); jumat.setDate(jumat.getDate() + 6);
    const hariKerja = daftarHariKerja(senin, jumat);
    const fb = String(kodeBatch || '').trim();

    const P = KOL.peserta, A = KOL.absensi;
    const peserta = bacaSheet('peserta');
    const absensi = bacaSheet('absensi');

    const daftar = {};
    for (let i = 1; i < peserta.length; i++) {
      const noReg = String(peserta[i][P.noReg]).trim();
      if (!noReg) continue;
      const kb = String(peserta[i][P.batch]).trim();
      if (fb && kb !== fb) continue;
      if (izinBatch && izinBatch.length && izinBatch.indexOf(kb) === -1) continue;
      if (String(peserta[i][P.status] || 'Aktif') !== 'Aktif') continue;
      const p = bentukPeserta(peserta[i], i + 1);
      const jab = cariJabatan(p.jabatan);
      daftar[noReg] = {
        noReg: noReg, nama: p.nama, batch: p.batch, institusi: p.institusi,
        namaJabatan: jab ? jab.nama : p.jabatan,
        hari: {}, hadir: 0, terlambat: 0, izin: 0, sakit: 0, alpa: 0, totalMenit: 0
      };
      hariKerja.forEach(function (h) { daftar[noReg].hari[h.tanggal] = '-'; });
    }

    const petaTanggal = {};
    hariKerja.forEach(function (h) { petaTanggal[h.tanggal] = true; });

    for (let i = 1; i < absensi.length; i++) {
      if (!absensi[i][A.tanggal]) continue;
      const t = formatWaktu(absensi[i][A.tanggal], 'yyyy-MM-dd');
      if (!petaTanggal[t]) continue;
      const noReg = String(absensi[i][A.noReg]).trim().replace(/^'/, '');
      const d = daftar[noReg];
      if (!d) continue;
      const st = String(absensi[i][A.status]);
      d.hari[t] = st === 'Hadir' ? 'H' : st === 'Terlambat' ? 'T'
                : st === 'Izin' ? 'I' : st === 'Sakit' ? 'S'
                : st === 'Dinas Luar' ? 'D' : 'A';
      if (st === 'Hadir') d.hadir++;
      else if (st === 'Terlambat') d.terlambat++;
      else if (st === 'Izin' || st === 'Dinas Luar') d.izin++;
      else if (st === 'Sakit') d.sakit++;
      else if (st === 'Alpa') d.alpa++;
      d.totalMenit += angkaAman(absensi[i][A.durasiMenit]);
    }

    const hasil = Object.keys(daftar).map(function (k) {
      const d = daftar[k];
      const efektif = d.hadir + d.terlambat;
      d.persentase = hariKerja.length > 0 ? Math.round((efektif / hariKerja.length) * 1000) / 10 : 0;
      d.totalJam = Math.round(d.totalMenit / 6) / 10;
      return d;
    }).sort(function (a, b) { return String(a.nama).localeCompare(String(b.nama)); });

    return sukses('', {
      periode: {
        dari: formatWaktu(senin, 'yyyy-MM-dd'), sampai: formatWaktu(jumat, 'yyyy-MM-dd'),
        label: 'Minggu ke-' + nomorMingguIso(senin) + ' Tahun ' + senin.getFullYear(),
        rentangIndo: tanggalIndonesia(senin) + ' s.d. ' + tanggalIndonesia(hariKerja.length
          ? new Date(hariKerja[hariKerja.length - 1].tanggal) : jumat)
      },
      hariKerja: hariKerja, data: hasil
    });
  });
}

/** Rekap BULANAN: matriks peserta x tanggal dalam satu bulan (format yyyy-MM). */
function getRekapBulanan(token, kodeBatch, bulan) {
  return jalankan(function () {
    const sesi = requireAuth(token, [PERAN.admin, PERAN.pembimbing]);
    const izinBatch = batchDiizinkan(sesi);
    const bl = /^\d{4}-\d{2}$/.test(String(bulan)) ? String(bulan)
      : formatWaktu(new Date(), 'yyyy-MM');
    const th = Number(bl.split('-')[0]), mn = Number(bl.split('-')[1]);
    const awal = new Date(th, mn - 1, 1);
    const akhir = new Date(th, mn, 0);
    const hariKerja = daftarHariKerja(awal, akhir);
    const fb = String(kodeBatch || '').trim();

    const P = KOL.peserta, A = KOL.absensi;
    const peserta = bacaSheet('peserta');
    const absensi = bacaSheet('absensi');

    const daftar = {};
    for (let i = 1; i < peserta.length; i++) {
      const noReg = String(peserta[i][P.noReg]).trim();
      if (!noReg) continue;
      const kb = String(peserta[i][P.batch]).trim();
      if (fb && kb !== fb) continue;
      if (izinBatch && izinBatch.length && izinBatch.indexOf(kb) === -1) continue;
      const p = bentukPeserta(peserta[i], i + 1);
      const jab = cariJabatan(p.jabatan);
      const un = cariUnit(p.unit);
      daftar[noReg] = {
        noReg: noReg, nama: p.nama, jk: p.jenisKelamin, batch: p.batch,
        institusi: p.institusi, namaJabatan: jab ? jab.nama : p.jabatan,
        namaUnit: un ? un.nama : p.unit, pembimbing: p.pembimbing,
        hari: {}, hadir: 0, terlambat: 0, izin: 0, sakit: 0, dinas: 0, alpa: 0, totalMenit: 0
      };
    }

    const petaTanggal = {};
    hariKerja.forEach(function (h) { petaTanggal[h.tanggal] = true; });

    for (let i = 1; i < absensi.length; i++) {
      if (!absensi[i][A.tanggal]) continue;
      const t = formatWaktu(absensi[i][A.tanggal], 'yyyy-MM-dd');
      if (!petaTanggal[t]) continue;
      const noReg = String(absensi[i][A.noReg]).trim().replace(/^'/, '');
      const d = daftar[noReg];
      if (!d) continue;
      const st = String(absensi[i][A.status]);
      d.hari[t] = st === 'Hadir' ? 'H' : st === 'Terlambat' ? 'T'
                : st === 'Izin' ? 'I' : st === 'Sakit' ? 'S'
                : st === 'Dinas Luar' ? 'D' : 'A';
      if (st === 'Hadir') d.hadir++;
      else if (st === 'Terlambat') d.terlambat++;
      else if (st === 'Izin') d.izin++;
      else if (st === 'Sakit') d.sakit++;
      else if (st === 'Dinas Luar') d.dinas++;
      else if (st === 'Alpa') d.alpa++;
      d.totalMenit += angkaAman(absensi[i][A.durasiMenit]);
    }

    const hasil = Object.keys(daftar).map(function (k) {
      const d = daftar[k];
      const efektif = d.hadir + d.terlambat + d.dinas;
      d.persentase = hariKerja.length > 0 ? Math.round((efektif / hariKerja.length) * 1000) / 10 : 0;
      d.totalJam = Math.round(d.totalMenit / 6) / 10;
      d.keterangan = d.persentase >= ATURAN.ambangKehadiranLulus ? 'Memenuhi' : 'Belum memenuhi';
      return d;
    }).sort(function (a, b) { return String(a.nama).localeCompare(String(b.nama)); });

    // Agregat harian untuk grafik batang
    const agregat = hariKerja.map(function (h) {
      let hadir = 0, terlambat = 0, izin = 0, sakit = 0, alpa = 0;
      hasil.forEach(function (d) {
        const k = d.hari[h.tanggal];
        if (k === 'H') hadir++; else if (k === 'T') terlambat++;
        else if (k === 'I' || k === 'D') izin++; else if (k === 'S') sakit++;
        else if (k === 'A') alpa++;
      });
      return { tanggal: h.tanggal, label: h.tanggal.substring(8), hari: h.hari.substring(0, 3),
               hadir: hadir, terlambat: terlambat, izin: izin, sakit: sakit, alpa: alpa };
    });

    return sukses('', {
      bulan: bl, namaBulan: NAMA_BULAN[mn - 1] + ' ' + th,
      hariKerja: hariKerja, jumlahHariKerja: hariKerja.length,
      data: hasil, agregat: agregat, ambang: ATURAN.ambangKehadiranLulus
    });
  });
}

// ====================================================================
// 20. MANAJEMEN PESERTA
// ====================================================================

function getDaftarPeserta(token, kodeBatch, kataKunci) {
  return jalankan(function () {
    const sesi = requireAuth(token, [PERAN.admin, PERAN.pembimbing]);
    const izinBatch = batchDiizinkan(sesi);
    const P = KOL.peserta;
    const data = bacaSheet('peserta');
    const fb = String(kodeBatch || '').trim();
    const q  = String(kataKunci || '').trim().toLowerCase();
    const hasil = [];

    for (let i = 1; i < data.length; i++) {
      if (!String(data[i][P.noReg]).trim()) continue;
      const kb = String(data[i][P.batch]).trim();
      if (fb && kb !== fb) continue;
      if (izinBatch && izinBatch.length && izinBatch.indexOf(kb) === -1) continue;
      const p = bentukPeserta(data[i], i + 1);
      if (q && [p.nama, p.noRegistrasi, p.nik, p.institusi, p.jurusan]
               .join(' ').toLowerCase().indexOf(q) === -1) continue;
      const jab = cariJabatan(p.jabatan);
      const un  = cariUnit(p.unit);
      hasil.push({
        noRegistrasi: p.noRegistrasi, nama: p.nama, nik: p.nik, jk: p.jenisKelamin,
        tempatLahir: p.tempatLahir,
        tglLahir: p.tglLahir ? formatWaktu(p.tglLahir, 'yyyy-MM-dd') : '',
        email: p.email, noHp: p.noHp, institusi: p.institusi, jurusan: p.jurusan,
        jenjang: p.jenjang, batch: p.batch, unit: p.unit, namaUnit: un ? un.nama : p.unit,
        jabatan: p.jabatan, namaJabatan: jab ? jab.nama : p.jabatan,
        pembimbing: p.pembimbing,
        mulai: p.mulai ? formatWaktu(p.mulai, 'yyyy-MM-dd') : '',
        selesai: p.selesai ? formatWaktu(p.selesai, 'yyyy-MM-dd') : '',
        status: p.status
      });
    }
    return sukses('', { data: hasil, jumlah: hasil.length });
  });
}

function simpanPeserta(token, p, noRegLama) {
  return jalankan(function () {
    const sesi = requireAuth(token, [PERAN.admin]);
    const noReg = String(p.noRegistrasi || '').trim().toUpperCase();
    if (!noReg) return gagal('Nomor registrasi wajib diisi.');
    if (!String(p.nama || '').trim()) return gagal('Nama lengkap wajib diisi.');
    if (p.nik && !/^\d{16}$/.test(String(p.nik).trim())) return gagal('NIK harus 16 digit angka.');
    if (p.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(p.email).trim())) {
      return gagal('Format email tidak valid.');
    }

    const P = KOL.peserta;
    const sheet = ambilSheet('peserta');
    const data = sheet.getDataRange().getValues();
    let barisTarget = 0;
    for (let i = 1; i < data.length; i++) {
      const cur = String(data[i][P.noReg]).trim().toUpperCase();
      if (noRegLama && cur === String(noRegLama).trim().toUpperCase()) { barisTarget = i + 1; continue; }
      if (!noRegLama && cur === noReg) return gagal('Nomor registrasi sudah terdaftar.');
      if (noRegLama && cur === noReg && cur !== String(noRegLama).trim().toUpperCase()) {
        return gagal('Nomor registrasi sudah dipakai peserta lain.');
      }
    }

    const baris = [
      noReg, String(p.nama).trim(), "'" + String(p.nik || ''), String(p.jk || ''),
      String(p.tempatLahir || ''), p.tglLahir || '', String(p.email || ''),
      "'" + String(p.noHp || ''), String(p.institusi || ''), String(p.jurusan || ''),
      String(p.jenjang || ''), String(p.batch || '').trim().toUpperCase(),
      String(p.unit || '').trim().toUpperCase(), String(p.jabatan || '').trim().toUpperCase(),
      String(p.pembimbing || ''), p.mulai || '', p.selesai || '', String(p.status || 'Aktif')
    ];

    if (barisTarget) {
      sheet.getRange(barisTarget, 1, 1, SKEMA.peserta.length).setValues([baris]);
      catatAudit(sesi.identitas, sesi.peran, 'UBAH_PESERTA', noReg);
      return sukses('Data peserta diperbarui.');
    }
    sheet.appendRow(baris);
    catatAudit(sesi.identitas, sesi.peran, 'TAMBAH_PESERTA', noReg);
    return sukses('Peserta ditambahkan.');
  });
}

function tambahPeserta(token, p) { return simpanPeserta(token, p, null); }

function hapusPeserta(token, noRegistrasi) {
  return jalankan(function () {
    const sesi = requireAuth(token, [PERAN.admin]);
    const P = KOL.peserta;
    const sheet = ambilSheet('peserta');
    const data = sheet.getDataRange().getValues();
    for (let i = data.length - 1; i >= 1; i--) {
      if (String(data[i][P.noReg]).trim().toUpperCase() !== String(noRegistrasi).trim().toUpperCase()) continue;
      sheet.deleteRow(i + 1);
      catatAudit(sesi.identitas, sesi.peran, 'HAPUS_PESERTA', String(noRegistrasi));
      return sukses('Peserta dihapus. Riwayat absensi tetap tersimpan sebagai arsip.');
    }
    return gagal('Peserta tidak ditemukan.');
  });
}

function getKolomImpor() {
  return SKEMA.peserta;
}

/** Impor massal dari Excel/CSV yang sudah dibaca di sisi klien. */
function imporPesertaMassal(token, barisData) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return gagal('Sistem sibuk, coba lagi.');
  try {
    const sesi = requireAuth(token, [PERAN.admin]);
    if (!barisData || !barisData.length) return gagal('Tidak ada data untuk diimpor.');

    const P = KOL.peserta;
    const sheet = ambilSheet('peserta');
    const ada = sheet.getDataRange().getValues();
    const terdaftar = {};
    for (let i = 1; i < ada.length; i++) {
      terdaftar[String(ada[i][P.noReg]).trim().toUpperCase()] = true;
    }

    const masuk = [], masalah = [];
    barisData.forEach(function (b, idx) {
      const noReg = String(b.noRegistrasi || b[0] || '').trim().toUpperCase();
      const nama  = String(b.nama || b[1] || '').trim();
      if (!noReg || !nama) { masalah.push('Baris ' + (idx + 2) + ': nomor registrasi/nama kosong.'); return; }
      if (terdaftar[noReg]) { masalah.push('Baris ' + (idx + 2) + ': ' + noReg + ' sudah terdaftar.'); return; }
      const nik = String(b.nik || '').trim();
      if (nik && !/^\d{16}$/.test(nik)) { masalah.push('Baris ' + (idx + 2) + ': NIK ' + noReg + ' bukan 16 digit.'); return; }
      terdaftar[noReg] = true;
      masuk.push([
        noReg, nama, "'" + nik, String(b.jk || ''), String(b.tempatLahir || ''),
        b.tglLahir || '', String(b.email || ''), "'" + String(b.noHp || ''),
        String(b.institusi || ''), String(b.jurusan || ''), String(b.jenjang || ''),
        String(b.batch || '').trim().toUpperCase(), String(b.unit || '').trim().toUpperCase(),
        String(b.jabatan || '').trim().toUpperCase(), String(b.pembimbing || ''),
        b.mulai || '', b.selesai || '', String(b.status || 'Aktif')
      ]);
    });

    if (masuk.length) {
      sheet.getRange(sheet.getLastRow() + 1, 1, masuk.length, SKEMA.peserta.length).setValues(masuk);
    }
    catatAudit(sesi.identitas, sesi.peran, 'IMPOR_PESERTA',
               masuk.length + ' berhasil, ' + masalah.length + ' gagal');
    return sukses(masuk.length + ' peserta berhasil diimpor.' +
                  (masalah.length ? ' ' + masalah.length + ' baris dilewati.' : ''),
                  { berhasil: masuk.length, gagal: masalah.length, masalah: masalah.slice(0, 30) });
  } catch (err) {
    return gagal(err.message);
  } finally {
    lock.releaseLock();
  }
}

// ====================================================================
// 21. MANAJEMEN BATCH MAGANG
// ====================================================================

function simpanBatch(token, b, kodeLama) {
  return jalankan(function () {
    const sesi = requireAuth(token, [PERAN.admin]);
    const kode = String(b.kode || '').trim().toUpperCase();
    if (!kode) return gagal('Kode batch wajib diisi.');
    if (!String(b.nama || '').trim()) return gagal('Nama batch wajib diisi.');
    if (!String(b.unit || '').trim()) return gagal('Unit penempatan wajib dipilih.');

    const K = KOL.batch;
    const sheet = ambilSheet('batch');
    const data = sheet.getDataRange().getValues();
    let barisTarget = 0;
    for (let i = 1; i < data.length; i++) {
      const cur = String(data[i][K.kode]).trim().toUpperCase();
      if (kodeLama && cur === String(kodeLama).trim().toUpperCase()) { barisTarget = i + 1; continue; }
      if (cur === kode && (!kodeLama || cur !== String(kodeLama).trim().toUpperCase())) {
        return gagal('Kode batch sudah digunakan.');
      }
    }

    // Hitung total hari kerja otomatis bila tanggal lengkap
    let totalHari = angkaAman(b.totalHari);
    if (b.mulai && b.selesai) {
      const n = daftarHariKerja(new Date(b.mulai), new Date(b.selesai)).length;
      if (n > 0) totalHari = n;
    }

    const baris = [
      kode, String(b.nama).trim(), String(b.angkatan || ''), b.mulai || '', b.selesai || '',
      totalHari, String(b.unit).trim().toUpperCase(), String(b.status || 'Aktif'),
      String(b.penanggungJawab || ''), String(b.keterangan || '')
    ];

    if (barisTarget) {
      sheet.getRange(barisTarget, 1, 1, SKEMA.batch.length).setValues([baris]);
      catatAudit(sesi.identitas, sesi.peran, 'UBAH_BATCH', kode);
      return sukses('Batch diperbarui. Total hari kerja: ' + totalHari + ' hari.');
    }
    sheet.appendRow(baris);
    catatAudit(sesi.identitas, sesi.peran, 'TAMBAH_BATCH', kode);
    return sukses('Batch ditambahkan. Total hari kerja: ' + totalHari + ' hari.');
  });
}

function hapusBatch(token, kode) {
  return jalankan(function () {
    const sesi = requireAuth(token, [PERAN.admin]);
    const P = KOL.peserta;
    const peserta = bacaSheet('peserta');
    for (let i = 1; i < peserta.length; i++) {
      if (String(peserta[i][P.batch]).trim().toUpperCase() === String(kode).trim().toUpperCase()) {
        return gagal('Batch masih memiliki peserta. Pindahkan atau hapus peserta terlebih dahulu.');
      }
    }
    const K = KOL.batch;
    const sheet = ambilSheet('batch');
    const data = sheet.getDataRange().getValues();
    for (let i = data.length - 1; i >= 1; i--) {
      if (String(data[i][K.kode]).trim().toUpperCase() !== String(kode).trim().toUpperCase()) continue;
      sheet.deleteRow(i + 1);
      catatAudit(sesi.identitas, sesi.peran, 'HAPUS_BATCH', String(kode));
      return sukses('Batch dihapus.');
    }
    return gagal('Batch tidak ditemukan.');
  });
}

// ====================================================================
// 22. MANAJEMEN UNIT PENEMPATAN & TITIK KOORDINAT
// ====================================================================

function getDaftarUnit(token) {
  return jalankan(function () {
    requireAuth(token);
    const K = KOL.unit;
    const data = bacaSheet('unit');
    const hasil = [];
    for (let i = 1; i < data.length; i++) {
      if (!String(data[i][K.id]).trim()) continue;
      hasil.push({
        id: String(data[i][K.id]).trim(), nama: String(data[i][K.nama]),
        lat: angkaAman(data[i][K.lat]), lng: angkaAman(data[i][K.lng]),
        radius: angkaAman(data[i][K.radius]), alamat: String(data[i][K.alamat] || ''),
        penanggungJawab: String(data[i][K.penanggungJawab] || '')
      });
    }
    return sukses('', { data: hasil });
  });
}

function simpanUnit(token, u) {
  return jalankan(function () {
    const sesi = requireAuth(token, [PERAN.admin]);
    const id = String(u.id || '').trim().toUpperCase();
    if (!id) return gagal('ID unit wajib diisi.');
    if (!String(u.nama || '').trim()) return gagal('Nama unit wajib diisi.');
    const lat = Number(u.lat), lng = Number(u.lng), radius = Number(u.radius);
    if (isNaN(lat) || lat < -90 || lat > 90)    return gagal('Latitude harus antara -90 dan 90.');
    if (isNaN(lng) || lng < -180 || lng > 180)  return gagal('Longitude harus antara -180 dan 180.');
    if (isNaN(radius) || radius < 20 || radius > 5000) {
      return gagal('Radius geofence harus antara 20 dan 5000 meter.');
    }

    const K = KOL.unit;
    const sheet = ambilSheet('unit');
    const data = sheet.getDataRange().getValues();
    const baris = [id, String(u.nama).trim(), lat, lng, radius,
                   String(u.alamat || ''), String(u.penanggungJawab || '')];
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][K.id]).trim().toUpperCase() !== id) continue;
      sheet.getRange(i + 1, 1, 1, SKEMA.unit.length).setValues([baris]);
      catatAudit(sesi.identitas, sesi.peran, 'UBAH_UNIT', id);
      return sukses('Unit penempatan diperbarui.');
    }
    sheet.appendRow(baris);
    catatAudit(sesi.identitas, sesi.peran, 'TAMBAH_UNIT', id);
    return sukses('Unit penempatan ditambahkan.');
  });
}

function hapusUnit(token, id) {
  return jalankan(function () {
    const sesi = requireAuth(token, [PERAN.admin]);
    const B = KOL.batch;
    const batch = bacaSheet('batch');
    for (let i = 1; i < batch.length; i++) {
      if (String(batch[i][B.unit]).trim().toUpperCase() === String(id).trim().toUpperCase()) {
        return gagal('Unit masih dipakai batch ' + batch[i][B.kode] + '.');
      }
    }
    const K = KOL.unit;
    const sheet = ambilSheet('unit');
    const data = sheet.getDataRange().getValues();
    for (let i = data.length - 1; i >= 1; i--) {
      if (String(data[i][K.id]).trim().toUpperCase() !== String(id).trim().toUpperCase()) continue;
      sheet.deleteRow(i + 1);
      catatAudit(sesi.identitas, sesi.peran, 'HAPUS_UNIT', String(id));
      return sukses('Unit penempatan dihapus.');
    }
    return gagal('Unit tidak ditemukan.');
  });
}

// ====================================================================
// 23. MANAJEMEN JABATAN
// ====================================================================

function getDaftarJabatan(token) {
  return jalankan(function () {
    requireAuth(token);
    const K = KOL.jabatan;
    const data = bacaSheet('jabatan');
    const P = KOL.peserta;
    const peserta = bacaSheet('peserta');

    const terisi = {};
    for (let i = 1; i < peserta.length; i++) {
      const j = String(peserta[i][P.jabatan] || '').trim().toUpperCase();
      if (!j) continue;
      if (String(peserta[i][P.status] || 'Aktif') !== 'Aktif') continue;
      terisi[j] = (terisi[j] || 0) + 1;
    }

    const hasil = [];
    for (let i = 1; i < data.length; i++) {
      if (!String(data[i][K.kode]).trim()) continue;
      const kode = String(data[i][K.kode]).trim().toUpperCase();
      const unit = cariUnit(data[i][K.unit]);
      const kuota = angkaAman(data[i][K.kuota]);
      hasil.push({
        kode: kode, nama: String(data[i][K.nama]), unit: String(data[i][K.unit] || ''),
        namaUnit: unit ? unit.nama : String(data[i][K.unit] || '-'),
        bidang: String(data[i][K.bidang] || ''), uraian: String(data[i][K.uraian] || ''),
        kuota: kuota, terisi: terisi[kode] || 0,
        sisa: kuota > 0 ? Math.max(0, kuota - (terisi[kode] || 0)) : '-'
      });
    }
    return sukses('', { data: hasil });
  });
}

function simpanJabatan(token, j, kodeLama) {
  return jalankan(function () {
    const sesi = requireAuth(token, [PERAN.admin]);
    const kode = String(j.kode || '').trim().toUpperCase();
    if (!kode) return gagal('Kode jabatan wajib diisi.');
    if (!String(j.nama || '').trim()) return gagal('Nama jabatan wajib diisi.');

    const K = KOL.jabatan;
    const sheet = ambilSheet('jabatan');
    const data = sheet.getDataRange().getValues();
    let barisTarget = 0;
    for (let i = 1; i < data.length; i++) {
      const cur = String(data[i][K.kode]).trim().toUpperCase();
      if (kodeLama && cur === String(kodeLama).trim().toUpperCase()) { barisTarget = i + 1; continue; }
      if (cur === kode && (!kodeLama || cur !== String(kodeLama).trim().toUpperCase())) {
        return gagal('Kode jabatan sudah digunakan.');
      }
    }
    const baris = [kode, String(j.nama).trim(), String(j.unit || '').trim().toUpperCase(),
                   String(j.bidang || ''), String(j.uraian || ''), angkaAman(j.kuota)];
    if (barisTarget) {
      sheet.getRange(barisTarget, 1, 1, SKEMA.jabatan.length).setValues([baris]);
      catatAudit(sesi.identitas, sesi.peran, 'UBAH_JABATAN', kode);
      return sukses('Jabatan diperbarui.');
    }
    sheet.appendRow(baris);
    catatAudit(sesi.identitas, sesi.peran, 'TAMBAH_JABATAN', kode);
    return sukses('Jabatan ditambahkan.');
  });
}

function hapusJabatan(token, kode) {
  return jalankan(function () {
    const sesi = requireAuth(token, [PERAN.admin]);
    const P = KOL.peserta;
    const peserta = bacaSheet('peserta');
    for (let i = 1; i < peserta.length; i++) {
      if (String(peserta[i][P.jabatan]).trim().toUpperCase() === String(kode).trim().toUpperCase()) {
        return gagal('Jabatan masih dipakai peserta ' + peserta[i][P.nama] + '.');
      }
    }
    const K = KOL.jabatan;
    const sheet = ambilSheet('jabatan');
    const data = sheet.getDataRange().getValues();
    for (let i = data.length - 1; i >= 1; i--) {
      if (String(data[i][K.kode]).trim().toUpperCase() !== String(kode).trim().toUpperCase()) continue;
      sheet.deleteRow(i + 1);
      catatAudit(sesi.identitas, sesi.peran, 'HAPUS_JABATAN', String(kode));
      return sukses('Jabatan dihapus.');
    }
    return gagal('Jabatan tidak ditemukan.');
  });
}

// ====================================================================
// 24. MANAJEMEN PENGGUNA
// ====================================================================

function getDaftarPengguna(token) {
  return jalankan(function () {
    requireAuth(token, [PERAN.admin]);
    const U = KOL.users;
    const data = bacaSheet('users');
    const hasil = [];
    for (let i = 1; i < data.length; i++) {
      if (!String(data[i][U.username]).trim()) continue;
      hasil.push({
        username: String(data[i][U.username]).trim(), peran: String(data[i][U.peran]),
        nama: String(data[i][U.nama]), nip: String(data[i][U.nip] || ''),
        jabatan: String(data[i][U.jabatan] || ''), unit: String(data[i][U.unit] || ''),
        batch: String(data[i][U.batch] || ''), aktif: String(data[i][U.aktif] || 'Ya'),
        terakhirMasuk: String(data[i][U.terakhirMasuk] || '-')
      });
    }
    return sukses('', { data: hasil });
  });
}

function simpanPengguna(token, u) {
  return jalankan(function () {
    const sesi = requireAuth(token, [PERAN.admin]);
    const username = String(u.username || '').trim();
    if (!/^[a-zA-Z0-9._-]{4,30}$/.test(username)) {
      return gagal('Username 4–30 karakter, hanya huruf, angka, titik, garis bawah, atau strip.');
    }
    if ([PERAN.admin, PERAN.pembimbing].indexOf(String(u.peran)) === -1) {
      return gagal('Peran harus admin atau pembimbing.');
    }
    if (!String(u.nama || '').trim()) return gagal('Nama lengkap wajib diisi.');

    const U = KOL.users;
    const sheet = ambilSheet('users');
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][U.username]).trim() !== username) continue;
      // Perbarui data (tanpa mengubah sandi)
      sheet.getRange(i + 1, U.peran + 1, 1, 7).setValues([[
        String(u.peran), String(u.nama).trim(), String(u.nip || ''),
        String(u.jabatan || ''), String(u.unit || '').trim().toUpperCase(),
        String(u.batch || '').trim().toUpperCase(), u.aktif === false ? 'Tidak' : 'Ya'
      ]]);
      catatAudit(sesi.identitas, sesi.peran, 'UBAH_PENGGUNA', username);
      return sukses('Data pengguna diperbarui.');
    }

    if (String(u.password || '').length < ATURAN.panjangSandiMinimal) {
      return gagal('Kata sandi awal minimal ' + ATURAN.panjangSandiMinimal + ' karakter.');
    }
    const salt = buatSalt();
    sheet.appendRow([
      username, salt, hashPassword(u.password, salt), String(u.peran),
      String(u.nama).trim(), String(u.nip || ''), String(u.jabatan || ''),
      String(u.unit || '').trim().toUpperCase(), String(u.batch || '').trim().toUpperCase(),
      u.aktif === false ? 'Tidak' : 'Ya', ''
    ]);
    catatAudit(sesi.identitas, sesi.peran, 'TAMBAH_PENGGUNA', username + ' (' + u.peran + ')');
    return sukses('Pengguna ditambahkan.');
  });
}

function resetPasswordPengguna(token, username, passwordBaru) {
  return jalankan(function () {
    const sesi = requireAuth(token, [PERAN.admin]);
    if (String(passwordBaru || '').length < ATURAN.panjangSandiMinimal) {
      return gagal('Kata sandi minimal ' + ATURAN.panjangSandiMinimal + ' karakter.');
    }
    const U = KOL.users;
    const sheet = ambilSheet('users');
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][U.username]).trim() !== String(username).trim()) continue;
      const salt = buatSalt();
      sheet.getRange(i + 1, U.salt + 1, 1, 2).setValues([[salt, hashPassword(passwordBaru, salt)]]);
      catatAudit(sesi.identitas, sesi.peran, 'RESET_SANDI', String(username));
      return sukses('Kata sandi pengguna direset.');
    }
    return gagal('Pengguna tidak ditemukan.');
  });
}

function hapusPengguna(token, username) {
  return jalankan(function () {
    const sesi = requireAuth(token, [PERAN.admin]);
    if (String(username).trim() === sesi.identitas) return gagal('Anda tidak dapat menghapus akun sendiri.');

    const U = KOL.users;
    const sheet = ambilSheet('users');
    const data = sheet.getDataRange().getValues();
    let jumlahAdmin = 0;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][U.peran]) === PERAN.admin && String(data[i][U.aktif] || 'Ya') === 'Ya') jumlahAdmin++;
    }
    for (let i = data.length - 1; i >= 1; i--) {
      if (String(data[i][U.username]).trim() !== String(username).trim()) continue;
      if (String(data[i][U.peran]) === PERAN.admin && jumlahAdmin <= 1) {
        return gagal('Tidak dapat menghapus admin terakhir.');
      }
      sheet.deleteRow(i + 1);
      catatAudit(sesi.identitas, sesi.peran, 'HAPUS_PENGGUNA', String(username));
      return sukses('Pengguna dihapus.');
    }
    return gagal('Pengguna tidak ditemukan.');
  });
}

// ====================================================================
// 25. KONFIGURASI DOKUMEN (KOP SURAT / TANDA TANGAN)
// ====================================================================

const KONFIG_BAWAAN = [
  ['kementerian', INSTANSI.kementerian, 'Baris 1 kop surat'],
  ['balai', INSTANSI.balai, 'Baris 2 kop surat'],
  ['satpel', INSTANSI.satpel, 'Baris 3 kop surat'],
  ['alamat', INSTANSI.alamat, 'Alamat kantor'],
  ['kontak', INSTANSI.kontak, 'Telepon dan surel'],
  ['logoUrl', '', 'URL logo Kemnaker (opsional, gambar publik)'],
  ['kotaTtd', 'Mamuju', 'Kota penandatangan'],
  ['jabatanTtd', 'Koordinator Satuan Pelayanan PVP Mamuju', 'Jabatan penandatangan'],
  ['namaTtd', '..............................', 'Nama penandatangan'],
  ['nipTtd', 'NIP. ..........................', 'NIP penandatangan'],
  ['namaProgram', INSTANSI.program, 'Nama program pada judul laporan']
];

function setupDokumen() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName('konfigurasi');
  if (!sheet) sheet = ss.insertSheet('konfigurasi');
  sheet.clear();
  sheet.getRange(1, 1, 1, 3).setValues([SKEMA.konfigurasi]).setFontWeight('bold');
  sheet.getRange(2, 1, KONFIG_BAWAAN.length, 3).setValues(KONFIG_BAWAAN);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 3);
  Logger.log('Sheet konfigurasi siap.');
}

function getKonfigurasiDokumen() {
  const hasil = {};
  KONFIG_BAWAAN.forEach(function (b) { hasil[b[0]] = b[1]; });
  try {
    const data = bacaSheet('konfigurasi');
    for (let i = 1; i < data.length; i++) {
      if (!data[i][0]) continue;
      hasil[String(data[i][0]).trim()] = String(data[i][1] || '');
    }
  } catch (e) { /* pakai bawaan */ }
  return hasil;
}

function getKonfigurasi(token) {
  return jalankan(function () {
    requireAuth(token, [PERAN.admin]);
    return sukses('', { konfigurasi: getKonfigurasiDokumen(), keterangan: KONFIG_BAWAAN });
  });
}

function simpanKonfigurasi(token, pasangan) {
  return jalankan(function () {
    const sesi = requireAuth(token, [PERAN.admin]);
    const sheet = ambilSheet('konfigurasi');
    const data = sheet.getDataRange().getValues();
    Object.keys(pasangan || {}).forEach(function (k) {
      let ketemu = false;
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]).trim() !== k) continue;
        sheet.getRange(i + 1, 2).setValue(String(pasangan[k]));
        ketemu = true; break;
      }
      if (!ketemu) sheet.appendRow([k, String(pasangan[k]), '']);
    });
    catatAudit(sesi.identitas, sesi.peran, 'UBAH_KONFIGURASI', Object.keys(pasangan || {}).join(', '));
    return sukses('Konfigurasi dokumen tersimpan.');
  });
}

// ====================================================================
// 26. SETUP SISTEM
// ====================================================================

function setupSistem() {
  const ss = getSpreadsheet();
  URUTAN_SHEET.forEach(function (nama) {
    let sheet = ss.getSheetByName(nama);
    if (!sheet) sheet = ss.insertSheet(nama);
    const kolom = SKEMA[nama];
    if (!kolom) return;
    sheet.getRange(1, 1, 1, kolom.length).setValues([kolom])
      .setFontWeight('bold').setBackground('#1e3a8a').setFontColor('#ffffff');
    sheet.setFrozenRows(1);
    if (sheet.getMaxColumns() > kolom.length) {
      sheet.deleteColumns(kolom.length + 1, sheet.getMaxColumns() - kolom.length);
    }
  });

  // Jam kerja 5 hari: Senin–Kamis 07.30–16.00, Jumat 07.30–16.30
  const jk = ambilSheet('jam_kerja');
  if (jk.getLastRow() < 2) {
    jk.getRange(2, 1, 7, SKEMA.jam_kerja.length).setValues([
      [0, 'Minggu', 'Tidak', '',      '',      '',            'Hari libur akhir pekan'],
      [1, 'Senin',  'Ya',    '07:30', '16:00', '12:00-13:00', 'Hari kerja'],
      [2, 'Selasa', 'Ya',    '07:30', '16:00', '12:00-13:00', 'Hari kerja'],
      [3, 'Rabu',   'Ya',    '07:30', '16:00', '12:00-13:00', 'Hari kerja'],
      [4, 'Kamis',  'Ya',    '07:30', '16:00', '12:00-13:00', 'Hari kerja'],
      [5, 'Jumat',  'Ya',    '07:30', '16:30', '11:30-13:00', 'Hari kerja, istirahat Jumat lebih panjang'],
      [6, 'Sabtu',  'Tidak', '',      '',      '',            'Hari libur akhir pekan']
    ]);
  }

  setupDokumen();

  const abs = ambilSheet('absensi');
  abs.setColumnWidth(KOL.absensi.foto + 1, 220);
  Logger.log('setupSistem() selesai. Lanjutkan dengan buatAdminPertama().');
}

/** Data simulasi untuk uji coba. Hapus isinya sebelum dipakai produksi. */
function isiDataContoh() {
  const unit = ambilSheet('unit');
  if (unit.getLastRow() < 2) {
    unit.getRange(2, 1, 3, SKEMA.unit.length).setValues([
      ['UNIT-01', 'Kantor Satpel PVP Mamuju', -2.6748, 118.8885, 150,
       'Jalan Poros Mamuju – Kalukku KM 12, Mamuju', 'Koordinator Satpel'],
      ['UNIT-02', 'Workshop Teknik Las & Fabrikasi', -2.6752, 118.8891, 100,
       'Kompleks Satpel PVP Mamuju', 'Instruktur Las'],
      ['UNIT-03', 'Ruang Layanan Administrasi', -2.6745, 118.8880, 80,
       'Gedung Utama Satpel PVP Mamuju', 'Kasubbag TU']
    ]);
  }

  const jab = ambilSheet('jabatan');
  if (jab.getLastRow() < 2) {
    jab.getRange(2, 1, 6, SKEMA.jabatan.length).setValues([
      ['JB-ADM', 'Staf Administrasi Pelatihan', 'UNIT-03', 'Tata Usaha',
       'Membantu pengarsipan, surat menyurat, dan entri data pelatihan', 10],
      ['JB-OPR', 'Operator Sistem Informasi', 'UNIT-01', 'Data & Informasi',
       'Membantu pengelolaan data SIAPkerja dan pelaporan', 6],
      ['JB-LAS', 'Asisten Instruktur Las', 'UNIT-02', 'Kejuruan Teknik Las',
       'Membantu persiapan bahan, alat, dan pendampingan praktik', 8],
      ['JB-LIS', 'Asisten Instruktur Listrik', 'UNIT-02', 'Kejuruan Teknik Listrik',
       'Membantu praktik instalasi listrik dan perawatan alat', 8],
      ['JB-HUM', 'Staf Humas & Publikasi', 'UNIT-01', 'Humas',
       'Membantu dokumentasi kegiatan dan pengelolaan media sosial', 4],
      ['JB-SAR', 'Staf Sarana & Prasarana', 'UNIT-01', 'Umum',
       'Membantu inventarisasi dan perawatan sarana pelatihan', 4]
    ]);
  }

  const batch = ambilSheet('batch');
  if (batch.getLastRow() < 2) {
    batch.getRange(2, 1, 2, SKEMA.batch.length).setValues([
      ['MN-2026-01', 'Magang Nasional Angkatan I Tahun 2026', 'I/2026',
       '2026-02-02', '2026-07-31', 130, 'UNIT-01', 'Aktif',
       'Koordinator Satpel PVP Mamuju', 'Magang 6 bulan, 5 hari kerja'],
      ['MN-2026-02', 'Magang Nasional Angkatan II Tahun 2026', 'II/2026',
       '2026-08-03', '2027-01-29', 128, 'UNIT-01', 'Aktif',
       'Koordinator Satpel PVP Mamuju', 'Magang 6 bulan, 5 hari kerja']
    ]);
  }
  Logger.log('Data contoh unit, jabatan, dan batch dimuat.');
}

// ====================================================================
// 27. EKSPOR — UTILITAS BERKAS
// ====================================================================

function ambilFolderEkspor() {
  const induk = DriveApp.getFolderById(DRIVE_FOLDER_ID);
  return ambilAtauBuatFolder(induk, 'Laporan e-Magang');
}

/** Ubah spreadsheet sementara menjadi berkas .xlsx di folder laporan. */
function spreadsheetKeExcel(ssTemp, namaBerkas) {
  const url = 'https://docs.google.com/spreadsheets/d/' + ssTemp.getId() + '/export?format=xlsx';
  const respons = UrlFetchApp.fetch(url, {
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true
  });
  const blob = respons.getBlob().setName(namaBerkas + '.xlsx');
  const berkas = ambilFolderEkspor().createFile(blob);
  DriveApp.getFileById(ssTemp.getId()).setTrashed(true);
  return { nama: berkas.getName(), url: berkas.getUrl(), id: berkas.getId() };
}

function buatSpreadsheetSementara(judul) {
  return SpreadsheetApp.create('TMP_' + judul + '_' + formatWaktu(new Date(), 'yyyyMMddHHmmss'));
}

function gayaKepalaSheet(sheet, jumlahKolom, barisJudul) {
  sheet.getRange(barisJudul, 1, 1, jumlahKolom)
    .setFontWeight('bold').setBackground('#1e3a8a').setFontColor('#ffffff')
    .setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true);
  sheet.setFrozenRows(barisJudul);
}

function tulisKopExcel(sheet, konfig, judul, subjudul, jumlahKolom) {
  const baris = [
    [konfig.kementerian], [konfig.balai], [konfig.satpel], [konfig.alamat],
    [''], [judul], [subjudul], ['']
  ];
  sheet.getRange(1, 1, baris.length, 1).setValues(baris);
  for (let i = 1; i <= baris.length; i++) {
    sheet.getRange(i, 1, 1, jumlahKolom).merge().setHorizontalAlignment('center');
  }
  sheet.getRange(1, 1, 4, 1).setFontWeight('bold');
  sheet.getRange(3, 1).setFontSize(12);
  sheet.getRange(6, 1).setFontWeight('bold').setFontSize(14);
  sheet.getRange(7, 1).setFontSize(11);
  return baris.length + 1;   // baris pertama untuk header tabel
}

function tulisTtdExcel(sheet, konfig, barisMulai, kolomTtd) {
  const tgl = konfig.kotaTtd + ', ' + tanggalIndonesia(new Date());
  sheet.getRange(barisMulai, kolomTtd).setValue(tgl);
  sheet.getRange(barisMulai + 1, kolomTtd).setValue(konfig.jabatanTtd);
  sheet.getRange(barisMulai + 5, kolomTtd).setValue(konfig.namaTtd).setFontWeight('bold');
  sheet.getRange(barisMulai + 6, kolomTtd).setValue(konfig.nipTtd);
}

// ====================================================================
// 28. EKSPOR EXCEL — REKAP HARIAN
// ====================================================================

function eksporRekapHarianExcel(token, kodeBatch, tanggal) {
  return jalankan(function () {
    const sesi = requireAuth(token, [PERAN.admin, PERAN.pembimbing]);
    const hasil = getStatistikHarian(token, kodeBatch, tanggal);
    if (!hasil.sukses) return hasil;
    const konfig = getKonfigurasiDokumen();
    const batch = kodeBatch ? cariBatch(kodeBatch) : null;

    const ss = buatSpreadsheetSementara('RekapHarian');
    const sheet = ss.getSheets()[0].setName('Rekap Harian');
    const judul = ['No','No Registrasi','Nama Peserta','Asal Institusi','Jabatan/Posisi',
                   'Jam Masuk','Jam Pulang','Durasi (menit)','Status','Jarak (m)','Keterangan'];

    const barisHeader = tulisKopExcel(sheet, konfig,
      'DAFTAR HADIR HARIAN ' + konfig.namaProgram.toUpperCase(),
      (batch ? batch.nama + ' — ' : '') + hasil.tanggalIndo, judul.length);

    sheet.getRange(barisHeader, 1, 1, judul.length).setValues([judul]);
    gayaKepalaSheet(sheet, judul.length, barisHeader);

    const isi = hasil.rincian.map(function (r, i) {
      return [i + 1, r.noReg, r.nama, r.institusi, r.jabatan, r.jamMasuk, r.jamPulang,
              r.durasi || '', r.status, r.jarak || '', r.keterangan];
    });
    hasil.belumAbsen.forEach(function (b, i) {
      isi.push([isi.length + 1, b.noReg, b.nama, b.institusi, b.jabatan, '-', '-', '',
                'Belum Absen', '', 'Belum melakukan absensi']);
    });
    if (isi.length) {
      sheet.getRange(barisHeader + 1, 1, isi.length, judul.length).setValues(isi);
    }

    const barisRingkas = barisHeader + isi.length + 2;
    sheet.getRange(barisRingkas, 1).setValue('REKAPITULASI').setFontWeight('bold');
    const r = hasil.ringkasan;
    sheet.getRange(barisRingkas + 1, 1, 8, 2).setValues([
      ['Jumlah peserta aktif', r.totalPeserta],
      ['Hadir tepat waktu', r.hadir],
      ['Terlambat', r.terlambat],
      ['Izin', r.izin],
      ['Sakit', r.sakit],
      ['Dinas luar', r.dinas],
      ['Alpa / belum absen', r.alpa + r.belumAbsen],
      ['Persentase kehadiran', r.persenKehadiran + '%']
    ]);

    tulisTtdExcel(sheet, konfig, barisRingkas, judul.length - 2);
    sheet.autoResizeColumns(1, judul.length);
    SpreadsheetApp.flush();

    const berkas = spreadsheetKeExcel(ss, 'Rekap_Harian_' +
      bersihkanNamaBerkas(kodeBatch || 'SEMUA') + '_' + hasil.tanggal);
    catatAudit(sesi.identitas, sesi.peran, 'EKSPOR_HARIAN_XLSX', berkas.nama);
    return sukses('Berkas Excel siap diunduh.', { berkas: berkas });
  });
}

// ====================================================================
// 29. EKSPOR EXCEL — REKAP MINGGUAN
// ====================================================================

function eksporRekapMingguanExcel(token, kodeBatch, tanggalAcuan) {
  return jalankan(function () {
    const sesi = requireAuth(token, [PERAN.admin, PERAN.pembimbing]);
    const hasil = getRekapMingguan(token, kodeBatch, tanggalAcuan);
    if (!hasil.sukses) return hasil;
    const konfig = getKonfigurasiDokumen();
    const batch = kodeBatch ? cariBatch(kodeBatch) : null;

    const ss = buatSpreadsheetSementara('RekapMingguan');
    const sheet = ss.getSheets()[0].setName('Rekap Mingguan');

    const judul = ['No','No Registrasi','Nama Peserta','Jabatan/Posisi']
      .concat(hasil.hariKerja.map(function (h) { return h.hari.substring(0,3) + ' ' + h.tanggal.substring(8); }))
      .concat(['H','T','I/D','S','A','Total Jam','%']);

    const barisHeader = tulisKopExcel(sheet, konfig,
      'REKAPITULASI KEHADIRAN MINGGUAN ' + konfig.namaProgram.toUpperCase(),
      (batch ? batch.nama + ' — ' : '') + hasil.periode.label + ' (' + hasil.periode.rentangIndo + ')',
      judul.length);

    sheet.getRange(barisHeader, 1, 1, judul.length).setValues([judul]);
    gayaKepalaSheet(sheet, judul.length, barisHeader);

    const isi = hasil.data.map(function (d, i) {
      const kolomHari = hasil.hariKerja.map(function (h) { return d.hari[h.tanggal] || '-'; });
      return [i + 1, d.noReg, d.nama, d.namaJabatan].concat(kolomHari)
        .concat([d.hadir, d.terlambat, d.izin, d.sakit, d.alpa, d.totalJam, d.persentase + '%']);
    });
    if (isi.length) {
      sheet.getRange(barisHeader + 1, 1, isi.length, judul.length).setValues(isi);
      sheet.getRange(barisHeader + 1, 5, isi.length, hasil.hariKerja.length)
           .setHorizontalAlignment('center');
    }

    const barisKet = barisHeader + isi.length + 2;
    sheet.getRange(barisKet, 1).setValue(
      'Keterangan: H = Hadir | T = Terlambat | I = Izin | D = Dinas Luar | S = Sakit | A = Alpa | - = Belum tercatat'
    ).setFontStyle('italic');
    sheet.getRange(barisKet + 1, 1).setValue(
      'Jumlah hari kerja pada minggu ini: ' + hasil.hariKerja.length + ' hari (pola 5 hari kerja Senin–Jumat).'
    );

    tulisTtdExcel(sheet, konfig, barisKet + 3, Math.max(1, judul.length - 3));
    sheet.autoResizeColumns(1, judul.length);
    SpreadsheetApp.flush();

    const berkas = spreadsheetKeExcel(ss, 'Rekap_Mingguan_' +
      bersihkanNamaBerkas(kodeBatch || 'SEMUA') + '_' + hasil.periode.dari);
    catatAudit(sesi.identitas, sesi.peran, 'EKSPOR_MINGGUAN_XLSX', berkas.nama);
    return sukses('Berkas Excel siap diunduh.', { berkas: berkas });
  });
}

// ====================================================================
// 30. EKSPOR EXCEL — REKAP BULANAN
// ====================================================================

function eksporRekapBulananExcel(token, kodeBatch, bulan) {
  return jalankan(function () {
    const sesi = requireAuth(token, [PERAN.admin, PERAN.pembimbing]);
    const hasil = getRekapBulanan(token, kodeBatch, bulan);
    if (!hasil.sukses) return hasil;
    const konfig = getKonfigurasiDokumen();
    const batch = kodeBatch ? cariBatch(kodeBatch) : null;

    const ss = buatSpreadsheetSementara('RekapBulanan');
    const sheet = ss.getSheets()[0].setName('Rekap Bulanan');

    const judul = ['No','No Registrasi','Nama Peserta','L/P','Asal Institusi','Jabatan/Posisi']
      .concat(hasil.hariKerja.map(function (h) { return h.tanggal.substring(8); }))
      .concat(['H','T','I','S','D','A','Total Jam','% Hadir','Keterangan']);

    const barisHeader = tulisKopExcel(sheet, konfig,
      'REKAPITULASI KEHADIRAN BULANAN ' + konfig.namaProgram.toUpperCase(),
      (batch ? batch.nama + ' — ' : '') + 'Bulan ' + hasil.namaBulan +
      ' (' + hasil.jumlahHariKerja + ' hari kerja)', judul.length);

    sheet.getRange(barisHeader, 1, 1, judul.length).setValues([judul]);
    gayaKepalaSheet(sheet, judul.length, barisHeader);

    const isi = hasil.data.map(function (d, i) {
      const kolomHari = hasil.hariKerja.map(function (h) { return d.hari[h.tanggal] || '-'; });
      return [i + 1, d.noReg, d.nama, d.jk, d.institusi, d.namaJabatan].concat(kolomHari)
        .concat([d.hadir, d.terlambat, d.izin, d.sakit, d.dinas, d.alpa,
                 d.totalJam, d.persentase + '%', d.keterangan]);
    });
    if (isi.length) {
      sheet.getRange(barisHeader + 1, 1, isi.length, judul.length).setValues(isi);
      sheet.getRange(barisHeader + 1, 7, isi.length, hasil.hariKerja.length)
           .setHorizontalAlignment('center');
    }

    // Sheet kedua: agregat harian (sumber grafik)
    const sheet2 = ss.insertSheet('Agregat Harian');
    sheet2.getRange(1, 1, 1, 7).setValues([['Tanggal','Hari','Hadir','Terlambat','Izin/Dinas','Sakit','Alpa']]);
    gayaKepalaSheet(sheet2, 7, 1);
    if (hasil.agregat.length) {
      sheet2.getRange(2, 1, hasil.agregat.length, 7).setValues(hasil.agregat.map(function (a) {
        return [a.tanggal, a.hari, a.hadir, a.terlambat, a.izin, a.sakit, a.alpa];
      }));
    }
    sheet2.autoResizeColumns(1, 7);

    const barisKet = barisHeader + isi.length + 2;
    sheet.getRange(barisKet, 1).setValue(
      'Keterangan: H = Hadir | T = Terlambat | I = Izin | S = Sakit | D = Dinas Luar | A = Alpa | - = Bukan hari kerja/belum tercatat'
    ).setFontStyle('italic');
    sheet.getRange(barisKet + 1, 1).setValue(
      'Ambang minimal kehadiran: ' + hasil.ambang + '% dari ' + hasil.jumlahHariKerja + ' hari kerja.'
    );

    tulisTtdExcel(sheet, konfig, barisKet + 3, Math.max(1, judul.length - 4));
    sheet.autoResizeColumns(1, 6);
    SpreadsheetApp.flush();

    const berkas = spreadsheetKeExcel(ss, 'Rekap_Bulanan_' +
      bersihkanNamaBerkas(kodeBatch || 'SEMUA') + '_' + hasil.bulan);
    catatAudit(sesi.identitas, sesi.peran, 'EKSPOR_BULANAN_XLSX', berkas.nama);
    return sukses('Berkas Excel siap diunduh.', { berkas: berkas });
  });
}

/** Ekspor data absensi mentah (untuk analisis lanjutan). */
function eksporDataMentahExcel(token, kodeBatch, dari, sampai) {
  return jalankan(function () {
    const sesi = requireAuth(token, [PERAN.admin]);
    const A = KOL.absensi;
    const data = bacaSheet('absensi');
    const fb = String(kodeBatch || '').trim();
    const d1 = String(dari || '0000-01-01'), d2 = String(sampai || '9999-12-31');

    const isi = [];
    for (let i = 1; i < data.length; i++) {
      if (!data[i][A.tanggal]) continue;
      const t = formatWaktu(data[i][A.tanggal], 'yyyy-MM-dd');
      if (t < d1 || t > d2) continue;
      if (fb && String(data[i][A.batch]).trim() !== fb) continue;
      const baris = data[i].slice(0, SKEMA.absensi.length);
      baris[A.noReg] = String(baris[A.noReg]).replace(/^'/, '');
      baris[A.tanggal] = t;
      isi.push(baris);
    }

    const ss = buatSpreadsheetSementara('DataMentah');
    const sheet = ss.getSheets()[0].setName('Data Absensi');
    sheet.getRange(1, 1, 1, SKEMA.absensi.length).setValues([SKEMA.absensi]);
    gayaKepalaSheet(sheet, SKEMA.absensi.length, 1);
    if (isi.length) sheet.getRange(2, 1, isi.length, SKEMA.absensi.length).setValues(isi);
    SpreadsheetApp.flush();

    const berkas = spreadsheetKeExcel(ss, 'Data_Absensi_Mentah_' +
      bersihkanNamaBerkas(kodeBatch || 'SEMUA') + '_' + d1 + '_sd_' + d2);
    catatAudit(sesi.identitas, sesi.peran, 'EKSPOR_MENTAH', berkas.nama + ' (' + isi.length + ' baris)');
    return sukses(isi.length + ' baris diekspor.', { berkas: berkas });
  });
}

// ====================================================================
// 31. EKSPOR PDF — DAFTAR HADIR (TATA NASKAH DINAS)
// ====================================================================

function gayaDokumen() {
  return '<style>' +
    '@page { size: A4 landscape; margin: 12mm 10mm; }' +
    'body { font-family: "Arial", "Helvetica", sans-serif; font-size: 10pt; color:#000; }' +
    '.kop { text-align:center; border-bottom:3px double #000; padding-bottom:6px; margin-bottom:14px; }' +
    '.kop .k1 { font-size:11pt; font-weight:bold; letter-spacing:.5px; }' +
    '.kop .k2 { font-size:12pt; font-weight:bold; }' +
    '.kop .k3 { font-size:13pt; font-weight:bold; }' +
    '.kop .k4 { font-size:8.5pt; }' +
    '.judul { text-align:center; margin:10px 0 4px; font-size:12pt; font-weight:bold; text-decoration:underline; }' +
    '.sub { text-align:center; font-size:10pt; margin-bottom:10px; }' +
    'table { width:100%; border-collapse:collapse; }' +
    'th, td { border:1px solid #000; padding:3px 4px; font-size:8.5pt; vertical-align:middle; }' +
    'th { background:#e8eef7; text-align:center; font-weight:bold; }' +
    '.tengah { text-align:center; }' +
    '.kanan { text-align:right; }' +
    '.ttd { margin-top:18px; width:100%; }' +
    '.ttd td { border:none; font-size:9.5pt; }' +
    '.ket { font-size:8pt; font-style:italic; margin-top:8px; }' +
    '.pecah { page-break-after: always; }' +
    '</style>';
}

function kopDokumen(konfig) {
  return '<div class="kop">' +
    (konfig.logoUrl ? '<img src="' + lolosHtml(konfig.logoUrl) + '" style="height:58px;float:left;">' : '') +
    '<div class="k1">' + lolosHtml(konfig.kementerian) + '</div>' +
    '<div class="k2">' + lolosHtml(konfig.balai) + '</div>' +
    '<div class="k3">' + lolosHtml(konfig.satpel) + '</div>' +
    '<div class="k4">' + lolosHtml(konfig.alamat) + '</div>' +
    '<div class="k4">' + lolosHtml(konfig.kontak) + '</div>' +
    '</div>';
}

function ttdDokumen(konfig) {
  return '<table class="ttd"><tr>' +
    '<td style="width:62%"></td>' +
    '<td>' + lolosHtml(konfig.kotaTtd) + ', ' + tanggalIndonesia(new Date()) + '<br>' +
    lolosHtml(konfig.jabatanTtd) + '<br><br><br><br>' +
    '<b><u>' + lolosHtml(konfig.namaTtd) + '</u></b><br>' +
    lolosHtml(konfig.nipTtd) + '</td></tr></table>';
}

function kumpulkanDaftarHadir(token, kodeBatch, tanggalStr) {
  const hasil = getStatistikHarian(token, kodeBatch, tanggalStr);
  if (!hasil.sukses) throw new Error(hasil.pesan);
  const daftar = hasil.rincian.slice();
  hasil.belumAbsen.forEach(function (b) {
    daftar.push({ noReg: b.noReg, nama: b.nama, batch: b.batch, jabatan: b.jabatan,
                  institusi: b.institusi, jamMasuk: '-', jamPulang: '-', status: 'Belum Absen',
                  keterangan: '', durasi: 0 });
  });
  daftar.sort(function (a, b) { return String(a.nama).localeCompare(String(b.nama)); });
  return { daftar: daftar, ringkasan: hasil.ringkasan, tanggalIndo: hasil.tanggalIndo,
           jamKerja: hasil.jamKerja };
}

function susunHtmlDaftarHadir(paket, batch, konfig, tanggalStr, pecahHalaman) {
  let html = kopDokumen(konfig);
  html += '<div class="judul">DAFTAR HADIR PESERTA ' + lolosHtml(konfig.namaProgram.toUpperCase()) + '</div>';
  html += '<div class="sub">' + (batch ? lolosHtml(batch.nama) + '<br>' : '') +
          'Hari/Tanggal: ' + lolosHtml(paket.tanggalIndo) +
          ' &nbsp;|&nbsp; Jam Kerja: ' + lolosHtml(paket.jamKerja) + ' WITA</div>';

  html += '<table><thead><tr>' +
    '<th style="width:26px">No</th><th style="width:80px">No Registrasi</th>' +
    '<th>Nama Peserta</th><th style="width:120px">Asal Institusi</th>' +
    '<th style="width:110px">Jabatan/Posisi</th>' +
    '<th style="width:52px">Masuk</th><th style="width:52px">Pulang</th>' +
    '<th style="width:62px">Status</th><th style="width:96px">Keterangan</th>' +
    '<th style="width:96px">Tanda Tangan</th></tr></thead><tbody>';

  paket.daftar.forEach(function (d, i) {
    html += '<tr>' +
      '<td class="tengah">' + (i + 1) + '</td>' +
      '<td class="tengah">' + lolosHtml(d.noReg) + '</td>' +
      '<td>' + lolosHtml(d.nama) + '</td>' +
      '<td>' + lolosHtml(d.institusi || '-') + '</td>' +
      '<td>' + lolosHtml(d.jabatan || '-') + '</td>' +
      '<td class="tengah">' + lolosHtml(String(d.jamMasuk).substring(0, 5)) + '</td>' +
      '<td class="tengah">' + lolosHtml(String(d.jamPulang).substring(0, 5)) + '</td>' +
      '<td class="tengah">' + lolosHtml(d.status) + '</td>' +
      '<td>' + lolosHtml(d.keterangan || '') + '</td>' +
      '<td style="height:26px"></td></tr>';
  });
  html += '</tbody></table>';

  const r = paket.ringkasan;
  html += '<div class="ket">Rekapitulasi: Hadir ' + r.hadir + ' | Terlambat ' + r.terlambat +
          ' | Izin ' + r.izin + ' | Sakit ' + r.sakit + ' | Dinas Luar ' + r.dinas +
          ' | Alpa/Belum absen ' + (r.alpa + r.belumAbsen) +
          ' | Jumlah peserta ' + r.totalPeserta +
          ' | Persentase kehadiran ' + r.persenKehadiran + '%.</div>';
  html += '<div class="ket">Dokumen ini dicetak dari sistem e-Magang Satpel PVP Mamuju pada ' +
          formatWaktu(new Date(), 'dd-MM-yyyy HH:mm') + ' WITA dan sah tanpa memerlukan cap basah ' +
          'sepanjang disertai tanda tangan pejabat berwenang.</div>';
  html += ttdDokumen(konfig);
  if (pecahHalaman) html += '<div class="pecah"></div>';
  return html;
}

function eksporDaftarHadirPdf(token, kodeBatch, tanggal) {
  return jalankan(function () {
    const sesi = requireAuth(token, [PERAN.admin, PERAN.pembimbing]);
    const tgl = /^\d{4}-\d{2}-\d{2}$/.test(String(tanggal)) ? String(tanggal) : hariIniStr();
    const konfig = getKonfigurasiDokumen();
    const batch = kodeBatch ? cariBatch(kodeBatch) : null;
    const paket = kumpulkanDaftarHadir(token, kodeBatch, tgl);
    if (!paket.daftar.length) return gagal('Tidak ada data peserta pada tanggal tersebut.');

    const html = gayaDokumen() + susunHtmlDaftarHadir(paket, batch, konfig, tgl, false);
    const blob = Utilities.newBlob(html, 'text/html', 'daftar.html')
      .getAs('application/pdf')
      .setName('Daftar_Hadir_' + bersihkanNamaBerkas(kodeBatch || 'SEMUA') + '_' + tgl + '.pdf');
    const berkas = ambilFolderEkspor().createFile(blob);
    catatAudit(sesi.identitas, sesi.peran, 'EKSPOR_PDF_HARIAN', berkas.getName());
    return sukses('Berkas PDF siap diunduh.', {
      berkas: { nama: berkas.getName(), url: berkas.getUrl(), id: berkas.getId() }
    });
  });
}

function eksporDaftarHadirRentangPdf(token, kodeBatch, dari, sampai) {
  return jalankan(function () {
    const sesi = requireAuth(token, [PERAN.admin, PERAN.pembimbing]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dari)) || !/^\d{4}-\d{2}-\d{2}$/.test(String(sampai))) {
      return gagal('Rentang tanggal tidak valid.');
    }
    const hariKerja = daftarHariKerja(new Date(dari), new Date(sampai));
    if (!hariKerja.length) return gagal('Tidak ada hari kerja pada rentang tersebut.');
    if (hariKerja.length > 31) return gagal('Rentang maksimal 31 hari kerja per berkas.');

    const konfig = getKonfigurasiDokumen();
    const batch = kodeBatch ? cariBatch(kodeBatch) : null;
    let html = gayaDokumen();
    hariKerja.forEach(function (h, i) {
      const paket = kumpulkanDaftarHadir(token, kodeBatch, h.tanggal);
      html += susunHtmlDaftarHadir(paket, batch, konfig, h.tanggal, i < hariKerja.length - 1);
    });

    const blob = Utilities.newBlob(html, 'text/html', 'rentang.html')
      .getAs('application/pdf')
      .setName('Daftar_Hadir_' + bersihkanNamaBerkas(kodeBatch || 'SEMUA') +
               '_' + dari + '_sd_' + sampai + '.pdf');
    const berkas = ambilFolderEkspor().createFile(blob);
    catatAudit(sesi.identitas, sesi.peran, 'EKSPOR_PDF_RENTANG', berkas.getName());
    return sukses(hariKerja.length + ' halaman daftar hadir dibuat.', {
      berkas: { nama: berkas.getName(), url: berkas.getUrl(), id: berkas.getId() }
    });
  });
}

/** Rekap bulanan dalam bentuk PDF matriks. */
function eksporRekapBulananPdf(token, kodeBatch, bulan) {
  return jalankan(function () {
    const sesi = requireAuth(token, [PERAN.admin, PERAN.pembimbing]);
    const hasil = getRekapBulanan(token, kodeBatch, bulan);
    if (!hasil.sukses) return hasil;
    if (!hasil.data.length) return gagal('Tidak ada data peserta pada periode tersebut.');

    const konfig = getKonfigurasiDokumen();
    const batch = kodeBatch ? cariBatch(kodeBatch) : null;

    let html = gayaDokumen() + kopDokumen(konfig);
    html += '<div class="judul">REKAPITULASI KEHADIRAN BULANAN ' +
            lolosHtml(konfig.namaProgram.toUpperCase()) + '</div>';
    html += '<div class="sub">' + (batch ? lolosHtml(batch.nama) + '<br>' : '') +
            'Bulan ' + lolosHtml(hasil.namaBulan) + ' — ' + hasil.jumlahHariKerja +
            ' hari kerja (pola 5 hari kerja Senin–Jumat)</div>';

    html += '<table><thead><tr><th style="width:24px">No</th>' +
            '<th style="width:74px">No Reg</th><th>Nama Peserta</th>';
    hasil.hariKerja.forEach(function (h) {
      html += '<th style="width:15px">' + h.tanggal.substring(8) + '</th>';
    });
    html += '<th style="width:22px">H</th><th style="width:22px">T</th>' +
            '<th style="width:22px">I</th><th style="width:22px">S</th>' +
            '<th style="width:22px">A</th><th style="width:40px">%</th></tr></thead><tbody>';

    hasil.data.forEach(function (d, i) {
      html += '<tr><td class="tengah">' + (i + 1) + '</td>' +
              '<td class="tengah">' + lolosHtml(d.noReg) + '</td>' +
              '<td>' + lolosHtml(d.nama) + '</td>';
      hasil.hariKerja.forEach(function (h) {
        html += '<td class="tengah">' + lolosHtml(d.hari[h.tanggal] || '') + '</td>';
      });
      html += '<td class="tengah">' + d.hadir + '</td><td class="tengah">' + d.terlambat + '</td>' +
              '<td class="tengah">' + (d.izin + d.dinas) + '</td><td class="tengah">' + d.sakit + '</td>' +
              '<td class="tengah">' + d.alpa + '</td>' +
              '<td class="tengah">' + d.persentase + '</td></tr>';
    });
    html += '</tbody></table>';
    html += '<div class="ket">Keterangan: H = Hadir, T = Terlambat, I = Izin, D = Dinas Luar, ' +
            'S = Sakit, A = Alpa. Ambang minimal kehadiran ' + hasil.ambang + '%.</div>';
    html += ttdDokumen(konfig);

    const blob = Utilities.newBlob(html, 'text/html', 'rekap.html')
      .getAs('application/pdf')
      .setName('Rekap_Bulanan_' + bersihkanNamaBerkas(kodeBatch || 'SEMUA') +
               '_' + hasil.bulan + '.pdf');
    const berkas = ambilFolderEkspor().createFile(blob);
    catatAudit(sesi.identitas, sesi.peran, 'EKSPOR_PDF_BULANAN', berkas.getName());
    return sukses('Berkas PDF siap diunduh.', {
      berkas: { nama: berkas.getName(), url: berkas.getUrl(), id: berkas.getId() }
    });
  });
}

/** Sertifikat/keterangan kehadiran per peserta (PDF). */
function eksporKeteranganKehadiranPdf(token, noRegistrasi) {
  return jalankan(function () {
    const sesi = requireAuth(token, [PERAN.admin, PERAN.pembimbing]);
    const peserta = cariPeserta(noRegistrasi);
    if (!peserta) return gagal('Peserta tidak ditemukan.');
    const rekap = getRekapBatch(token, peserta.batch);
    if (!rekap.sukses) return rekap;
    const d = rekap.data.filter(function (x) { return x.noReg === peserta.noRegistrasi; })[0];
    if (!d) return gagal('Rekap peserta tidak ditemukan.');

    const konfig = getKonfigurasiDokumen();
    const per = periodeEfektif(peserta);
    const batch = per.batch;

    let html = '<style>@page{size:A4 portrait;margin:20mm;}' +
      'body{font-family:Arial,sans-serif;font-size:11pt;line-height:1.6;}' +
      '.kop{text-align:center;border-bottom:3px double #000;padding-bottom:6px;margin-bottom:18px;}' +
      '.kop .k1{font-size:11pt;font-weight:bold;}.kop .k2{font-size:12pt;font-weight:bold;}' +
      '.kop .k3{font-size:13pt;font-weight:bold;}.kop .k4{font-size:8.5pt;}' +
      '.judul{text-align:center;font-weight:bold;font-size:13pt;text-decoration:underline;margin:14px 0 4px;}' +
      'table.isi td{padding:2px 4px;vertical-align:top;font-size:11pt;}' +
      'table.rekap{border-collapse:collapse;width:70%;margin:10px auto;}' +
      'table.rekap th,table.rekap td{border:1px solid #000;padding:4px 8px;font-size:10pt;}' +
      'table.rekap th{background:#e8eef7;}' +
      '.ttd{margin-top:26px;width:100%;}.ttd td{font-size:11pt;}</style>';

    html += kopDokumen(konfig);
    html += '<div class="judul">SURAT KETERANGAN KEHADIRAN</div>';
    html += '<div style="text-align:center;font-size:10pt;margin-bottom:16px;">Nomor: ......./SATPEL-MMJ/' +
            formatWaktu(new Date(), 'MM/yyyy') + '</div>';
    html += '<p>Yang bertanda tangan di bawah ini, ' + lolosHtml(konfig.jabatanTtd) +
            ', dengan ini menerangkan bahwa:</p>';
    html += '<table class="isi">' +
      '<tr><td style="width:170px">Nama</td><td style="width:10px">:</td><td><b>' + lolosHtml(peserta.nama) + '</b></td></tr>' +
      '<tr><td>Nomor Registrasi</td><td>:</td><td>' + lolosHtml(peserta.noRegistrasi) + '</td></tr>' +
      '<tr><td>Asal Institusi</td><td>:</td><td>' + lolosHtml(peserta.institusi || '-') + '</td></tr>' +
      '<tr><td>Jurusan/Kompetensi</td><td>:</td><td>' + lolosHtml(peserta.jurusan || '-') + '</td></tr>' +
      '<tr><td>Unit Penempatan</td><td>:</td><td>' + lolosHtml(d.namaUnit || '-') + '</td></tr>' +
      '<tr><td>Jabatan/Posisi Magang</td><td>:</td><td>' + lolosHtml(d.namaJabatan || '-') + '</td></tr>' +
      '<tr><td>Batch</td><td>:</td><td>' + lolosHtml(batch ? batch.nama : peserta.batch) + '</td></tr>' +
      '<tr><td>Periode Magang</td><td>:</td><td>' +
        (per.mulai ? tanggalIndonesia(per.mulai) : '-') + ' s.d. ' +
        (per.selesai ? tanggalIndonesia(per.selesai) : '-') + '</td></tr>' +
      '</table>';
    html += '<p>telah mengikuti Program Magang Nasional pada ' + lolosHtml(konfig.satpel) +
            ' dengan rekapitulasi kehadiran sebagai berikut:</p>';
    html += '<table class="rekap"><tr><th>Uraian</th><th>Jumlah</th></tr>' +
      '<tr><td>Hadir tepat waktu</td><td style="text-align:center">' + d.hadir + ' hari</td></tr>' +
      '<tr><td>Terlambat</td><td style="text-align:center">' + d.terlambat + ' hari</td></tr>' +
      '<tr><td>Izin</td><td style="text-align:center">' + d.izin + ' hari</td></tr>' +
      '<tr><td>Sakit</td><td style="text-align:center">' + d.sakit + ' hari</td></tr>' +
      '<tr><td>Dinas luar</td><td style="text-align:center">' + d.dinas + ' hari</td></tr>' +
      '<tr><td>Tanpa keterangan</td><td style="text-align:center">' + d.alpa + ' hari</td></tr>' +
      '<tr><td><b>Persentase kehadiran</b></td><td style="text-align:center"><b>' + d.persentase + '%</b></td></tr>' +
      '<tr><td>Total jam magang tercatat</td><td style="text-align:center">' + d.totalJam + ' jam</td></tr>' +
      '</table>';
    html += '<p>Yang bersangkutan dinyatakan <b>' + lolosHtml(d.keterangan.toLowerCase()) +
            '</b> ambang minimal kehadiran ' + rekap.ambang + '%.</p>';
    html += '<p>Demikian surat keterangan ini dibuat untuk dipergunakan sebagaimana mestinya.</p>';
    html += ttdDokumen(konfig);

    const blob = Utilities.newBlob(html, 'text/html', 'ket.html')
      .getAs('application/pdf')
      .setName('Keterangan_Kehadiran_' + bersihkanNamaBerkas(peserta.noRegistrasi) + '.pdf');
    const berkas = ambilFolderEkspor().createFile(blob);
    catatAudit(sesi.identitas, sesi.peran, 'EKSPOR_KETERANGAN', peserta.noRegistrasi);
    return sukses('Surat keterangan siap diunduh.', {
      berkas: { nama: berkas.getName(), url: berkas.getUrl(), id: berkas.getId() }
    });
  });
}
