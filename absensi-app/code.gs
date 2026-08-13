// KONFIGURASI SPREADSHEET
const SPREADSHEET_ID = 'ubah id nya';
const PARENT_FOLDER_ID = 'ubah id nya';

// Fungsi untuk mendapatkan spreadsheet
function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

// ====================================
// MAIN ENTRY POINT
// ====================================
function doGet(e) {
  // Mode scanner: halaman kamera terpisah, origin sama dengan halaman utama
  if (e && e.parameter && e.parameter.mode === 'scanner') {
    return HtmlService.createHtmlOutput(getScannerPageHtml())
      .setTitle('Scan QR - E-Absensi')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }

  // Halaman utama
  const template = HtmlService.createTemplateFromFile('index');
  return template.evaluate()
    .setTitle('Aplikasi Absensi Sekolah')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setFaviconUrl('https://if.polibatam.ac.id/pamerin/uploads/pbl/3312011063/3312011063_gambar1_20220710.png');
}

// Fungsi untuk mendapatkan URL deployment (dipanggil dari frontend)
function getDeploymentUrl() {
  return ScriptApp.getService().getUrl();
}

// HTML halaman scanner kamera (disajikan dari URL GAS yang sama)
function getScannerPageHtml() {
  return '<!DOCTYPE html>' +
'<html lang="id">' +
'<head>' +
'<meta charset="UTF-8">' +
'<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
'<title>Scan QR - E-Absensi</title>' +
'<style>' +
'* { margin:0; padding:0; box-sizing:border-box; }' +
'body { background:#0f172a; color:white; font-family:"Segoe UI",sans-serif; display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:100vh; padding:20px; gap:16px; }' +
'h2 { font-size:15px; font-weight:700; color:#e2e8f0; letter-spacing:1px; }' +
'#videoWrap { position:relative; width:100%; max-width:420px; }' +
'video { width:100%; border-radius:16px; display:block; background:#000; min-height:240px; }' +
'canvas { display:none; }' +
'.overlay { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; pointer-events:none; }' +
'.box { width:200px; height:200px; position:relative; }' +
'.corner { position:absolute; width:24px; height:24px; border-color:#6366f1; border-style:solid; }' +
'.tl { top:0; left:0; border-width:4px 0 0 4px; border-radius:6px 0 0 0; }' +
'.tr { top:0; right:0; border-width:4px 4px 0 0; border-radius:0 6px 0 0; }' +
'.bl { bottom:0; left:0; border-width:0 0 4px 4px; border-radius:0 0 0 6px; }' +
'.br { bottom:0; right:0; border-width:0 4px 4px 0; border-radius:0 0 6px 0; }' +
'.scanline { position:absolute; left:6px; right:6px; height:2px; background:linear-gradient(90deg,transparent,#6366f1,transparent); top:10px; animation:scan 2s linear infinite; }' +
'@keyframes scan { 0%{top:10px;opacity:1} 100%{top:190px;opacity:0} }' +
'#status { font-size:13px; color:#94a3b8; text-align:center; max-width:340px; min-height:40px; line-height:1.6; padding:0 10px; }' +
'#status.ok { color:#4ade80; font-weight:700; font-size:16px; }' +
'#status.err { color:#f87171; }' +
'.btns { display:flex; gap:10px; flex-wrap:wrap; justify-content:center; width:100%; max-width:420px; }' +
'button { flex:1; min-width:110px; background:#4f46e5; color:white; border:none; padding:12px 16px; border-radius:12px; font-size:13px; font-weight:700; cursor:pointer; transition:background .2s; }' +
'button:hover { background:#4338ca; }' +
'button.sec { background:#1e293b; border:1px solid #334155; }' +
'button.sec:hover { background:#334155; }' +
'#loading { color:#64748b; font-size:13px; text-align:center; }' +
'.spinner { width:36px; height:36px; border:3px solid #1e293b; border-top:3px solid #6366f1; border-radius:50%; animation:spin .8s linear infinite; margin:0 auto 14px; }' +
'@keyframes spin { to { transform:rotate(360deg); } }' +
'</style>' +
'</head>' +
'<body>' +
'<h2>&#128247; SCAN QR ABSENSI</h2>' +
'<div id="loading"><div class="spinner"></div>Memulai kamera...</div>' +
'<div id="videoWrap" style="display:none">' +
'  <video id="video" autoplay playsinline muted></video>' +
'  <canvas id="canvas"></canvas>' +
'  <div class="overlay"><div class="box">' +
'    <div class="corner tl"></div><div class="corner tr"></div>' +
'    <div class="corner bl"></div><div class="corner br"></div>' +
'    <div class="scanline"></div>' +
'  </div></div>' +
'</div>' +
'<div id="status">Arahkan QR code ke dalam kotak</div>' +
'<div class="btns">' +
'  <button onclick="switchCam()">&#128260; Ganti Kamera</button>' +
'  <button class="sec" onclick="window.close()">&#10005; Tutup</button>' +
'</div>' +
'<script>' +
'var stream=null,facing="environment",loopId=null,lastScan=0;' +
'var video=document.getElementById("video"),canvas=document.getElementById("canvas"),ctx=canvas.getContext("2d");' +
'var status=document.getElementById("status"),loading=document.getElementById("loading"),wrap=document.getElementById("videoWrap");' +
'var LS_KEY="gas_qr_result";' +
'async function startCam(f){' +
'  try{' +
'    if(stream)stream.getTracks().forEach(function(t){t.stop();});' +
'    if(loopId){cancelAnimationFrame(loopId);clearInterval(loopId);loopId=null;}' +
'    loading.style.display="block";wrap.style.display="none";' +
'    status.className="";status.textContent="Memulai kamera...";' +
'    stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:f==="environment"?{ideal:"environment"}:"user",width:{ideal:1280},height:{ideal:720}}});' +
'    video.srcObject=stream;' +
'    await new Promise(function(res){video.onloadedmetadata=function(){video.play();res();};});' +
'    loading.style.display="none";wrap.style.display="block";' +
'    status.textContent="Arahkan QR code ke dalam kotak";' +
'    beginScan();' +
'  }catch(e){' +
'    loading.style.display="none";status.className="err";' +
'    status.innerHTML="Kamera gagal: "+e.name+"<br><small>"+e.message+"</small>";' +
'  }' +
'}' +
'function switchCam(){facing=facing==="environment"?"user":"environment";startCam(facing);}' +
'function beginScan(){' +
'  if("BarcodeDetector" in window){' +
'    var detector=new BarcodeDetector({formats:["qr_code"]});' +
'    var loop=async function(){' +
'      if(video.readyState===video.HAVE_ENOUGH_DATA){' +
'        canvas.width=video.videoWidth;canvas.height=video.videoHeight;ctx.drawImage(video,0,0);' +
'        try{var codes=await detector.detect(canvas);if(codes.length>0){var now=Date.now();if(now-lastScan>3000){lastScan=now;handleResult(codes[0].rawValue);}}}catch(e){}' +
'      }' +
'      loopId=requestAnimationFrame(loop);' +
'    };' +
'    loopId=requestAnimationFrame(loop);' +
'  }else{' +
'    var s=document.createElement("script");' +
'    s.src="https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js";' +
'    s.onload=function(){' +
'      loopId=setInterval(function(){' +
'        if(video.readyState!==video.HAVE_ENOUGH_DATA)return;' +
'        canvas.width=video.videoWidth;canvas.height=video.videoHeight;ctx.drawImage(video,0,0);' +
'        var d=ctx.getImageData(0,0,canvas.width,canvas.height);' +
'        var c=jsQR(d.data,d.width,d.height);' +
'        if(c&&c.data){var now=Date.now();if(now-lastScan>3000){lastScan=now;handleResult(c.data);}}' +
'      },400);' +
'    };' +
'    document.head.appendChild(s);' +
'  }' +
'}' +
'function handleResult(text){' +
'  if(!text)return;' +
'  if(loopId){cancelAnimationFrame(loopId);clearInterval(loopId);loopId=null;}' +
'  if(stream)stream.getTracks().forEach(function(t){t.stop();});' +
'  status.className="ok";status.textContent="QR Terdeteksi! Menyimpan...";' +
'  try{' +
'    localStorage.setItem(LS_KEY,JSON.stringify({nisn:text,ts:Date.now()}));' +
'    status.textContent="Berhasil! Menutup tab...";' +
'  }catch(e){status.className="err";status.textContent="Gagal simpan: "+e.message;}' +
'  setTimeout(function(){window.close();},1500);' +
'}' +
'startCam(facing);' +
'<\/script>' +
'</body></html>';
}

// ====================================
// AUTENTIKASI & SESSION
// ====================================
function login(username, password, nisn) {
  try {
    const ss = getSpreadsheet();
    const usersSheet = ss.getSheetByName('users');
    const siswaSheet = ss.getSheetByName('siswa');

    let userFound = null;

    // -------------------------------------------
    // 1. LOGIKA CEK KREDENSIAL (SAMA SEPERTI LAMA)
    // -------------------------------------------
    
    // A. Login SISWA (Pakai NISN)
    if (nisn) {
      const siswaData = siswaSheet.getDataRange().getValues();
      for (let i = 1; i < siswaData.length; i++) {
        if (String(siswaData[i][1]) === String(nisn)) { 
          userFound = {
            role: 'siswa',
            identifier: siswaData[i][1], // NISN
            nama: siswaData[i][0],
            kelas: siswaData[i][8]
          };
          break;
        }
      }
      if (!userFound) return { success: false, message: 'NISN tidak terdaftar. Periksa kembali nomornya.' };
    } 
    // B. Login ADMIN & GURU (Username/Pass)
    else {
      const userData = usersSheet.getDataRange().getValues();
      for (let i = 1; i < userData.length; i++) {
        if (userData[i][0] == username && userData[i][1] == password) {
          userFound = {
            role: userData[i][2],
            identifier: userData[i][0], // Username
            nama: userData[i][0],       // Gunakan username sbg nama
            kelas: userData[i][3] || "" 
          };
          break;
        }
      }
      if (!userFound) return { success: false, message: 'Username atau password salah. Silakan coba lagi.' };
    }

    // -------------------------------------------
    // 2. GENERATE & SIMPAN TOKEN (KEAMANAN BARU)
    // -------------------------------------------
    
    // Buat Token Unik (UUID)
    const token = Utilities.getUuid();
    
    // Set Waktu Expired (24 Jam dari sekarang)
    const expiry = new Date();
    expiry.setTime(expiry.getTime() + (24 * 60 * 60 * 1000)); 

    // Siapkan Sheet Sessions
    let sessionSheet = ss.getSheetByName('sessions');
    if (!sessionSheet) {
      sessionSheet = ss.insertSheet('sessions');
      sessionSheet.appendRow(['Token', 'Identifier', 'Role', 'Expiry']);
      // Format kolom tanggal agar mudah dibaca (Opsional)
      sessionSheet.getRange("D:D").setNumberFormat("yyyy-mm-dd hh:mm:ss");
    }

    // Simpan data sesi baru ke Sheet
    sessionSheet.appendRow([
      token, 
      userFound.identifier, 
      userFound.role, 
      expiry
    ]);

    // -------------------------------------------
    // 3. KEMBALIKAN TOKEN KE FRONTEND
    // -------------------------------------------
    return {
      success: true,
      token: token,      // Token dikirim ke frontend
      role: userFound.role,
      username: userFound.identifier,
      nama: userFound.nama,
      kelas: userFound.kelas,
      nisn: (userFound.role === 'siswa') ? userFound.identifier : null
    };

  } catch (error) {
    return { success: false, message: 'Gagal masuk. Silakan coba lagi sebentar. (' + error.toString() + ')' };
  }
}


function verifyUser(token, requiredRole) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID); // Pastikan ID Spreadsheet global terbaca
  const sheet = ss.getSheetByName('sessions');
  const data = sheet.getDataRange().getValues();
  const now = new Date();

  for (let i = 1; i < data.length; i++) {
    // data[i][0] = Token, data[i][2] = Role, data[i][3] = Expiry
    if (data[i][0] === token) {
      // Cek apakah token expired (misal 24 jam)
      if (data[i][3] instanceof Date && data[i][3] > now) {
        // Cek Role
        if (requiredRole && data[i][2] !== requiredRole && data[i][2] !== 'admin') {
           // Admin biasanya boleh akses semua, jika role user != required, tolak
           throw new Error("Anda tidak memiliki akses untuk tindakan ini.");
        }
        return true; // Valid
      } else {
        throw new Error("Sesi Anda telah berakhir. Silakan masuk kembali.");
      }
    }
  }
  throw new Error("Sesi tidak ditemukan. Silakan masuk kembali.");
}
// ====================================
// SISWA - CRUD OPERATIONS
// ====================================
function getSiswaList(filterKelas) { // Tambahkan parameter filterKelas
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('siswa');
    const data = sheet.getDataRange().getValues();
    const siswaList = [];

    // Support multi-kelas: filterKelas bisa string biasa atau "Kelas A,Kelas B"
    const kelasList = filterKelas
      ? String(filterKelas).split(',').map(k => k.trim()).filter(Boolean)
      : null;
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0]) { 
        
        // --- LOGIKA FILTER MULTI-KELAS ---
        const siswaKelas = String(data[i][8]).trim(); // Kolom I (Index 8) adalah Kelas
        if (kelasList && kelasList.length > 0 && !kelasList.includes(siswaKelas)) {
           continue; 
        }
        // ---------------------------------

        // --- FORMAT TANGGAL (Sama seperti sebelumnya) ---
        let rawTgl = data[i][3];
        let tglLahir = '';

        if (rawTgl instanceof Date) {
          tglLahir = formatWaktuSheet(rawTgl, 'yyyy-MM-dd');
        } else if (typeof rawTgl === 'string') {
          let cleanTgl = rawTgl.replace(/'/g, "").trim();
          if (cleanTgl.includes('-')) {
            let parts = cleanTgl.split('-');
            if (parts[2] && parts[2].length === 4) {
               tglLahir = parts[2] + '-' + parts[1] + '-' + parts[0];
            } else {
               tglLahir = cleanTgl;
            }
          }
        }

        siswaList.push({
          nama: data[i][0],
          nisn: data[i][1],
          jenisKelamin: data[i][2],
          tanggalLahir: tglLahir,
          agama: data[i][4],
          namaAyah: data[i][5],
          namaIbu: data[i][6],
          noHp: data[i][7],
          kelas: data[i][8],
          alamat: data[i][9]
        });
      }
    }
    
    return { success: true, data: siswaList };
  } catch (error) {
    return { success: false, message: 'Terjadi kesalahan. Silakan coba lagi. (' + error.toString() + ')' };
  }
}

function getSiswaByNisn(nisn) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('siswa');
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] == nisn) {
        
        // FORMAT TANGGAL LAHIR DISINI JUGA
        let tglLahir = '';
        if (data[i][3]) {
          tglLahir = formatWaktuSheet(new Date(data[i][3]), 'yyyy-MM-dd');
        }

        return {
          success: true,
          data: {
            nama: data[i][0],
            nisn: data[i][1],
            jenisKelamin: data[i][2],
            tanggalLahir: tglLahir,
            agama: data[i][4],
            namaAyah: data[i][5],
            namaIbu: data[i][6],
            noHp: data[i][7],
            kelas: data[i][8],
            alamat: data[i][9]
          }
        };
      }
    }
    
    return { success: false, message: 'Data siswa tidak ditemukan.' };
  } catch (error) {
    return { success: false, message: 'Terjadi kesalahan. Silakan coba lagi. (' + error.toString() + ')' };
  }
}

function addSiswa(token, siswaData) { 
  try {
    // --- 1. PASANG SATPAM DISINI ---
    // Cek apakah pengirim punya token admin yang valid?
    verifyUser(token, 'admin'); 
    // -------------------------------

    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('siswa');

    // Cek NISN duplikat
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] == siswaData.nisn) {
        return { success: false, message: 'NISN ini sudah terdaftar.' };
      }
    }
    
    // Format Tanggal
    let tglSimpan = siswaData.tanggalLahir;
    if (tglSimpan && tglSimpan.includes('-')) {
      let parts = tglSimpan.split('-');
      tglSimpan = "'" + parts[2] + '-' + parts[1] + '-' + parts[0];
    }

    sheet.appendRow([
      siswaData.nama,
      siswaData.nisn,
      siswaData.jenisKelamin,
      tglSimpan,
      siswaData.agama,
      siswaData.namaAyah,
      siswaData.namaIbu,
      siswaData.noHp,
      siswaData.kelas,
      siswaData.alamat
    ]);
    return { success: true, message: 'Siswa berhasil ditambahkan.' };

  } catch (error) {
    // Jika token salah, akan masuk ke sini
    return { success: false, message: error.message };
  }
}

// Ganti function updateSiswa yang lama dengan ini
function updateSiswa(token, oldNisn, siswaData) { // Pastikan ada parameter token
  try {
    // 1. PERBAIKAN ERROR REFERENCE
    // Gunakan 'verifyUser' sesuai yang ada di kode Anda (baris 21), bukan 'verifyToken'
    verifyUser(token, 'admin'); 
    
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('siswa');
    const data = sheet.getDataRange().getValues();
    
    // Logika Format Tanggal (Sesuai kode asli Anda)
    let tglSimpan = siswaData.tanggalLahir;
    if (tglSimpan && tglSimpan.includes('-')) {
       let parts = tglSimpan.split('-');
       if(parts[0].length === 4) { 
           tglSimpan = "'" + parts[2] + '-' + parts[1] + '-' + parts[0];
       }
    }

    // 2. PERBAIKAN PENCARIAN (SOLUSI SISWA TIDAK DITEMUKAN)
    // Gunakan .trim() untuk menghapus spasi yang tidak terlihat
    let rowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      // Bandingkan NISN di sheet dengan NISN yang mau diedit
      if (String(data[i][1]).trim() === String(oldNisn).trim()) {
        rowIndex = i;
        break; // Data ditemukan, hentikan loop
      }
    }

    if (rowIndex !== -1) {
        // Lakukan Update Data
        sheet.getRange(rowIndex + 1, 1, 1, 10).setValues([[
          siswaData.nama,
          siswaData.nisn,
          siswaData.jenisKelamin,
          tglSimpan, 
          siswaData.agama,
          siswaData.namaAyah,
          siswaData.namaIbu,
          siswaData.noHp,
          siswaData.kelas,
          siswaData.alamat
        ]]);
        return { success: true, message: 'Data siswa berhasil diperbarui.' };
    }
    
    return { success: false, message: 'Data siswa tidak ditemukan. Periksa kembali NISN-nya.' };
  } catch (error) {
    return { success: false, message: 'Terjadi kesalahan. Silakan coba lagi. (' + error.toString() + ')' };
  }
}

function deleteSiswa(token, nisn) {
  try {
    // 1. CEK KEAMANAN (Server Side Validation)
    // Hanya user dengan role 'admin' yang memiliki token valid yang boleh menghapus
    verifyUser(token, 'admin'); 

    // 2. LOGIKA HAPUS (Jika token valid, kode lanjut ke sini)
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('siswa');
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      // Cek NISN pada kolom index 1
      if (String(data[i][1]) === String(nisn)) {
        sheet.deleteRow(i + 1);
        return { success: true, message: 'Data siswa berhasil dihapus.' };
      }
    }
    
    return { success: false, message: 'Data siswa tidak ditemukan.' };

  } catch (error) {
    // Jika verifyUser gagal, error akan tertangkap di sini
    return { success: false, message: error.message };
  }
}

// ====================================
// GURU - CRUD OPERATIONS
// ====================================
function getGuruList(token) {
  try {
    // 1. CEK KEAMANAN (Server Side Validation)
    // Wajib role 'admin'. Token siswa/guru akan ditolak disini.
    verifyUser(token, 'admin'); 

    // 2. LOGIKA AMBIL DATA (Hanya jalan jika token valid & admin)
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('users');
    const data = sheet.getDataRange().getValues();
    const guruList = [];

    // Loop data mulai baris 1 (lewati header)
    for (let i = 1; i < data.length; i++) {
      // Cek kolom Role (Index 2) apakah 'guru'
      if (data[i][2] == 'guru') {
        guruList.push({
          username: data[i][0], // Kolom A
          password: data[i][1], // Kolom B (Sensitif)
          role: data[i][2],     // Kolom C
          kelas: data[i][3] || "" // Kolom D (Wali Kelas)
        });
      }
    }

    return { success: true, data: guruList };

  } catch (error) {
    // Jika verifyUser melempar error (Akses Ditolak), akan ditangkap disini
    return { success: false, message: error.message };
  }
}

function addGuru(token, username, password, kelas) { // Tambah param token
  try {
    verifyUser(token, 'admin'); // <-- SATPAM: Cek Token Admin

    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('users');
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] == username) {
        return { success: false, message: 'Username ini sudah dipakai.' };
      }
    }
    sheet.appendRow([username, password, 'guru', kelas]);
    return { success: true, message: 'Akun guru berhasil ditambahkan.' };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

function updateGuru(token, oldUsername, newUsername, password, kelas) { // Tambah param token
  try {
    verifyUser(token, 'admin'); // <-- SATPAM

    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('users');
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] == oldUsername && data[i][2] == 'guru') {
        sheet.getRange(i + 1, 1, 1, 4).setValues([[newUsername, password, 'guru', kelas]]);
        return { success: true, message: 'Akun guru berhasil diperbarui.' };
      }
    }
    return { success: false, message: 'Akun guru tidak ditemukan.' };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

function deleteGuru(token, username) { // Tambah param token
  try {
    verifyUser(token, 'admin'); // <-- SATPAM

    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('users');
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] == username && data[i][2] == 'guru') {
        sheet.deleteRow(i + 1);
        return { success: true, message: 'Akun guru berhasil dihapus.' };
      }
    }
    return { success: false, message: 'Akun guru tidak ditemukan.' };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

// ====================================
// ABSENSI OPERATIONS
// ====================================
function scanAbsensi(nisn, scannerRole, scannerKelas) {
  try {
    const ss = getSpreadsheet();
    const today = formatWaktuSheet(new Date(), 'yyyy-MM-dd');
    const nowTime = formatWaktuSheet(new Date(), 'HH:mm');

    // 1. AMBIL KONFIGURASI JAM
    const configResult = getAppConfig();
    const config = configResult.success ? configResult.data : {
      jam_masuk_akhir: '07:15',
      jam_pulang_mulai: '15:00',
      jam_pulang_akhir: '17:00'
    };

    // 2. CEK HARI LIBUR & TERAPKAN JAM JADWAL HARI INI
    
    // A. Tentukan hari ini (1=Senin ... 7=Minggu)
    const dayIndex = formatWaktuSheet(new Date(), 'u');
    const dayNames = {'1':'Senin','2':'Selasa','3':'Rabu','4':'Kamis','5':'Jumat','6':'Sabtu','7':'Minggu'};
    
    // B. Cek jadwal harian per hari
    if (config.jadwal_harian) {
      const todaySchedule = config.jadwal_harian[dayIndex];
      if (!todaySchedule || todaySchedule.libur) {
        return { success: false, message: `Absensi ditutup. Hari ini jadwal libur: ${dayNames[dayIndex] || ''}.` };
      }
      // Override config dengan jadwal hari ini
      config.jam_masuk_mulai  = todaySchedule.masuk_mulai  || config.jam_masuk_mulai;
      config.jam_masuk_akhir  = todaySchedule.masuk_akhir  || config.jam_masuk_akhir;
      config.jam_pulang_mulai = todaySchedule.pulang_mulai || config.jam_pulang_mulai;
      config.jam_pulang_akhir = todaySchedule.pulang_akhir || config.jam_pulang_akhir;
    } else if (dayIndex === '7') {
      return { success: false, message: 'Absensi ditutup. Hari ini libur: Minggu.' };
    }

    // C. Cek Tanggal Merah dari Database
    const liburSheet = ss.getSheetByName('hari_libur');
    if (liburSheet) {
      const liburData = liburSheet.getDataRange().getValues();
      for (let i = 1; i < liburData.length; i++) {
        if (liburData[i][0]) {
          let tglLibur = formatWaktuSheet(new Date(liburData[i][0]), 'yyyy-MM-dd');
          if (tglLibur === today) {
            return { success: false, message: 'Absensi ditutup. Hari ini libur: ' + liburData[i][1] + '.' };
          }
        }
      }
    }

    const absensiSheet = ss.getSheetByName('absensi');
    const siswaSheet = ss.getSheetByName('siswa');
    
    // 3. VALIDASI INPUT QR
    const scannedNisn = String(nisn).trim();
    if (scannedNisn === "" || scannedNisn === "undefined") {
      return { success: false, message: 'QR Code tidak terbaca. Silakan scan ulang.' };
    }

    // 4. CARI DATA SISWA
    const siswaData = siswaSheet.getDataRange().getValues();
    let siswa = null;
    
    for (let i = 1; i < siswaData.length; i++) {
      // Kolom index 1 adalah NISN
      if (String(siswaData[i][1]).trim() === scannedNisn) {
        siswa = {
          nama: siswaData[i][0],
          nisn: siswaData[i][1],
          kelas: siswaData[i][8]
        };
        break;
      }
    }
    
    if (!siswa) {
      return { success: false, message: 'NISN tidak terdaftar.' };
    }

    // 5. VALIDASI KELAS (Jika Scanner adalah GURU)
    if (scannerRole === 'guru') {
      const kelasSiswa = String(siswa.kelas).trim();
      const kelasGuruList = scannerKelas
        ? String(scannerKelas).split(',').map(k => k.trim()).filter(Boolean)
        : [];
      // Jika guru punya kelas (bukan guru umum), dan kelas siswa tidak termasuk -> TOLAK
      if (kelasGuruList.length > 0 && !kelasGuruList.map(k=>k.toUpperCase()).includes(kelasSiswa.toUpperCase())) {
        return { 
          success: false, 
          message: `Siswa ini dari kelas ${siswa.kelas}. Anda hanya dapat melakukan scan untuk kelas ${scannerKelas}.` 
        };
      }
    }

    // 6. PROSES ABSENSI — tergantung mode_absen
    const modeAbsen = config.mode_absen || 'masuk_pulang'; // masuk_saja | masuk_pulang | masuk_sholat_pulang
    const absensiData = absensiSheet.getDataRange().getValues();
    
    for (let i = 1; i < absensiData.length; i++) {
      const rowDateCell = absensiData[i][0];
      if (!rowDateCell) continue;

      const rowDateStr = formatWaktuSheet(new Date(rowDateCell), 'yyyy-MM-dd');
      const rowNisn = String(absensiData[i][1]).trim();
      
      // Data hari ini ditemukan untuk NISN ini
      if (rowDateStr === today && rowNisn === scannedNisn) {

        // ─── MODE: MASUK SAJA ───────────────────────────────────────
        if (modeAbsen === 'masuk_saja') {
          return { success: false, message: `${siswa.nama} sudah absen hari ini.` };
        }

        // ─── MODE: MASUK + PULANG ───────────────────────────────────
        if (modeAbsen === 'masuk_pulang') {
          if (absensiData[i][5]) {
            return { success: false, message: `${siswa.nama} sudah absen pulang hari ini.` };
          }
          // Validasi batas pulang
          if (nowTime > config.jam_pulang_akhir) {
            return { success: false, message: `Sudah melewati batas absen pulang (${config.jam_pulang_akhir}).` };
          }
          // Jeda minimal 1 menit
          let jamDatangRaw = absensiData[i][4];
          let jamDatangStr = (jamDatangRaw instanceof Date) ? formatWaktuSheet(jamDatangRaw, 'HH:mm') : String(jamDatangRaw).substring(0, 5);
          if (calculateTimeDiff(jamDatangStr, nowTime) < 1) {
            return { success: false, message: 'Terlalu cepat. Tunggu sebentar sebelum scan lagi.' };
          }
          let ketSaatIni = absensiData[i][6];
          let ketBaru = ketSaatIni;
          let pesanPulang = 'Absen pulang berhasil.';
          if (nowTime < config.jam_pulang_mulai) {
            ketBaru = (ketSaatIni ? ketSaatIni + ' & ' : '') + 'Pulang Cepat';
            pesanPulang = 'Absen pulang berhasil (pulang cepat).';
          }
          const jamPulang = formatWaktuSheet(new Date(), 'HH:mm:ss');
          absensiSheet.getRange(i + 1, 6).setValue(jamPulang);
          absensiSheet.getRange(i + 1, 7).setValue(ketBaru);
          return { success: true, message: pesanPulang, type: 'pulang', jamPulang, nama: siswa.nama, kelas: siswa.kelas, status: 'Hadir' };
        }

        // ─── MODE: MASUK + SHOLAT + PULANG ─────────────────────────
        if (modeAbsen === 'masuk_sholat_pulang') {
          const jamSholatKol = absensiData[i][8]; // Kolom I (index 8)
          const jamPulangKol = absensiData[i][5]; // Kolom F (index 5)

          // Sudah pulang
          if (jamPulangKol) {
            return { success: false, message: `${siswa.nama} sudah absen pulang hari ini.` };
          }

          // Langkah 2: Belum sholat → catat sholat
          if (!jamSholatKol) {
            let jamDatangRaw = absensiData[i][4];
            let jamDatangStr = (jamDatangRaw instanceof Date) ? formatWaktuSheet(jamDatangRaw, 'HH:mm') : String(jamDatangRaw).substring(0, 5);
            if (calculateTimeDiff(jamDatangStr, nowTime) < 1) {
              return { success: false, message: 'Terlalu cepat. Tunggu sebentar sebelum scan lagi.' };
            }
            const jamSholat = formatWaktuSheet(new Date(), 'HH:mm:ss');
            absensiSheet.getRange(i + 1, 9).setValue(jamSholat); // Kolom I
            return { success: true, message: 'Absen sholat berhasil.', type: 'sholat', jamSholat, nama: siswa.nama, kelas: siswa.kelas, status: 'Hadir' };
          }

          // Langkah 3: Sudah sholat → catat pulang
          if (nowTime > config.jam_pulang_akhir) {
            return { success: false, message: `Sudah melewati batas absen pulang (${config.jam_pulang_akhir}).` };
          }
          let ketSaatIni = absensiData[i][6];
          let ketBaru = ketSaatIni;
          let pesanPulang = 'Absen pulang berhasil.';
          if (nowTime < config.jam_pulang_mulai) {
            ketBaru = (ketSaatIni ? ketSaatIni + ' & ' : '') + 'Pulang Cepat';
            pesanPulang = 'Absen pulang berhasil (pulang cepat).';
          }
          const jamPulang = formatWaktuSheet(new Date(), 'HH:mm:ss');
          absensiSheet.getRange(i + 1, 6).setValue(jamPulang);
          absensiSheet.getRange(i + 1, 7).setValue(ketBaru);
          return { success: true, message: pesanPulang, type: 'pulang', jamPulang, nama: siswa.nama, kelas: siswa.kelas, status: 'Hadir' };
        }
      }
    }

    // === SKENARIO ABSEN MASUK (Data Hari Ini Belum Ada) ===

    // 1. Blokir jika absen belum dibuka (sebelum jam_masuk_mulai)
    if (nowTime < config.jam_masuk_mulai) {
      return { success: false, message: `Absensi belum dibuka. Dibuka mulai pukul ${config.jam_masuk_mulai}.` };
    }

    // 2. Blokir jika sudah melewati seluruh jam operasional
    //    Mode masuk_saja: blokir setelah jam_masuk_akhir + toleransi
    //    Mode lain: blokir setelah jam_pulang_akhir
    const batasAkhir = (modeAbsen === 'masuk_saja') ? config.jam_masuk_akhir : config.jam_pulang_akhir;
    if (nowTime > batasAkhir) {
      return { success: false, message: `Absensi sudah ditutup. Batas waktu ${batasAkhir} telah lewat.` };
    }

    // 3. Tentukan status: Tepat Waktu atau Terlambat
    let keteranganWaktu = 'Tepat Waktu';
    let statusKehadiran = 'Hadir';

    if (nowTime > config.jam_masuk_akhir) {
      const lateMinutes = calculateTimeDiff(config.jam_masuk_akhir, nowTime);
      keteranganWaktu = `Terlambat ${lateMinutes} menit`;
    }
    const jamDatang = formatWaktuSheet(new Date(), 'HH:mm:ss');
    
    // INSERT DATA BARU (APPEND ROW) — 9 kolom (kolom I = Jam Sholat, kosong dulu)
    var tanggalSaja = formatWaktuSheet(new Date(), 'yyyy-MM-dd');
    absensiSheet.appendRow([
      tanggalSaja,         // A: Tanggal
      "'" + scannedNisn,  // B: NISN
      siswa.nama,         // C: Nama
      siswa.kelas,        // D: Kelas
      jamDatang,          // E: Jam Datang
      '',                 // F: Jam Pulang (kosong dulu)
      keteranganWaktu,    // G: Keterangan Waktu
      statusKehadiran,    // H: Status
      ''                  // I: Jam Sholat (kosong dulu, diisi saat mode sholat)
    ]);

    // Pesan konfirmasi & petunjuk langkah berikutnya
    let responseMessage = 'Absen masuk berhasil.';
    if (keteranganWaktu.includes('Terlambat')) {
      responseMessage = `Absen masuk berhasil (${keteranganWaktu}).`;
    }
    // Beri petunjuk scan berikutnya sesuai mode
    let nextStep = null;
    if (modeAbsen === 'masuk_pulang') {
      nextStep = 'Scan lagi nanti untuk absen pulang.';
    } else if (modeAbsen === 'masuk_sholat_pulang') {
      nextStep = 'Scan lagi untuk absen sholat, lalu absen pulang.';
    }

    return {
      success: true,
      message: responseMessage,
      type: 'datang',
      jamDatang,
      nama: siswa.nama,
      kelas: siswa.kelas,
      status: statusKehadiran,
      nextStep
    };

  } catch (error) {
    return { success: false, message: 'Terjadi kesalahan di server. Silakan coba lagi. (' + error.toString() + ')' };
  }
}

// ============================================================
// FUNGSI LOOKUP CEPAT — hanya ambil nama & kelas, TIDAK catat absensi
// Dipakai frontend saat scan sebelum submit kolektif
// ============================================================
function lookupSiswaForScan(nisn) {
  try {
    const ss = getSpreadsheet();
    const siswaSheet = ss.getSheetByName('siswa');
    const data = siswaSheet.getDataRange().getValues();
    const scannedNisn = String(nisn).trim();

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][1]).trim() === scannedNisn) {
        return {
          success: true,
          nama: data[i][0],
          nisn: data[i][1],
          kelas: data[i][8]
        };
      }
    }
    return { success: false, message: 'NISN tidak terdaftar.' };
  } catch (e) {
    return { success: false, message: 'Terjadi kesalahan. Silakan coba lagi. (' + e.toString() + ')' };
  }
}

// ============================================================
// FUNGSI BATCH ABSENSI — terima array NISN, proses sekaligus
// ============================================================
function batchScanAbsensi(nisnList, scannerRole, scannerKelas) {
  try {
    const ss = getSpreadsheet();
    const today = formatWaktuSheet(new Date(), 'yyyy-MM-dd');
    const nowTime = formatWaktuSheet(new Date(), 'HH:mm');

    // 1. Ambil konfigurasi jam
    const configResult = getAppConfig();
    const config = configResult.success ? configResult.data : {
      jam_masuk_akhir: '07:15',
      jam_pulang_mulai: '15:00',
      jam_pulang_akhir: '17:00'
    };

    // 2. Cek hari libur & terapkan jadwal hari ini
    const dayIndex = formatWaktuSheet(new Date(), 'u');
    const dayNames = {'1':'Senin','2':'Selasa','3':'Rabu','4':'Kamis','5':'Jumat','6':'Sabtu','7':'Minggu'};
    if (config.jadwal_harian) {
      const todaySchedule = config.jadwal_harian[dayIndex];
      if (!todaySchedule || todaySchedule.libur) {
        return { success: false, message: `Absensi ditutup. Hari ini jadwal libur: ${dayNames[dayIndex] || ''}.` };
      }
      config.jam_masuk_mulai  = todaySchedule.masuk_mulai  || config.jam_masuk_mulai;
      config.jam_masuk_akhir  = todaySchedule.masuk_akhir  || config.jam_masuk_akhir;
      config.jam_pulang_mulai = todaySchedule.pulang_mulai || config.jam_pulang_mulai;
      config.jam_pulang_akhir = todaySchedule.pulang_akhir || config.jam_pulang_akhir;
    } else if (dayIndex === '7') {
      return { success: false, message: 'Absensi ditutup. Hari ini libur: Minggu.' };
    }
    const liburSheet = ss.getSheetByName('hari_libur');
    if (liburSheet) {
      const liburData = liburSheet.getDataRange().getValues();
      for (let i = 1; i < liburData.length; i++) {
        if (liburData[i][0]) {
          if (formatWaktuSheet(new Date(liburData[i][0]), 'yyyy-MM-dd') === today) {
            return { success: false, message: 'Absensi ditutup. Hari ini libur: ' + liburData[i][1] + '.' };
          }
        }
      }
    }

    const absensiSheet = ss.getSheetByName('absensi');
    const siswaSheet   = ss.getSheetByName('siswa');

    // 3. Pre-load data siswa ke Map agar pencarian O(1)
    const siswaRaw = siswaSheet.getDataRange().getValues();
    const siswaMap = {};
    for (let i = 1; i < siswaRaw.length; i++) {
      siswaMap[String(siswaRaw[i][1]).trim()] = {
        nama: siswaRaw[i][0],
        nisn: siswaRaw[i][1],
        kelas: siswaRaw[i][8]
      };
    }

    // 4. Pre-load data absensi hari ini ke Map
    const absensiRaw = absensiSheet.getDataRange().getValues();
    const absensiMap = {}; // nisn -> { rowIndex, jamDatang, jamPulang }
    for (let i = 1; i < absensiRaw.length; i++) {
      const rowDate = absensiRaw[i][0];
      if (!rowDate) continue;
      const rowDateStr = formatWaktuSheet(new Date(rowDate), 'yyyy-MM-dd');
      if (rowDateStr === today) {
        absensiMap[String(absensiRaw[i][1]).trim()] = {
          rowIndex: i + 1, // 1-based untuk getRange
          jamDatang: absensiRaw[i][4],
          jamPulang: absensiRaw[i][5],
          keterangan: absensiRaw[i][6]
        };
      }
    }

    const results = [];
    const nowJam  = formatWaktuSheet(new Date(), 'HH:mm:ss');
    const rowsToAppend = [];

    for (let idx = 0; idx < nisnList.length; idx++) {
      const scannedNisn = String(nisnList[idx]).trim();
      if (!scannedNisn || scannedNisn === 'undefined') {
        results.push({ nisn: scannedNisn, success: false, message: 'NISN tidak valid.' });
        continue;
      }

      const siswa = siswaMap[scannedNisn];
      if (!siswa) {
        results.push({ nisn: scannedNisn, success: false, message: 'NISN tidak terdaftar.' });
        continue;
      }

      // Validasi kelas guru
      if (scannerRole === 'guru' && scannerKelas) {
        if (String(siswa.kelas).trim().toUpperCase() !== String(scannerKelas).trim().toUpperCase()) {
          results.push({ nisn: scannedNisn, nama: siswa.nama, kelas: siswa.kelas, success: false, message: `Siswa ini dari kelas ${siswa.kelas}, di luar kelas Anda.` });
          continue;
        }
      }

      const existing = absensiMap[scannedNisn];

      if (existing) {
        // Skenario PULANG
        if (existing.jamPulang) {
          results.push({ nisn: scannedNisn, nama: siswa.nama, kelas: siswa.kelas, success: false, message: 'Sudah absen pulang hari ini.' });
          continue;
        }
        if (nowTime > config.jam_pulang_akhir) {
          results.push({ nisn: scannedNisn, nama: siswa.nama, kelas: siswa.kelas, success: false, message: `Sudah melewati batas absen pulang (${config.jam_pulang_akhir}).` });
          continue;
        }
        let ketBaru = existing.keterangan || '';
        if (nowTime < config.jam_pulang_mulai) {
          ketBaru = (ketBaru ? ketBaru + ' & ' : '') + 'Pulang Cepat (Input: ' + (namaPengirim || 'Guru') + ')';
        }
        // Update langsung ke sheet
        absensiSheet.getRange(existing.rowIndex, 6).setValue(nowJam);
        absensiSheet.getRange(existing.rowIndex, 7).setValue(ketBaru);
        results.push({ nisn: scannedNisn, nama: siswa.nama, kelas: siswa.kelas, success: true, type: 'pulang', jamPulang: nowJam, message: 'Absen pulang berhasil' });

      } else {
        // Skenario DATANG — cek batas waktu dulu
        if (nowTime < config.jam_masuk_mulai) {
          results.push({ nisn: scannedNisn, nama: siswa.nama, kelas: siswa.kelas, success: false, message: `Absensi belum dibuka (mulai pukul ${config.jam_masuk_mulai}).` });
          continue;
        }
        if (nowTime > config.jam_pulang_akhir) {
          results.push({ nisn: scannedNisn, nama: siswa.nama, kelas: siswa.kelas, success: false, message: `Absensi sudah ditutup (lewat pukul ${config.jam_pulang_akhir}).` });
          continue;
        }
        let keterangan = 'Tepat Waktu';
        if (nowTime > config.jam_masuk_akhir) {
          const lateMinutes = calculateTimeDiff(config.jam_masuk_akhir, nowTime);
          keterangan = `Terlambat ${lateMinutes} menit`;
        }
        const msgDatang = keterangan.includes('Terlambat') ? `Absen masuk berhasil (${keterangan})` : 'Absen masuk berhasil';
        rowsToAppend.push([
          today,
          "'" + scannedNisn,
          siswa.nama,
          siswa.kelas,
          nowJam,
          '',
          keterangan,
          'Hadir'
        ]);
        results.push({ nisn: scannedNisn, nama: siswa.nama, kelas: siswa.kelas, success: true, type: 'datang', jamDatang: nowJam, message: msgDatang });
      }
    }

    // Batch append semua data datang sekaligus (jauh lebih cepat)
    if (rowsToAppend.length > 0) {
      const lastRow = absensiSheet.getLastRow();
      absensiSheet.getRange(lastRow + 1, 1, rowsToAppend.length, rowsToAppend[0].length).setValues(rowsToAppend);
    }

    return { success: true, results: results };

  } catch (e) {
    return { success: false, message: 'Terjadi kesalahan di server. Silakan coba lagi. (' + e.toString() + ')' };
  }
}

// Pastikan helper ini ada di paling bawah file code.gs
function calculateTimeDiff(startTime, endTime) {
  const [h1, m1] = startTime.split(':').map(Number);
  const [h2, m2] = endTime.split(':').map(Number);
  
  const totalMinutes1 = h1 * 60 + m1;
  const totalMinutes2 = h2 * 60 + m2;
  
  return totalMinutes2 - totalMinutes1;
}

function getAbsensiToday(nisn) {
  try {
    const ss = getSpreadsheet();
    const todayStr = formatWaktuSheet(new Date(), 'yyyy-MM-dd');
    
    // --- 1. CEK STATUS HARI LIBUR ---
    const liburSheet = ss.getSheetByName('hari_libur');
    let isLibur = false;
    let keteranganLibur = "";

    // A. Cek Jadwal Harian Per-Hari dari Konfigurasi
    const configResult = getAppConfig();
    const config = configResult.success ? configResult.data : {};
    const dayIndex = formatWaktuSheet(new Date(), 'u');
    const dayNames = {'1':'Senin','2':'Selasa','3':'Rabu','4':'Kamis','5':'Jumat','6':'Sabtu','7':'Minggu'};

    if (config.jadwal_harian) {
      const todaySchedule = config.jadwal_harian[dayIndex];
      if (!todaySchedule || todaySchedule.libur) {
        isLibur = true;
        keteranganLibur = "Libur Rutin: Hari " + (dayNames[dayIndex] || '');
      }
    } else if (dayIndex === '7') {
      isLibur = true;
      keteranganLibur = "Hari Minggu";
    }

    // B. Cek Database Tanggal Merah (prioritas lebih tinggi)
    if (liburSheet) {
      const liburData = liburSheet.getDataRange().getValues();
      for (let i = 1; i < liburData.length; i++) {
        if (!liburData[i][0]) continue;
        let tgl = formatWaktuSheet(new Date(liburData[i][0]), 'yyyy-MM-dd');
        if (tgl === todayStr) {
          isLibur = true;
          keteranganLibur = liburData[i][1];
          break;
        }
      }
    }
    // ------------------------------------------

    // --- 2. CARI DATA ABSENSI SISWA ---
    const sheet = ss.getSheetByName('absensi');
    const data = sheet.getDataRange().getValues();
    const searchNisn = String(nisn).trim();

    let absensiData = null;

    for (let i = 1; i < data.length; i++) {
      const rowDateCell = data[i][0];
      if (!rowDateCell) continue;
      
      const rowDateStr = formatWaktuSheet(new Date(rowDateCell), 'yyyy-MM-dd');
      const rowNisn = String(data[i][1]).trim();
      
      // Jika ketemu data absen hari ini untuk NISN tersebut
      if (rowDateStr === todayStr && rowNisn === searchNisn) {
        
        // Format Jam Datang
        let jamDatang = data[i][4];
        if (jamDatang instanceof Date) {
          jamDatang = formatWaktuSheet(jamDatang, 'HH:mm:ss');
        }
        
        // Format Jam Pulang
        let jamPulang = data[i][5];
        if (jamPulang instanceof Date) {
          jamPulang = formatWaktuSheet(jamPulang, 'HH:mm:ss');
        } else if (!jamPulang) {
          jamPulang = "";
        }

        absensiData = {
          tanggal: rowDateStr,
          jamDatang: jamDatang,
          jamPulang: jamPulang,
          status: data[i][7] // Kolom H (Status)
        };
        break; 
      }
    }

    // Kembalikan data absen BESERTA status libur
    return { 
      success: true, 
      data: absensiData,
      isLibur: isLibur,
      keteranganLibur: keteranganLibur
    };

  } catch (error) {
    return { success: false, message: 'Terjadi kesalahan. Silakan coba lagi. (' + error.toString() + ')' };
  }
}

// ====================================
// GANTI FUNCTION getAbsensiList LAMA DENGAN INI
// ====================================
function getAbsensiList(filter = {}) {
  try {
    const ss = getSpreadsheet();
    const siswaSheet = ss.getSheetByName('siswa');
    const absensiSheet = ss.getSheetByName('absensi');
    
    // 1. Ambil Data Master Siswa
    const rawSiswa = siswaSheet.getDataRange().getValues();
    let siswaList = [];
    
    // Filter Kelas pada level Siswa (support multi-kelas)
    const fKelas = filter.kelas || "";
    const fKelasList = fKelas
      ? String(fKelas).split(',').map(k => k.trim()).filter(Boolean)
      : [];
    
    for (let i = 1; i < rawSiswa.length; i++) {
      if (!rawSiswa[i][0]) continue;
      
      const sNama = rawSiswa[i][0];
      const sNisn = String(rawSiswa[i][1]).trim();
      const sKelas = String(rawSiswa[i][8]).trim();

      if (fKelasList.length > 0 && !fKelasList.includes(sKelas)) continue;

      siswaList.push({ nisn: sNisn, nama: sNama, kelas: sKelas });
    }
    
    // Urutkan siswa berdasarkan Nama
    siswaList.sort((a, b) => a.nama.localeCompare(b.nama));

    // 2. Ambil Data Transaksi Absensi
    const rawAbsen = absensiSheet.getDataRange().getValues();
    // Buat Mapping agar pencarian cepat: Key = "Tanggal_NISN"
    const absenMap = {}; 

    const fStart = filter.tanggalMulai || "";
    const fEnd = filter.tanggalAkhir || "";

    for (let i = 1; i < rawAbsen.length; i++) {
      if (!rawAbsen[i][0]) continue;
      
      const rawDate = new Date(rawAbsen[i][0]);
      const tglStr = formatWaktuSheet(rawDate, 'yyyy-MM-dd');
      
      // Filter Tanggal di awal untuk efisiensi
      if (fStart && tglStr < fStart) continue;
      if (fEnd && tglStr > fEnd) continue;

      const rowNisn = String(rawAbsen[i][1]).trim();
      const key = tglStr + '_' + rowNisn;

      // Format Jam
      let jamDatang = rawAbsen[i][4];
      if (jamDatang instanceof Date) jamDatang = formatWaktuSheet(jamDatang, 'HH:mm:ss');
      
      let jamPulang = rawAbsen[i][5];
      if (jamPulang && jamPulang instanceof Date) jamPulang = formatWaktuSheet(jamPulang, 'HH:mm:ss');

      absenMap[key] = {
        jamDatang: jamDatang || '-',
        jamPulang: jamPulang || '-',
        keterangan: rawAbsen[i][6] || '-',
        status: rawAbsen[i][7] || 'Hadir'
      };
    }

    // 3. Generate Result (Loop Tanggal x Loop Siswa)
    const result = [];
    
    // Tentukan range tanggal iterasi
    // Jika filter kosong, default tampilkan hari ini saja agar tidak berat
    const startDate = fStart ? new Date(fStart) : new Date();
    const endDate = fEnd ? new Date(fEnd) : new Date();
    
    // Loop setiap hari dalam rentang tanggal
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateStr = formatWaktuSheet(d, 'yyyy-MM-dd');
        
        // Loop setiap siswa
        for (let s = 0; s < siswaList.length; s++) {
            const siswa = siswaList[s];
            const key = dateStr + '_' + siswa.nisn;
            const dataAbsen = absenMap[key];

            if (dataAbsen) {
                // KASUS 1: Siswa Absen (Ada datanya)
                result.push({
                    tanggal: dateStr,
                    nisn: siswa.nisn,
                    nama: siswa.nama,
                    kelas: siswa.kelas,
                    jamDatang: dataAbsen.jamDatang,
                    jamPulang: dataAbsen.jamPulang,
                    keterangan: dataAbsen.keterangan,
                    status: dataAbsen.status
                });
            } else {
                // KASUS 2: Siswa Tidak Absen (Data kosong) -> Tampilkan sebagai Belum Absen/Alpha
                result.push({
                    tanggal: dateStr,
                    nisn: siswa.nisn,
                    nama: siswa.nama,
                    kelas: siswa.kelas,
                    jamDatang: "-",
                    jamPulang: "-",
                    keterangan: "-",
                    status: "Belum Absen" // Status default jika tidak ada data
                });
            }
        }
    }

    return { success: true, data: result };

  } catch (error) {
    return { success: false, message: 'Terjadi kesalahan. Silakan coba lagi. (' + error.toString() + ')' };
  }
}

function getKelasList() {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('siswa');
    const data = sheet.getDataRange().getValues();
    const kelasSet = new Set();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][8]) {
        kelasSet.add(data[i][8]);
      }
    }
    
    return { success: true, data: Array.from(kelasSet).sort() };
  } catch (error) {
    return { success: false, message: 'Terjadi kesalahan. Silakan coba lagi. (' + error.toString() + ')' };
  }
}

// ====================================
// HELPER: Styling Header Profesional
// ====================================
function applyProfessionalHeader(sheet, headerRange, bgColor, textColor) {
  // bg utama header
  headerRange.setBackground(bgColor)
    .setFontColor(textColor)
    .setFontWeight('bold')
    .setFontSize(11)
    .setFontFamily('Arial')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setWrap(false);

  // Border atas-bawah tegas, kiri-kanan tipis
  headerRange.setBorder(
    true, true, true, true, true, true,
    '#ffffff',
    SpreadsheetApp.BorderStyle.SOLID_MEDIUM
  );

  // Row height agar tidak terlalu mepet
  sheet.setRowHeight(1, 36);

  // Freeze baris header
  sheet.setFrozenRows(1);

  // Auto-resize semua kolom
  const numCols = headerRange.getNumColumns();
  for (let c = 1; c <= numCols; c++) {
    sheet.autoResizeColumn(c);
    // Minimal lebar 110px agar tidak terlalu sempit
    if (sheet.getColumnWidth(c) < 110) sheet.setColumnWidth(c, 110);
  }
}

function setupInitialData() {
  try {
    const ss = getSpreadsheet();

    // ── 1. Sheet 'users' ────────────────────────────────────────
    let usersSheet = ss.getSheetByName('users');
    if (!usersSheet) {
      usersSheet = ss.insertSheet('users');
      usersSheet.appendRow(['Username', 'Password', 'Role', 'Kelas']);

      // Data Default
      usersSheet.appendRow(['admin',  'admin123',  'admin', '']);
      usersSheet.appendRow(['guru1',  'guru123',   'guru',  'VI B']);
      usersSheet.appendRow(['wakel',  'wakel123',  'wakel', '']);
    }
    // Styling header – biru tua elegan
    applyProfessionalHeader(
      usersSheet,
      usersSheet.getRange(1, 1, 1, 4),
      '#1a3a5c', '#FFFFFF'
    );

    // ── 2. Sheet 'siswa' ────────────────────────────────────────
    let siswaSheet = ss.getSheetByName('siswa');
    if (!siswaSheet) {
      siswaSheet = ss.insertSheet('siswa');
      siswaSheet.appendRow([
        'Nama Lengkap', 'NISN', 'Jenis Kelamin', 'Tanggal Lahir',
        'Agama', 'Nama Ayah', 'Nama Ibu', 'No Handphone', 'Kelas', 'Alamat'
      ]);
      siswaSheet.appendRow([
        'Ahmad Rizki', '1234567890', 'Laki-laki', '2008-05-15',
        'Islam', 'Budi Santoso', 'Siti Aminah', '081234567890',
        'VI B', 'Jl. Merdeka No. 10, Bengkulu'
      ]);
    }
    // Styling header – hijau teal
    applyProfessionalHeader(
      siswaSheet,
      siswaSheet.getRange(1, 1, 1, 10),
      '#0d5c4a', '#FFFFFF'
    );

    // ── 3. Sheet 'absensi' ──────────────────────────────────────
    let absensiSheet = ss.getSheetByName('absensi');
    if (!absensiSheet) {
      absensiSheet = ss.insertSheet('absensi');
      absensiSheet.appendRow([
        'Tanggal', 'NISN', 'Nama', 'Kelas',
        'Jam Datang', 'Jam Pulang', 'Keterangan Waktu', 'Status', 'Jam Sholat'
      ]);
    }
    // Styling header – ungu gelap
    applyProfessionalHeader(
      absensiSheet,
      absensiSheet.getRange(1, 1, 1, 9),
      '#3b1f6b', '#FFFFFF'
    );

    // ── 4. Sheet 'hari_libur' ───────────────────────────────────
    let liburSheet = ss.getSheetByName('hari_libur');
    if (!liburSheet) {
      liburSheet = ss.insertSheet('hari_libur');
      liburSheet.appendRow(['Tanggal', 'Keterangan']);
      liburSheet.getRange('A:A').setNumberFormat('dd-MM-yyyy');
    }
    // Styling header – merah marun
    applyProfessionalHeader(
      liburSheet,
      liburSheet.getRange(1, 1, 1, 2),
      '#7b1c1c', '#FFFFFF'
    );

    // ── 5. Sheet 'konfigurasi' ──────────────────────────────────
    let configSheet = ss.getSheetByName('konfigurasi');
    if (!configSheet) {
      configSheet = ss.insertSheet('konfigurasi');

      // Header kolom A–C (pengaturan)
      configSheet.getRange(1, 1).setValue('Key');
      configSheet.getRange(1, 2).setValue('Value');
      configSheet.getRange(1, 3).setValue('Keterangan');

      // Default Config rows
      const defaultJadwal = {
        "1": {"libur":false,"masuk_mulai":"06:00","masuk_akhir":"07:15","pulang_mulai":"15:00","pulang_akhir":"17:00"},
        "2": {"libur":false,"masuk_mulai":"06:00","masuk_akhir":"07:15","pulang_mulai":"15:00","pulang_akhir":"17:00"},
        "3": {"libur":false,"masuk_mulai":"06:00","masuk_akhir":"07:15","pulang_mulai":"15:00","pulang_akhir":"17:00"},
        "4": {"libur":false,"masuk_mulai":"06:00","masuk_akhir":"07:15","pulang_mulai":"15:00","pulang_akhir":"17:00"},
        "5": {"libur":false,"masuk_mulai":"06:00","masuk_akhir":"07:15","pulang_mulai":"15:00","pulang_akhir":"17:00"},
        "6": {"libur":false,"masuk_mulai":"06:00","masuk_akhir":"07:15","pulang_mulai":"15:00","pulang_akhir":"17:00"},
        "7": {"libur":true, "masuk_mulai":"06:00","masuk_akhir":"07:15","pulang_mulai":"15:00","pulang_akhir":"17:00"}
      };
      configSheet.appendRow(['jadwal_harian', JSON.stringify(defaultJadwal), 'Jadwal per hari (JSON)']);
      // Mode absensi default
      configSheet.appendRow(['mode_absen', 'masuk_pulang', 'Mode: masuk_saja | masuk_pulang | masuk_sholat_pulang']);
    } else {
      // Jika sheet sudah ada tapi belum punya key mode_absen, tambahkan otomatis
      const existingConfigData = configSheet.getDataRange().getValues();
      const hasMode = existingConfigData.some(r => r[0] === 'mode_absen');
      if (!hasMode) {
        configSheet.appendRow(['mode_absen', 'masuk_pulang', 'Mode: masuk_saja | masuk_pulang | masuk_sholat_pulang']);
      }
    }

    // ── 6. Sheet 'absensi_sholat' ───────────────────────────────
    let sholatSheet = ss.getSheetByName('absensi_sholat');
    if (!sholatSheet) {
      sholatSheet = ss.insertSheet('absensi_sholat');
      sholatSheet.appendRow([
        'Tanggal', 'NISN', 'Nama', 'Kelas',
        'Waktu Sholat', 'Status', 'Keterangan', 'Input Oleh'
      ]);
    }
    // Styling header – hijau tua islami
    applyProfessionalHeader(
      sholatSheet,
      sholatSheet.getRange(1, 1, 1, 8),
      '#1a4731', '#FFFFFF'
    );

    // Header kolom E: Daftar Kelas (selalu pastikan ada, meski sheet sudah exist)
    const daftarKelasHeader = configSheet.getRange(1, 5);
    if (!daftarKelasHeader.getValue()) {
      daftarKelasHeader.setValue('Daftar Kelas');
    }

    // Styling header A–C (pengaturan) – slate abu-biru
    applyProfessionalHeader(
      configSheet,
      configSheet.getRange(1, 1, 1, 3),
      '#263445', '#FFFFFF'
    );

    // Styling header E (Daftar Kelas) – emas gelap, terpisah dan mencolok
    const kelasHeaderCell = configSheet.getRange(1, 5);
    kelasHeaderCell
      .setBackground('#7d5a00')
      .setFontColor('#FFFFFF')
      .setFontWeight('bold')
      .setFontSize(11)
      .setFontFamily('Arial')
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle')
      .setBorder(true, true, true, true, true, true, '#ffffff', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
    configSheet.setRowHeight(1, 36);
    configSheet.setColumnWidth(5, 130);
    // Kolom D sengaja dibiarkan kosong sebagai pemisah visual
    configSheet.setColumnWidth(4, 30);

    return { success: true, message: 'Setup database berhasil. Semua sheet sudah tertata rapi.' };
  } catch (error) {
    return { success: false, message: 'Terjadi kesalahan. Silakan coba lagi. (' + error.toString() + ')' };
  }
}

// ====================================
// ABSENSI SHOLAT
// ====================================

/**
 * Submit absensi sholat satu kelas untuk satu waktu sholat dan tanggal.
 * dataList: [{ nisn, nama, kelas, status, keterangan }]
 * waktuSholat: 'Subuh'|'Dhuha'|'Dzuhur'|'Ashar'|'Maghrib'|'Isya'
 */
function submitAbsensiSholat(dataList, tanggal, waktuSholat, namaPengirim) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('absensi_sholat');
    if (!sheet) return { success: false, message: 'Sheet "absensi_sholat" belum ada. Jalankan Setup terlebih dahulu.' };
    if (!dataList || !dataList.length) return { success: false, message: 'Belum ada data untuk disimpan.' };

    // ── CEK HARI LIBUR ────────────────────────────────────────────────────
    const todayStr = formatWaktuSheet(new Date(), 'yyyy-MM-dd');
    if (tanggal === todayStr) {
      const configResult = getAppConfig();
      const config = configResult.success ? configResult.data : {};
      const dayIndex = formatWaktuSheet(new Date(), 'u');
      const dayNames = {'1':'Senin','2':'Selasa','3':'Rabu','4':'Kamis','5':'Jumat','6':'Sabtu','7':'Minggu'};

      // Cek jadwal_harian
      if (config.jadwal_harian) {
        const sc = config.jadwal_harian[dayIndex];
        if (!sc || sc.libur) {
          return { success: false, message: `Hari ini libur (${dayNames[dayIndex]||''}). Absensi sholat tidak dapat diinput.` };
        }
      }

      // Cek tanggal merah di sheet hari_libur
      const liburSheet = ss.getSheetByName('hari_libur');
      if (liburSheet) {
        const liburData = liburSheet.getDataRange().getValues();
        for (let i = 1; i < liburData.length; i++) {
          if (!liburData[i][0]) continue;
          if (formatWaktuSheet(new Date(liburData[i][0]), 'yyyy-MM-dd') === todayStr) {
            return { success: false, message: `Hari ini libur: ${liburData[i][1]}. Absensi sholat tidak dapat diinput.` };
          }
        }
      }
    }
    // ─────────────────────────────────────────────────────────────────────

    const kelas = dataList[0].kelas;

    // Hapus data lama untuk kelas + tanggal + waktu sholat yang sama (timpa)
    const existing = sheet.getDataRange().getValues();
    const toDelete = [];
    for (let i = 1; i < existing.length; i++) {
      if (!existing[i][0]) continue;
      const rowDate   = formatWaktuSheet(new Date(existing[i][0]), 'yyyy-MM-dd');
      const rowKelas  = String(existing[i][3]).trim();
      const rowWaktu  = String(existing[i][4]).trim();
      const rowNisn   = String(existing[i][1]).replace(/^'/, '').trim();
      const inList    = dataList.some(d => String(d.nisn).trim() === rowNisn);
      if (rowDate === tanggal && rowKelas === kelas && rowWaktu === waktuSholat && inList) {
        toDelete.push(i + 1);
      }
    }
    for (let r = toDelete.length - 1; r >= 0; r--) sheet.deleteRow(toDelete[r]);

    // Tulis baris baru
    const newRows = dataList.map(d => [
      tanggal,
      "'" + String(d.nisn).trim(),
      d.nama,
      d.kelas,
      waktuSholat,
      d.status,        // 'Hadir' | 'Tidak Hadir'
      d.keterangan || '',
      namaPengirim || 'Guru'
    ]);

    if (newRows.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, 8).setValues(newRows);
    }

    return { success: true, message: `${newRows.length} data absen sholat berhasil disimpan.` };
  } catch (e) {
    return { success: false, message: 'Terjadi kesalahan. Silakan coba lagi. (' + e.toString() + ')' };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Ambil rekap absensi sholat.
 * filterKelas : string kelas atau null (semua)
 * filterBulan : 'yyyy-MM' atau null (hari ini)
 */
function getRekapSholat(filterKelas, filterBulan, filterWaktu) {
  try {
    const ss = getSpreadsheet();
    const sholatSheet = ss.getSheetByName('absensi_sholat');
    if (!sholatSheet) return { success: false, message: 'Sheet "absensi_sholat" tidak ditemukan.' };

    const today = formatWaktuSheet(new Date(), 'yyyy-MM-dd');
    const bulan = filterBulan || today.substring(0, 7);

    // 1. Baca semua catatan absensi sholat sesuai filter
    const sholatData = sholatSheet.getDataRange().getValues();
    const recordMap = {}; // key: "tanggal|nisn|waktu" -> record
    const dateWaktuKelasSet = new Set(); // key: "tanggal|waktu|kelas"

    for (let i = 1; i < sholatData.length; i++) {
      if (!sholatData[i][0]) continue;
      const rowDate  = formatWaktuSheet(new Date(sholatData[i][0]), 'yyyy-MM-dd');
      if (rowDate.substring(0, 7) !== bulan) continue;
      const rowKelas = String(sholatData[i][3]).trim();
      const rowWaktu = String(sholatData[i][4]).trim();
      if (filterKelas && rowKelas !== filterKelas) continue;
      if (filterWaktu && rowWaktu !== filterWaktu) continue;
      const nisn = String(sholatData[i][1]).replace(/^'/, '').trim();
      recordMap[rowDate + '|' + nisn + '|' + rowWaktu] = {
        tanggal    : rowDate,
        nisn       : nisn,
        nama       : sholatData[i][2],
        kelas      : rowKelas,
        waktuSholat: rowWaktu,
        status     : sholatData[i][5],
        keterangan : sholatData[i][6],
        inputOleh  : sholatData[i][7]
      };
      dateWaktuKelasSet.add(rowDate + '|' + rowWaktu + '|' + rowKelas);
    }

    // 2. Jika ada filter kelas, ambil semua siswa kelas itu
    //    untuk setiap kombinasi tanggal+waktu yang ada, siswa belum tercatat = "Belum Absen"
    const rows = Object.values(recordMap);

    if (filterKelas && dateWaktuKelasSet.size > 0) {
      const siswaSheet = ss.getSheetByName('siswa');
      if (siswaSheet) {
        const siswaData = siswaSheet.getDataRange().getValues();
        const siswaDiKelas = [];
        for (let i = 1; i < siswaData.length; i++) {
          if (!siswaData[i][0]) continue;
          const kelasRow = String(siswaData[i][8]).trim();
          if (kelasRow !== filterKelas) continue;
          siswaDiKelas.push({
            nisn : String(siswaData[i][1]).replace(/^'/, '').trim(),
            nama : String(siswaData[i][0])
          });
        }
        dateWaktuKelasSet.forEach(key => {
          const parts = key.split('|');
          const tgl = parts[0], wkt = parts[1];
          siswaDiKelas.forEach(s => {
            const mapKey = tgl + '|' + s.nisn + '|' + wkt;
            if (!recordMap[mapKey]) {
              rows.push({
                tanggal    : tgl,
                nisn       : s.nisn,
                nama       : s.nama,
                kelas      : filterKelas,
                waktuSholat: wkt,
                status     : 'Belum Absen',
                keterangan : '-',
                inputOleh  : '-'
              });
            }
          });
        });
      }
    }

    // Urutkan: tanggal asc -> urutan waktu sholat -> nama asc
    const waktuOrder = { Subuh:1, Dhuha:2, Dzuhur:3, Ashar:4, Maghrib:5, Isya:6 };
    rows.sort((a, b) => {
      if (a.tanggal !== b.tanggal) return a.tanggal.localeCompare(b.tanggal);
      const wa = waktuOrder[a.waktuSholat] || 9;
      const wb = waktuOrder[b.waktuSholat] || 9;
      if (wa !== wb) return wa - wb;
      return a.nama.localeCompare(b.nama);
    });

    return { success: true, data: rows };
  } catch (e) {
    return { success: false, message: 'Terjadi kesalahan. Silakan coba lagi. (' + e.toString() + ')' };
  }
}

/**
 * Ambil data absensi sholat untuk kelas+tanggal+waktu tertentu
 * (supaya frontend bisa pre-fill data yang sudah tersimpan)
 */
function getAbsensiSholatByKelas(kelas, tanggal, waktuSholat) {
  try {
    const ss    = getSpreadsheet();
    const sheet = ss.getSheetByName('absensi_sholat');
    if (!sheet) return { success: false, data: [] };

    const data = sheet.getDataRange().getValues();
    const map  = {}; // nisn -> {status, keterangan}
    for (let i = 1; i < data.length; i++) {
      if (!data[i][0]) continue;
      const rowDate  = formatWaktuSheet(new Date(data[i][0]), 'yyyy-MM-dd');
      const rowKelas = String(data[i][3]).trim();
      const rowWaktu = String(data[i][4]).trim();
      const kelasMatch = (String(kelas).toUpperCase() === 'SEMUA') ? true : (rowKelas === kelas);
      if (rowDate === tanggal && kelasMatch && rowWaktu === waktuSholat) {
        const nisn = String(data[i][1]).replace(/^'/, '').trim();
        map[nisn] = { status: data[i][5], keterangan: data[i][6] };
      }
    }
    return { success: true, data: map };
  } catch (e) {
    return { success: false, data: {} };
  }
}

// ====================================
// KELOLA HARI LIBUR (BARU)
// ====================================
function getHariLibur() {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('hari_libur');
    const data = sheet.getDataRange().getValues();
    const list = [];
    
    // Loop dari baris 1 (lewati header)
    for (let i = 1; i < data.length; i++) {
      if (data[i][0]) {
        let tgl = formatWaktuSheet(new Date(data[i][0]), 'yyyy-MM-dd');
        list.push({
          tanggal: tgl,
          keterangan: data[i][1]
        });
      }
    }
    // Urutkan tanggal descending
    list.sort((a, b) => b.tanggal.localeCompare(a.tanggal));
    return { success: true, data: list };
  } catch (error) {
    return { success: false, message: 'Terjadi kesalahan. Silakan coba lagi. (' + error.toString() + ')' };
  }
}

function addHariLibur(tanggal, keterangan) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('hari_libur');
    
    // Validasi input tanggal string (yyyy-mm-dd)
    // Langsung simpan string-nya, jangan di-convert ke new Date() di script
    sheet.appendRow([tanggal, keterangan]);
    
    // Format baris terakhir
    sheet.getRange(sheet.getLastRow(), 1).setNumberFormat("dd-MM-yyyy");

    return { success: true, message: 'Hari libur berhasil ditambahkan.' };
  } catch (error) {
    return { success: false, message: 'Terjadi kesalahan. Silakan coba lagi. (' + error.toString() + ')' };
  }
}

/**
 * Tambah hari libur untuk rentang tanggal (tanggalMulai s/d tanggalAkhir).
 * Tanggal yang sudah ada di sheet akan dilewati (tidak duplikat).
 * @param {string} tanggalMulai  - format yyyy-MM-dd
 * @param {string} tanggalAkhir  - format yyyy-MM-dd
 * @param {string} keterangan
 */
function addHariLiburRange(tanggalMulai, tanggalAkhir, keterangan) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('hari_libur');
    if (!sheet) return { success: false, message: 'Sheet "hari_libur" tidak ditemukan.' };

    // Validasi urutan tanggal
    if (tanggalAkhir < tanggalMulai) {
      return { success: false, message: 'Tanggal akhir tidak boleh sebelum tanggal mulai.' };
    }

    // Baca tanggal yang sudah ada agar tidak duplikat
    const existing = sheet.getDataRange().getValues();
    const existingSet = new Set();
    for (let i = 1; i < existing.length; i++) {
      if (!existing[i][0]) continue;
      try {
        existingSet.add(formatWaktuSheet(new Date(existing[i][0]), 'yyyy-MM-dd'));
      } catch(e) {}
    }

    // Loop dari tanggalMulai sampai tanggalAkhir, tambah satu per satu
    const rowsToAdd = [];
    const dMulai = new Date(tanggalMulai + 'T00:00:00');
    const dAkhir = new Date(tanggalAkhir + 'T00:00:00');
    let skipped = 0;

    for (let d = new Date(dMulai); d <= dAkhir; d.setDate(d.getDate() + 1)) {
      const dStr = formatWaktuSheet(d, 'yyyy-MM-dd');
      if (existingSet.has(dStr)) { skipped++; continue; }
      rowsToAdd.push([dStr, keterangan]);
    }

    if (rowsToAdd.length === 0) {
      return { success: false, message: `Semua ${skipped} tanggal sudah ada di daftar hari libur.` };
    }

    // Tulis sekaligus ke sheet
    const startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, rowsToAdd.length, 2).setValues(rowsToAdd);
    sheet.getRange(startRow, 1, rowsToAdd.length, 1).setNumberFormat('dd-MM-yyyy');

    const msg = skipped > 0
      ? `${rowsToAdd.length} hari libur berhasil ditambahkan (${skipped} tanggal sudah ada, dilewati).`
      : `${rowsToAdd.length} hari libur berhasil ditambahkan.`;

    return { success: true, message: msg, added: rowsToAdd.length, skipped };

  } catch (error) {
    return { success: false, message: 'Terjadi kesalahan. Silakan coba lagi. (' + error.toString() + ')' };
  }
}

function deleteHariLibur(tanggalStr) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('hari_libur');
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      let rowDate = formatWaktuSheet(new Date(data[i][0]), 'yyyy-MM-dd');
      if (rowDate === tanggalStr) {
        sheet.deleteRow(i + 1);
        return { success: true, message: 'Hari libur berhasil dihapus.' };
      }
    }
    return { success: false, message: 'Data hari libur tidak ditemukan.' };
  } catch (error) {
    return { success: false, message: 'Terjadi kesalahan. Silakan coba lagi. (' + error.toString() + ')' };
  }
}

// ====================================
// FITUR MONITORING & UPDATE STATUS (BARU)
// ====================================

// Function untuk mengambil data Monitoring (Versi Update: Pisah Terlambat & Pulang Cepat)
function getMonitoringRealtime(filterKelas = null) {
  try {
    const ss = getSpreadsheet();
    const todayStr = formatWaktuSheet(new Date(), 'yyyy-MM-dd');
    const siswaSheet = ss.getSheetByName('siswa');
    const dataSiswa = siswaSheet.getDataRange().getValues();
    const absensiSheet = ss.getSheetByName('absensi');
    const dataAbsensi = absensiSheet.getDataRange().getValues();
    
    // Mapping data absensi hari ini
    let absensiMap = {};
    for (let i = 1; i < dataAbsensi.length; i++) {
      let rowDate = dataAbsensi[i][0];
      if (!rowDate) continue; // Skip baris kosong

      let tgl = formatWaktuSheet(new Date(rowDate), 'yyyy-MM-dd');
      let nisn = String(dataAbsensi[i][1]).trim();
      
      if (tgl === todayStr) {
        absensiMap[nisn] = {
          jamDatang: dataAbsensi[i][4],
          jamPulang: dataAbsensi[i][5],
          keterangan: dataAbsensi[i][6], // Kolom G (Index 6) -> Terlambat/Tepat Waktu
          status: dataAbsensi[i][7]      // Kolom H (Index 7) -> Hadir/Sakit/Izin
        };
      }
    }

    // Support multi-kelas: filterKelas bisa string biasa atau "Kelas A,Kelas B"
    const filterKelasList = filterKelas
      ? String(filterKelas).split(',').map(k => k.trim()).filter(Boolean)
      : null;

    let result = [];
    for (let i = 1; i < dataSiswa.length; i++) {
      let nama = dataSiswa[i][0];
      let nisn = String(dataSiswa[i][1]).trim();
      let kelas = String(dataSiswa[i][8]).trim();

      // Filter Kelas (support multi)
      if (filterKelasList && filterKelasList.length > 0 && !filterKelasList.includes(kelas)) continue;
      
      let statusInfo = absensiMap[nisn];
      
      // Default Value (Jika siswa belum absen)
      let jamDatang = '-';
      let jamPulang = '-';
      let displayStatus = 'Belum Absen'; 
      let keteranganWaktu = '-';         

      if (statusInfo) {
        // 1. Ambil Jam
        if (statusInfo.jamDatang instanceof Date) {
            jamDatang = formatWaktuSheet(statusInfo.jamDatang, 'HH:mm');
        } else if (statusInfo.jamDatang) jamDatang = String(statusInfo.jamDatang);

        if (statusInfo.jamPulang instanceof Date) {
            jamPulang = formatWaktuSheet(statusInfo.jamPulang, 'HH:mm');
        } else if (statusInfo.jamPulang) jamPulang = String(statusInfo.jamPulang);

        // 2. Ambil Status & Keterangan LANGSUNG DARI SHEET
        // Kita tidak mengubah logika di sini, kita percaya data di Sheet sudah benar
        let rawKet = statusInfo.keterangan; 
        let rawStat = statusInfo.status;

        displayStatus = rawStat ? String(rawStat) : "";

        // Logika tampilan Keterangan Waktu
        if (rawKet && String(rawKet).trim() !== "") {
            // Jika di sheet ada tulisan (misal: "Terlambat (900 m)"), tampilkan itu
            keteranganWaktu = String(rawKet);
        } else {
            // Jika kosong di sheet, tapi status Hadir, anggap Tepat Waktu
            if (displayStatus === 'Hadir') {
                keteranganWaktu = 'Tepat Waktu';
            } else {
                keteranganWaktu = '-';
            }
        }
      }

      result.push({
        nama: nama,
        nisn: nisn,
        kelas: kelas,
        jamDatang: jamDatang,
        jamPulang: jamPulang,
        status: displayStatus,       // Dropdown
        keterangan: keteranganWaktu  // Kolom Teks (Terlambat/Tepat Waktu)
      });
    }

    // Sort: Kelas dulu, baru Nama
    result.sort((a, b) => {
      if (a.kelas === b.kelas) return a.nama.localeCompare(b.nama);
      return a.kelas.localeCompare(b.kelas);
    });
    
    return { success: true, data: result };

  } catch (error) {
    return { success: false, message: 'Terjadi kesalahan. Silakan coba lagi. (' + error.toString() + ')' };
  }
}

// 2. Update Status oleh Guru (Hadir/Izin/Sakit/Alpa)
function updateAbsensiStatus(token, nisn, nama, kelas, newStatus) {
  try {
    // SATPAM: Hanya Guru atau Admin yang boleh ubah status manual
    verifyUser(token, 'guru');
    
    const ss = getSpreadsheet();
    const absensiSheet = ss.getSheetByName('absensi');
    const todayStr = formatWaktuSheet(new Date(), 'yyyy-MM-dd');
    const data = absensiSheet.getDataRange().getValues();
    
    let found = false;
    let rowIndex = -1;

    for (let i = 1; i < data.length; i++) {
      let tgl = formatWaktuSheet(new Date(data[i][0]), 'yyyy-MM-dd');
      let rowNisn = String(data[i][1]).trim();
      
      if (tgl === todayStr && rowNisn === String(nisn).trim()) {
        found = true;
        rowIndex = i + 1;
        break;
      }
    }

    if (found) {
      // PERBAIKAN 1: Ubah dari kolom 7 ke kolom 8
      // Kolom 7 = Keterangan Waktu
      // Kolom 8 = Status (Hadir/Sakit/Izin/Alpa)
      absensiSheet.getRange(rowIndex, 8).setValue(newStatus); 
    } else {
      let jamDatang = '-';
      if (newStatus === 'Hadir') {
        jamDatang = formatWaktuSheet(new Date(), 'HH:mm:ss');
      }
      
      // PERBAIKAN 2: Sesuaikan urutan array appendRow agar masuk ke kolom yang benar
      // Struktur: [Tanggal, NISN, Nama, Kelas, JamDt, JamPlg, Keterangan(Col 7), Status(Col 8)]
      // Kita isi Keterangan (Col 7) dengan "-" atau kosong, lalu Status (Col 8) dengan newStatus
      var tanggalSaja = formatWaktuSheet(new Date(), 'yyyy-MM-dd');
      absensiSheet.appendRow([
       tanggalSaja,
        "'" + nisn, 
        nama, 
        kelas, 
        jamDatang, 
        '',   // Jam Pulang
        '-',  // Kolom 7 (Keterangan Waktu) -> Diisi strip agar tidak error
        newStatus // Kolom 8 (Status Kehadiran) -> Target yang benar
      ]);
    }

    return { success: true, message: 'Status kehadiran berhasil diperbarui.' };
  } catch (error) {
    return { success: false, message: 'Gagal menyimpan perubahan. Silakan coba lagi. (' + error.message + ')' };
  }
}

function updateHariLibur(oldDateStr, newDateStr, newKeterangan) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('hari_libur');
    const data = sheet.getDataRange().getValues();
    
    let found = false;
    
    // Loop dari baris 1 (lewati header)
    for (let i = 1; i < data.length; i++) {
      // Format tanggal dari sheet agar sama dengan format string input (yyyy-MM-dd)
      let rowDate = formatWaktuSheet(new Date(data[i][0]), 'yyyy-MM-dd');
      
      if (rowDate === oldDateStr) {
        // Update baris: Kolom 1 (Tanggal), Kolom 2 (Keterangan)
        // Gunakan new Date() untuk kolom tanggal agar format di sheet tetap Date Object
        sheet.getRange(i + 1, 1, 1, 2).setValues([[new Date(newDateStr), newKeterangan]]);
        found = true;
        break;
      }
    }
    
    if (found) {
      return { success: true, message: 'Hari libur berhasil diperbarui.' };
    } else {
      return { success: false, message: 'Data tanggal sebelumnya tidak ditemukan.' };
    }
    
  } catch (error) {
    return { success: false, message: 'Terjadi kesalahan. Silakan coba lagi. (' + error.toString() + ')' };
  }
}

// ====================================
// FITUR EXPORT EXCEL
// ====================================


function getExportData(type, filters) {
  const ss = getSpreadsheet();
  
  // ==========================================
  // LOGIKA UMUM: MAPPING HARI LIBUR
  // ==========================================
  const liburSheet = ss.getSheetByName('hari_libur');
  const holidayMap = {};
  
  if (liburSheet) {
      const liburData = liburSheet.getDataRange().getValues();
      for (let i = 1; i < liburData.length; i++) {
          if (liburData[i][0]) {
              try {
                  let tglLibur = formatWaktuSheet(new Date(liburData[i][0]), 'yyyy-MM-dd');
                  holidayMap[tglLibur] = liburData[i][1];
              } catch(e) {}
          }
      }
  }

  // Load jadwal_harian untuk cek libur rutin (Sabtu, dll)
  const _cfgEx = getAppConfig();
  const _jadwalEx = (_cfgEx.success && _cfgEx.data.jadwal_harian) ? _cfgEx.data.jadwal_harian : null;
  // Helper: JS getDay() (0=Min,1=Sen,...,6=Sab) → cek libur di jadwal_harian
  function isRoutineHoliday(jsDay) {
    if (!_jadwalEx) return jsDay === 0;
    const key = jsDay === 0 ? '7' : String(jsDay);
    const sc = _jadwalEx[key];
    return !sc || sc.libur === true;
  }
  function getRoutineHolidayName(jsDay) {
    const names = {'0':'Hari Minggu','1':'Senin','2':'Selasa','3':'Rabu','4':'Kamis','5':'Jumat','6':'Sabtu','7':'Hari Minggu'};
    const key = jsDay === 0 ? '7' : String(jsDay);
    return 'Libur Rutin: ' + (names[key] || '');
  }

  // ==========================================
  // LOGIKA DATA: LAPORAN & MONITORING (DIGABUNG)
  // ==========================================
  // Karena sekarang Monitoring juga butuh rentang waktu dan multi-sheet,
  // kita gunakan logika yang sama untuk keduanya.
  if (type === 'laporan_absensi' || type === 'monitoring') {
    const siswaSheet = ss.getSheetByName('siswa');
    const absensiSheet = ss.getSheetByName('absensi');
    
    // --- A. AMBIL DATA SISWA ---
    const rawSiswa = siswaSheet.getDataRange().getValues();
    const siswaList = [];
    const fKelas = filters.kelas || ""; // Filter kelas
    // Support multi-kelas: "X IPA 1" atau "X IPA 1,X IPA 2"
    const fKelasList = fKelas
      ? String(fKelas).split(',').map(k => k.trim()).filter(Boolean)
      : [];

    for (let i = 1; i < rawSiswa.length; i++) {
      if (!rawSiswa[i][0]) continue; // Skip header/kosong
      
      const sNama = rawSiswa[i][0];
      const sNisn = String(rawSiswa[i][1]).trim();
      const sKelas = String(rawSiswa[i][8]).trim();
      
      // Filter Kelas (support multi)
      if (fKelasList.length > 0 && !fKelasList.includes(sKelas)) continue;
      
      siswaList.push({ nisn: sNisn, nama: sNama, kelas: sKelas });
    }
    
    // Urutkan: Kelas dulu, baru Nama
    siswaList.sort((a, b) => {
        if (a.kelas === b.kelas) return a.nama.localeCompare(b.nama);
        return a.kelas.localeCompare(b.kelas);
    });

    // --- B. MAPPING DATA ABSENSI ---
    const rawAbsen = absensiSheet.getDataRange().getValues();
    const absenMap = {};
    
    for (let i = 1; i < rawAbsen.length; i++) {
      if (!rawAbsen[i][0]) continue;
      
      const tglStr = formatWaktuSheet(new Date(rawAbsen[i][0]), 'yyyy-MM-dd');
      const nisn = String(rawAbsen[i][1]).trim();
      const key = tglStr + '_' + nisn;

      let jamDatang = rawAbsen[i][4];
      if (jamDatang instanceof Date) jamDatang = formatWaktuSheet(jamDatang, 'HH:mm:ss');
      else if (jamDatang) jamDatang = String(jamDatang);
      
      let jamPulang = rawAbsen[i][5];
      if (jamPulang && jamPulang instanceof Date) jamPulang = formatWaktuSheet(jamPulang, 'HH:mm:ss');
      else if (jamPulang) jamPulang = String(jamPulang);

      absenMap[key] = {
        jamDatang: jamDatang || '-',
        jamPulang: jamPulang || '-',
        keterangan: rawAbsen[i][6] || '-',
        status: rawAbsen[i][7] || 'Hadir'
      };
    }

    // --- C. GENERATE DATA (LOOP TANGGAL) ---
    // Gunakan tanggal hari ini sebagai fallback jika filter kosong
    const today = new Date();
    const start = filters.tanggalMulai ? new Date(filters.tanggalMulai) : today;
    const end = filters.tanggalAkhir ? new Date(filters.tanggalAkhir) : today;
    
    const logData = [];
    let noLog = 1;
    const rekapData = [];
    const dateHeaders = [];

    // 1. Siapkan Header Tanggal untuk Sheet 2 (Rekap)
    // Loop temp untuk header
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        dateHeaders.push(d.getDate());
    }

    // 2. Loop Utama (Siswa x Tanggal)
    // Reset tanggal loop karena loop header di atas sudah memajukan tanggal 'd'
    const loopStart = new Date(start);
    const loopEnd = new Date(end);
    const todayStr = formatWaktuSheet(new Date(), 'yyyy-MM-dd');

    for (let s = 0; s < siswaList.length; s++) {
        const siswa = siswaList[s];
        let countSakit = 0, countIzin = 0, countAlpha = 0;
        
        // Baris Awal Rekap (No, Nama, NISN, Kelas)
        const rowRekap = [s + 1, siswa.nama, "'" + siswa.nisn, siswa.kelas];

        // Loop Tanggal
        for (let d = new Date(loopStart); d <= loopEnd; d.setDate(d.getDate() + 1)) {
            const dateStr = formatWaktuSheet(d, 'yyyy-MM-dd');
            const dateDisplay = formatWaktuSheet(d, 'dd-MM-yyyy');
            const holidayName = holidayMap[dateStr];
            // Cek libur rutin dari jadwal_harian (termasuk Sabtu, dll)
            const isRoutineOff = isRoutineHoliday(d.getDay());
            const key = dateStr + '_' + siswa.nisn;
            const dataAbsen = absenMap[key];

            let statusFinal = '', ketFinal = '', codeDisplay = '';
            let jamDt = '-', jamPlg = '-';

            if (dataAbsen) {
                // KASUS 1: Ada Data Absen
                statusFinal = dataAbsen.status;
                ketFinal = dataAbsen.keterangan;
                jamDt = dataAbsen.jamDatang;
                jamPlg = dataAbsen.jamPulang;
            } else {
                // KASUS 2: Tidak Ada Data
                if (holidayName) { 
                    statusFinal = 'Libur'; 
                    ketFinal = holidayName; 
                } else if (isRoutineOff) { 
                    // Libur rutin dari jadwal_harian (Sabtu, Minggu, dll)
                    statusFinal = 'Libur'; 
                    ketFinal = getRoutineHolidayName(d.getDay()); 
                } else { 
                    // Cek Masa Depan
                    if (dateStr > todayStr) {
                         statusFinal = ''; // Kosongkan jika tanggal belum terjadi
                    } else {
                         statusFinal = 'Belum Absen'; 
                         ketFinal = 'Tanpa Keterangan';
                    }
                }
            }
            
            // Rapikan keterangan jika kosong tapi hadir
            if ((!ketFinal || ketFinal === '-') && statusFinal === 'Hadir') {
                ketFinal = 'Tepat Waktu';
            }

            // Hitung Kode Matrix (Sheet 2) & Statistik
            if (statusFinal === 'Hadir') codeDisplay = 'H';
            else if (statusFinal === 'Sakit') { codeDisplay = 'S'; countSakit++; }
            else if (statusFinal === 'Izin') { codeDisplay = 'I'; countIzin++; }
            else if (statusFinal === 'Alpha' || statusFinal === 'Belum Absen' || statusFinal === 'Alpa') { codeDisplay = 'A'; countAlpha++; }
            else if (statusFinal === 'Libur') codeDisplay = 'L';
            else codeDisplay = '-';

            // Masukkan ke Log Detail (Sheet 1)
            // Hanya masukkan jika status tidak kosong (bukan masa depan) atau jika user ingin semua
            if (statusFinal !== '') {
                logData.push([
                    noLog++, dateDisplay, "'" + siswa.nisn, siswa.nama, siswa.kelas,
                    jamDt, jamPlg, ketFinal, statusFinal
                ]);
            }

            // Masukkan Kode ke Baris Rekap (Sheet 2)
            rowRekap.push(codeDisplay);
        }
        
        // Reset tanggal loop untuk iterasi siswa berikutnya
        // (Penting: d.setDate mengubah object Date asli, jadi harus di-reset manual atau buat object baru setiap loop)
        // Cara paling aman di Google Apps Script:
        // Kita tidak perlu reset manual jika loop tanggal ada DI DALAM loop siswa dan menggunakan variabel baru
        // TAPI karena loop di atas menggunakan variabel 'd' yg dideklarasikan di for, kita perlu reset logicnya.
        // *Perbaikan Logic Loop*:
        // Di atas saya pakai `d = new Date(loopStart)` di awal loop siswa tapi sintaks for loop `d <= loopEnd` 
        // akan mengubah `d` sampai akhir. Jadi untuk siswa berikutnya `d` harus di-init ulang.
        
        // Karena logic di atas pakai `for` standar, `d` akan di-reinitialisasi di setiap iterasi `siswaList` 
        // KARENA saya menaruh `for (let d = new Date(loopStart)...` DI DALAM loop siswa. 
        // Jadi logic ini SUDAH BENAR.

        // Tambahkan Total Statistik ke Baris Rekap
        rowRekap.push(countSakit, countIzin, countAlpha);
        rekapData.push(rowRekap);
    }

    const titleSheet1 = (type === 'monitoring') ? 'Data Monitoring' : 'Detail Log';

    return {
        mode: 'multi_sheet',
        periode: `${formatWaktuSheet(start, 'dd MMM yyyy')} - ${formatWaktuSheet(end, 'dd MMM yyyy')}`,
        sheet1: { name: titleSheet1, data: logData },
        sheet2: { name: 'Rekap Absensi', data: rekapData, dateHeaders: dateHeaders }
    };
  }
  
  return [];
}

function generateExcel(type, filters) {
  try {
    var timestamp = formatWaktuSheet(new Date(), 'dd-MM-yyyy HHmm');
    var fileName = "";
    var ss;
    
    // --- SKENARIO 1: LAPORAN BULANAN (FORMAT MATRIKS) ---
    if (type === 'laporan_bulanan') {
        var monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
        fileName = "Rekap Absensi " + monthNames[filters.bulan] + " " + filters.tahun + " - " + timestamp;
        
        ss = SpreadsheetApp.create(fileName);
        
        var res = getMonthlyReportData(filters.bulan, filters.tahun, filters.kelas);
        if (!res.success) throw new Error(res.message);
        
        var data = res.data;
        var sheet = ss.getSheetByName('Sheet1');
        sheet.setName('Rekap Bulanan');

        // 1. HEADER JUDUL (Tanpa Merge agar aman)
        sheet.getRange("A1").setValue("REKAPITULASI KEHADIRAN BULANAN").setFontWeight("bold").setFontSize(14);
        sheet.getRange("A2").setValue("Bulan: " + monthNames[filters.bulan] + " " + filters.tahun).setFontWeight("bold").setFontSize(11);
        
        // 2. SETUP HEADER TABEL
        var startRow = 4;
        sheet.getRange(startRow, 1).setValue("No");
        sheet.getRange(startRow, 2).setValue("Nama Siswa");
        sheet.getRange(startRow, 3).setValue("NISN");
        
        // Variable untuk menyimpan index kolom libur
        var holidayCols = [];
        var daysCount = data.daysInMonth;
        
        // Ambil sample data libur dari siswa pertama (jika ada)
        // Atau hitung ulang manual jika data kosong (tapi biasanya loop tetap jalan)
        var sampleDaily = (data.students.length > 0) ? data.students[0].dailyCodes : [];

        // Loop Header Tanggal
        for(var d=1; d<=daysCount; d++){
            var colIndex = 3 + d;
            var cell = sheet.getRange(startRow, colIndex);
            cell.setValue(d);
            
            // Cek Libur dari Data
            // (index sampleDaily adalah d-1)
            if (sampleDaily.length >= d && sampleDaily[d-1].isHoliday) {
                holidayCols.push(colIndex); // Simpan index kolom libur
                // Warnai Header Tanggal Merah
                cell.setBackground('#FFEBEE').setFontColor('#D32F2F'); 
            }
        }
        
        // Header Statistik
        var colStat = 3 + daysCount + 1;
        var headersStat = ["H", "S", "I", "A", "%"];
        sheet.getRange(startRow, colStat, 1, 5).setValues([headersStat]);

        // Style Header Utama (Biru)
        // Kecuali kolom tanggal yang sudah diwarnai merah tadi, kita timpa warna default biru
        // Tapi agar rapi, kita set biru dulu semua, baru timpa merah untuk libur
        var totalCols = colStat + 4;
        
        // Set Default Biru untuk semua
        sheet.getRange(startRow, 1, 1, totalCols)
             .setBackground('#4F46E5')
             .setFontColor('#FFFFFF')
             .setFontWeight('bold')
             .setHorizontalAlignment('center')
             .setBorder(true, true, true, true, true, true, '#FFFFFF', SpreadsheetApp.BorderStyle.SOLID);

        // TIMPA WARNA HEADER HARI LIBUR (Merah Muda)
        if (holidayCols.length > 0) {
            for (var k = 0; k < holidayCols.length; k++) {
                sheet.getRange(startRow, holidayCols[k])
                     .setBackground('#FFEBEE') // Background Merah Muda
                     .setFontColor('#D32F2F'); // Teks Merah Tua
            }
        }
        
        // 3. ISI DATA
        var rows = [];
        data.students.forEach((siswa, idx) => {
            var row = [idx + 1, siswa.nama, "'" + siswa.nisn];
            siswa.dailyCodes.forEach(day => {
                row.push(day.code); 
            });
            row.push(siswa.stats.h, siswa.stats.s, siswa.stats.i, siswa.stats.a, siswa.stats.percent + "%");
            rows.push(row);
        });

        if(rows.length > 0) {
            var startBody = startRow + 1;
            var numRows = rows.length;
            
            sheet.getRange(startBody, 1, numRows, rows[0].length).setValues(rows);
            
            // Formatting Body
            var bodyRange = sheet.getRange(startBody, 1, numRows, totalCols);
            bodyRange.setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);
            bodyRange.setHorizontalAlignment('center');
            sheet.getRange(startBody, 2, numRows, 1).setHorizontalAlignment('left'); 

            // WARNAI KOLOM LIBUR SECARA VERTIKAL (Full Column Color)
            if (holidayCols.length > 0) {
                for (var k = 0; k < holidayCols.length; k++) {
                    // Warnai dari baris data pertama sampai terakhir pada kolom tersebut
                    sheet.getRange(startBody, holidayCols[k], numRows, 1)
                         .setBackground('#FFEBEE'); // Merah Muda Lembut
                }
            }

            // Conditional Formatting (Warna Kode Absen)
            var rangeDataDays = sheet.getRange(startBody, 4, numRows, daysCount);
            var rules = sheet.getConditionalFormatRules();
            
            // A = Alpha (Background Merah, Text Putih/MerahTua agar kontras dari libur)
            rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo("A")
                .setBackground("#EF4444") // Merah Terang
                .setFontColor("#FFFFFF")  // Putih
                .setBold(true)
                .setRanges([rangeDataDays]).build());
                
            // S = Sakit (Kuning)
            rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo("S")
                .setBackground("#FEF08A").setFontColor("#854D0E").setBold(true).setRanges([rangeDataDays]).build());
                
            // I = Izin (Biru)
            rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo("I")
                .setBackground("#BFDBFE").setFontColor("#1E40AF").setBold(true).setRanges([rangeDataDays]).build());

            // L = Libur (Text Only, background sudah dihandle via kolom vertikal di atas)
            // Kita samarkan text "L" jika ada, agar menyatu dengan background
            rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo("L")
                .setFontColor("#EF9A9A") // Merah pudar
                .setRanges([rangeDataDays]).build());

            sheet.setConditionalFormatRules(rules);
        }

        // Lebar Kolom
        sheet.setColumnWidth(1, 40); 
        sheet.setColumnWidth(2, 200); 
        sheet.setColumnWidth(3, 100); 
        for(var c=4; c<=3+daysCount; c++){
            sheet.setColumnWidth(c, 28);
        }
        
        sheet.setFrozenRows(4);
        sheet.setFrozenColumns(2); 
    }
    
    // --- SKENARIO 2: LOGIKA LAMA (Monitoring Realtime) ---
    else {
        if (type === 'laporan_absensi') fileName = "Laporan Absensi - " + timestamp;
        else fileName = "Monitoring Realtime - " + timestamp;
        
        ss = SpreadsheetApp.create(fileName);
        generateExcelOldLogic(type, filters, ss, fileName);
    }

    var fileId = ss.getId();
    var file = DriveApp.getFileById(fileId);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    return { success: true, url: "https://docs.google.com/spreadsheets/d/" + fileId + "/export?format=xlsx" };

  } catch (e) {
    return { success: false, message: 'Gagal membuat file Excel. Silakan coba lagi. (' + e.toString() + ')' };
  }
}

// ==========================================
// HELPER: LOGIKA LAMA (Monitoring & Laporan Harian)
// ==========================================
function generateExcelOldLogic(type, filters, ss, fileName) {
    var exportData = getExportData(type, filters);

    if (exportData.mode === 'multi_sheet') {
        
        // --- SHEET 1: DETAIL LOG ---
        var sheet1 = ss.getSheetByName('Sheet1');
        sheet1.setName(exportData.sheet1.name);
        
        var headers1 = ["No", "Tanggal", "NISN", "Nama Siswa", "Kelas", "Jam Datang", "Jam Pulang", "Keterangan", "Status"];
        sheet1.getRange(1, 1, 1, headers1.length)
              .setValues([headers1])
              .setFontWeight('bold')
              .setBackground('#4F46E5') // Indigo
              .setFontColor('#FFFFFF');

        if (exportData.sheet1.data.length > 0) {
            var dataRows = exportData.sheet1.data;
            var numRows = dataRows.length;
            var numCols = headers1.length;

            // 1. Tulis Data
            sheet1.getRange(2, 1, numRows, numCols).setValues(dataRows);
            
            // 2. Border
            sheet1.getRange(1, 1, numRows + 1, numCols).setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);

            // 3. WARNA KHUSUS HARI LIBUR
            for (var i = 0; i < numRows; i++) {
                // Kolom Status ada di index 8 (Urutan ke-9)
                var status = dataRows[i][8]; 
                
                if (status === 'Libur') {
                    var rangeRow = sheet1.getRange(i + 2, 1, 1, numCols);
                    rangeRow.setBackground('#FEE2E2') // Merah Muda
                            .setFontColor('#991B1B')  // Merah Tua
                            .setFontWeight('bold');   
                }
            }
        }
        sheet1.autoResizeColumns(1, headers1.length);
        sheet1.setFrozenRows(1);

        // --- SHEET 2: REKAP ABSENSI ---
        var sheet2 = ss.insertSheet(exportData.sheet2.name);
        var rekapRows = exportData.sheet2.data;
        var dates = exportData.sheet2.dateHeaders; 
        
        var datesLen = (dates && Array.isArray(dates)) ? dates.length : 0;
        var totalCols = 4 + datesLen + 3; 
        var safeMergeCols = Math.max(1, Math.min(totalCols, 20)); 
        
        // Judul & Periode
        var titleText = (type === 'laporan_absensi') ? "REKAPITULASI KEHADIRAN SISWA" : "MONITORING KEHADIRAN HARIAN";
        sheet2.getRange(1, 1, 1, safeMergeCols).merge().setValue(titleText).setFontWeight("bold").setFontSize(16).setHorizontalAlignment("center").setVerticalAlignment("middle").setFontColor("#1e3a8a");
        sheet2.getRange(2, 1, 1, safeMergeCols).merge().setValue("Periode: " + exportData.periode).setFontWeight("bold").setFontSize(11).setHorizontalAlignment("center");

        // Header Table
        var startRowHead = 4;
        sheet2.getRange(startRowHead + 1, 1).setValue("No");
        sheet2.getRange(startRowHead + 1, 2).setValue("Nama Siswa");
        sheet2.getRange(startRowHead + 1, 3).setValue("NISN");
        sheet2.getRange(startRowHead + 1, 4).setValue("Kelas");
        
        // Merge Header Vertikal
        sheet2.getRange(startRowHead, 1, 2, 1).merge().setVerticalAlignment("middle");
        sheet2.getRange(startRowHead, 2, 2, 1).merge().setVerticalAlignment("middle");
        sheet2.getRange(startRowHead, 3, 2, 1).merge().setVerticalAlignment("middle");
        sheet2.getRange(startRowHead, 4, 2, 1).merge().setVerticalAlignment("middle");

        // Header Tanggal
        if (datesLen > 0) {
             sheet2.getRange(startRowHead + 1, 5, 1, datesLen).setValues([dates]);
             sheet2.getRange(startRowHead, 5, 1, datesLen).merge().setValue("TANGGAL").setHorizontalAlignment("center").setVerticalAlignment("middle");
        } else {
             sheet2.getRange(startRowHead, 5).setValue("TANGGAL (0 Hari)");
        }

        // Header Jumlah
        var startColJumlah = 5 + datesLen;
        sheet2.getRange(startRowHead + 1, startColJumlah).setValue("S");
        sheet2.getRange(startRowHead + 1, startColJumlah + 1).setValue("I");
        sheet2.getRange(startRowHead + 1, startColJumlah + 2).setValue("A");
        sheet2.getRange(startRowHead, startColJumlah, 1, 3).merge().setValue("JUMLAH").setHorizontalAlignment("center").setVerticalAlignment("middle");

        // Style Header Area
        sheet2.getRange(startRowHead, 1, 2, totalCols).setBackground('#1e3a8a').setFontColor('#FFFFFF').setFontWeight('bold').setHorizontalAlignment('center').setBorder(true, true, true, true, true, true, '#FFFFFF', SpreadsheetApp.BorderStyle.SOLID);

        // Body Table
        var startRowBody = 6;
        if (rekapRows.length > 0) {
            sheet2.getRange(startRowBody, 1, rekapRows.length, rekapRows[0].length).setValues(rekapRows);
            
            var bodyRange = sheet2.getRange(startRowBody, 1, rekapRows.length, totalCols);
            bodyRange.setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);
            bodyRange.setHorizontalAlignment('center'); 
            sheet2.getRange(startRowBody, 2, rekapRows.length, 1).setHorizontalAlignment('left'); 

            // Zebra Striping
            for (var i = 0; i < rekapRows.length; i++) {
                if (i % 2 === 1) sheet2.getRange(startRowBody + i, 1, 1, totalCols).setBackground('#F3F4F6');
            }

            // Conditional Formatting Kode
            if (datesLen > 0) {
                var rules = sheet2.getConditionalFormatRules();
                var rangeKode = sheet2.getRange(startRowBody, 5, rekapRows.length, datesLen);

                rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo("A").setBackground("#FEE2E2").setFontColor("#991B1B").setBold(true).setRanges([rangeKode]).build());
                rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo("S").setBackground("#FEF9C3").setFontColor("#854D0E").setBold(true).setRanges([rangeKode]).build());
                rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo("I").setBackground("#DBEAFE").setFontColor("#1E40AF").setBold(true).setRanges([rangeKode]).build());
                rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo("L").setBackground("#4B5563").setFontColor("#FFFFFF").setRanges([rangeKode]).build());

                sheet2.setConditionalFormatRules(rules);
            }
        }
        
        // Lebar Kolom
        sheet2.setColumnWidth(1, 35);  
        sheet2.setColumnWidth(2, 250); 
        sheet2.setColumnWidth(3, 100); 
        sheet2.setColumnWidth(4, 60);  
        for(var c = 0; c < datesLen; c++) {
            sheet2.setColumnWidth(5 + c, 32);
        }
        sheet2.setFrozenRows(5);
    }
    // Fallback Mode
    else {
        var sheet = ss.getSheetByName('Sheet1');
        if(exportData && exportData.length > 0) {
           sheet.getRange(1, 1, exportData.length, exportData[0].length).setValues(exportData);
        }
    }
}

function getAppConfig() {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('konfigurasi');
    // Default config jika sheet belum ada/kosong
    const defaultJadwal = {
      "1": {"libur":false,"masuk_mulai":"06:00","masuk_akhir":"07:15","pulang_mulai":"15:00","pulang_akhir":"17:00"},
      "2": {"libur":false,"masuk_mulai":"06:00","masuk_akhir":"07:15","pulang_mulai":"15:00","pulang_akhir":"17:00"},
      "3": {"libur":false,"masuk_mulai":"06:00","masuk_akhir":"07:15","pulang_mulai":"15:00","pulang_akhir":"17:00"},
      "4": {"libur":false,"masuk_mulai":"06:00","masuk_akhir":"07:15","pulang_mulai":"15:00","pulang_akhir":"17:00"},
      "5": {"libur":false,"masuk_mulai":"06:00","masuk_akhir":"07:15","pulang_mulai":"15:00","pulang_akhir":"17:00"},
      "6": {"libur":false,"masuk_mulai":"06:00","masuk_akhir":"07:15","pulang_mulai":"15:00","pulang_akhir":"17:00"},
      "7": {"libur":true,"masuk_mulai":"06:00","masuk_akhir":"07:15","pulang_mulai":"15:00","pulang_akhir":"17:00"}
    };
    let config = {
      jam_masuk_mulai: '06:00',
      jam_masuk_akhir: '07:15',
      jam_pulang_mulai: '15:00',
      jam_pulang_akhir: '17:00',
      jadwal_harian: defaultJadwal,
      mode_absen: 'masuk_pulang'
    };
    
    if (sheet) {
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        const key = data[i][0];
        const val = data[i][1];
        if (key === 'jadwal_harian') {
          try {
            config.jadwal_harian = JSON.parse(String(val));
          } catch(e) {
            config.jadwal_harian = defaultJadwal;
          }
        } else if (config.hasOwnProperty(key)) {
          // Pastikan format HH:mm (terkadang Google Sheet menyimpan sebagai Date)
          if (val instanceof Date) {
            config[key] = formatWaktuSheet(val, 'HH:mm');
          } else {
            config[key] = String(val);
          }
        }
      }
    }
    return { success: true, data: config };
  } catch (e) {
    return { success: false, message: 'Terjadi kesalahan. Silakan coba lagi. (' + e.toString() + ')' };
  }
}

// 3. Simpan Konfigurasi dari Frontend
function saveAppConfig(newConfig) {
  try {
    const ss = getSpreadsheet();
    let sheet = ss.getSheetByName('konfigurasi');
    if (!sheet) return { success: false, message: 'Sheet "konfigurasi" tidak ditemukan.' };
    
    const data = sheet.getDataRange().getValues();
    
    const updateRow = (key, val) => {
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === key) {
          sheet.getRange(i + 1, 2).setValue(val); 
          return true;
        }
      }
      return false;
    };

    // Simpan jam default (backward-compat)
    updateRow('jam_masuk_mulai', "'" + (newConfig.jam_masuk_mulai || '06:00'));
    updateRow('jam_masuk_akhir', "'" + (newConfig.jam_masuk_akhir || '07:15'));
    updateRow('jam_pulang_mulai', "'" + (newConfig.jam_pulang_mulai || '15:00'));
    updateRow('jam_pulang_akhir', "'" + (newConfig.jam_pulang_akhir || '17:00'));

    // Simpan mode_absen
    if (newConfig.mode_absen) {
      const validModes = ['masuk_saja', 'masuk_pulang', 'masuk_sholat_pulang'];
      const modeVal = validModes.includes(newConfig.mode_absen) ? newConfig.mode_absen : 'masuk_pulang';
      if (!updateRow('mode_absen', modeVal)) {
        sheet.appendRow(['mode_absen', modeVal, 'Mode: masuk_saja | masuk_pulang | masuk_sholat_pulang']);
      }
    }

    // Simpan jadwal_harian (JSON)
    if (newConfig.jadwal_harian) {
      // Ambil jadwal lama untuk membandingkan perubahan
      const oldConfigResult = getAppConfig();
      const oldJadwal = (oldConfigResult.success && oldConfigResult.data.jadwal_harian)
        ? oldConfigResult.data.jadwal_harian
        : {};

      const newJadwal = (typeof newConfig.jadwal_harian === 'string')
        ? JSON.parse(newConfig.jadwal_harian)
        : newConfig.jadwal_harian;

      const jsonStr = JSON.stringify(newJadwal);
      if (!updateRow('jadwal_harian', jsonStr)) {
        sheet.appendRow(['jadwal_harian', jsonStr, 'Jadwal per hari (JSON)']);
      }

      // ─── SYNC OTOMATIS KE SHEET hari_libur ───────────────────────────────
      // Ketika suatu hari diubah jadi LIBUR  → catat semua tanggal hari tsb
      //   yang sudah lewat ke hari_libur (agar laporan lama tetap tercatat Libur)
      // Ketika suatu hari diubah jadi TIDAK LIBUR → hapus hanya tanggal MENDATANG
      //   dari hari_libur (tanggal lampau tetap aman → laporan lama tidak berubah)
      syncJadwalHarianKeHariLibur(ss, oldJadwal, newJadwal);
      // ─────────────────────────────────────────────────────────────────────
    }

    return { success: true, message: 'Pengaturan waktu berhasil disimpan.' };
  } catch (e) {
    return { success: false, message: 'Terjadi kesalahan. Silakan coba lagi. (' + e.toString() + ')' };
  }
}

/**
 * Sinkronisasi perubahan jadwal_harian ke sheet hari_libur.
 * Dipanggil setiap kali admin menyimpan jadwal harian.
 *
 * Aturan:
 *  - Hari berubah jadi LIBUR  → insert tanggal hari tsb yang SUDAH LEWAT (maks 1 tahun ke belakang)
 *                                ke hari_libur dengan keterangan "Libur Rutin [Nama Hari]",
 *                                HANYA jika belum ada di hari_libur.
 *  - Hari berubah jadi TIDAK LIBUR → hapus tanggal hari tsb yang BELUM TERJADI (masa depan)
 *                                     dari hari_libur yang berketerangan "Libur Rutin [Nama Hari]".
 *                                     Tanggal lampau TIDAK disentuh.
 */
function syncJadwalHarianKeHariLibur(ss, oldJadwal, newJadwal) {
  try {
    const liburSheet = ss.getSheetByName('hari_libur');
    if (!liburSheet) return;

    // Mapping: dayIndex (1=Sen..7=Min) → nama hari
    const dayNames = {
      '1': 'Senin', '2': 'Selasa', '3': 'Rabu', '4': 'Kamis',
      '5': 'Jumat', '6': 'Sabtu', '7': 'Minggu'
    };
    // Mapping: dayIndex → getDay() value (0=Minggu, 1=Sen, ..., 6=Sabtu)
    // dayIndex '1'=Senin → getDay()=1, dst. dayIndex '7'=Minggu → getDay()=0
    const dayIndexToGetDay = {
      '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 0
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = formatWaktuSheet(today, 'yyyy-MM-dd');

    // Baca hari_libur yang sudah ada → simpan dalam Set untuk cek duplikat
    const liburData = liburSheet.getDataRange().getValues();
    // Map: tglStr → { rowIndex (1-based), keterangan }
    const existingMap = {};
    for (let i = 1; i < liburData.length; i++) {
      if (!liburData[i][0]) continue;
      const tgl = formatWaktuSheet(new Date(liburData[i][0]), 'yyyy-MM-dd');
      existingMap[tgl] = { rowIndex: i + 1, ket: String(liburData[i][1] || '') };
    }

    const rowsToAdd = [];        // [tanggal Date, keterangan String]
    const rowIndicesToDelete = []; // row index (1-based) di sheet

    // Loop setiap hari dalam jadwal
    for (const dayIdx in newJadwal) {
      const namaHari = dayNames[dayIdx] || ('Hari ' + dayIdx);
      // Keterangan dari input admin; fallback ke nama hari jika kosong
      const ketLibur = (newJadwal[dayIdx] && newJadwal[dayIdx].ket_libur && newJadwal[dayIdx].ket_libur.trim())
        ? newJadwal[dayIdx].ket_libur.trim()
        : ('Libur ' + namaHari);
      const getDay = dayIndexToGetDay[dayIdx];
      if (getDay === undefined) continue;

      const wasLibur = oldJadwal[dayIdx] ? oldJadwal[dayIdx].libur : false;
      const isLibur  = newJadwal[dayIdx] ? newJadwal[dayIdx].libur : false;

      // ── KASUS 1: Hari ini LIBUR KHUSUS (bukan rutinan) ──
      // Libur rutinan (misal Minggu) tidak disimpan ke hari_libur.
      // Hanya libur khusus yang perlu tercatat agar muncul di laporan.
      const isRutinan = newJadwal[dayIdx].libur_rutinan !== false; // default true jika tidak ada
      if (isLibur && !isRutinan) {
        // Cari tanggal terdekat ke belakang yang sesuai hari (maks 7 hari)
        const d = new Date(today);
        let tries = 0;
        while (d.getDay() !== getDay && tries < 7) {
          d.setDate(d.getDate() - 1);
          tries++;
        }
        if (d.getDay() === getDay) {
          const dStr = formatWaktuSheet(d, 'yyyy-MM-dd');
          if (!existingMap[dStr]) {
            // Belum ada → tambahkan
            rowsToAdd.push([new Date(d), ketLibur]);
            existingMap[dStr] = { rowIndex: -1, ket: ketLibur };
          }
          // Sudah ada → tidak ditimpa (agar data yang sudah dicatat manual tidak hilang)
        }
      }

      // ── KASUS 2: Berubah dari LIBUR → TIDAK LIBUR ──────────────────────
      if (wasLibur && !isLibur) {
        // Hapus hanya tanggal MENDATANG (setelah hari ini) yang sesuai hari tsb
        // Tanggal lampau tidak disentuh agar laporan lama tetap menampilkan Libur
        for (const tglStr in existingMap) {
          if (tglStr > todayStr) {
            const entry = existingMap[tglStr];
            const entryDate = new Date(tglStr + 'T00:00:00');
            if (entryDate.getDay() === getDay) {
              if (entry.rowIndex > 0) {
                rowIndicesToDelete.push(entry.rowIndex);
              }
            }
          }
        }
      }
    }

    // ── Hapus baris (dari bawah ke atas agar index tidak geser) ──────────
    if (rowIndicesToDelete.length > 0) {
      rowIndicesToDelete.sort((a, b) => b - a); // urut descending
      for (const ri of rowIndicesToDelete) {
        liburSheet.deleteRow(ri);
      }
    }

    // ── Tambah baris baru ─────────────────────────────────────────────────
    if (rowsToAdd.length > 0) {
      // Urutkan tanggal ascending agar rapi
      rowsToAdd.sort((a, b) => a[0] - b[0]);
      for (const row of rowsToAdd) {
        liburSheet.appendRow(row);
      }
    }

  } catch (e) {
    // Gagal sync tidak boleh menghentikan penyimpanan config utama
    Logger.log('syncJadwalHarianKeHariLibur error: ' + e.toString());
  }
}

// Helper: Menghitung selisih menit antara dua waktu (HH:mm)
function calculateTimeDiff(startTime, endTime) {
  const [h1, m1] = startTime.split(':').map(Number);
  const [h2, m2] = endTime.split(':').map(Number);
  
  const totalMinutes1 = h1 * 60 + m1;
  const totalMinutes2 = h2 * 60 + m2;
  
  return totalMinutes2 - totalMinutes1;
}

// ====================================
// MODE ABSENSI — Getter & Setter
// ====================================

/**
 * Ambil mode absensi aktif.
 * Return: { success, mode, label }
 * mode: 'masuk_saja' | 'masuk_pulang' | 'masuk_sholat_pulang'
 */
function getModeAbsen() {
  try {
    const configResult = getAppConfig();
    const mode = configResult.success ? (configResult.data.mode_absen || 'masuk_pulang') : 'masuk_pulang';
    const labels = {
      masuk_saja:           '1x Absen (Masuk Saja)',
      masuk_pulang:         'Absen Masuk & Pulang',
      masuk_sholat_pulang:  'Absen Masuk, Sholat & Pulang'
    };
    return { success: true, mode, label: labels[mode] || mode };
  } catch (e) {
    return { success: false, message: 'Terjadi kesalahan. Silakan coba lagi. (' + e.toString() + ')' };
  }
}

/**
 * Simpan mode absensi baru.
 * @param {string} mode - 'masuk_saja' | 'masuk_pulang' | 'masuk_sholat_pulang'
 */
function setModeAbsen(mode) {
  try {
    const validModes = ['masuk_saja', 'masuk_pulang', 'masuk_sholat_pulang'];
    if (!validModes.includes(mode)) {
      return { success: false, message: `Mode tidak dikenali. Pilih salah satu: ${validModes.join(', ')}.` };
    }
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('konfigurasi');
    if (!sheet) return { success: false, message: 'Sheet "konfigurasi" tidak ditemukan.' };

    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === 'mode_absen') {
        sheet.getRange(i + 1, 2).setValue(mode);
        const labels = {
          masuk_saja:          '1x Absen (Masuk Saja)',
          masuk_pulang:        'Absen Masuk & Pulang',
          masuk_sholat_pulang: 'Absen Masuk, Sholat & Pulang'
        };
        return { success: true, message: `Mode absensi diubah menjadi: ${labels[mode]}.` };
      }
    }
    // Belum ada baris → buat baru
    sheet.appendRow(['mode_absen', mode, 'Mode: masuk_saja | masuk_pulang | masuk_sholat_pulang']);
    return { success: true, message: 'Mode absensi berhasil disimpan.' };
  } catch (e) {
    return { success: false, message: 'Terjadi kesalahan. Silakan coba lagi. (' + e.toString() + ')' };
  }
}

// ====================================
// IMPORT SISWA DARI EXCEL (BULK)
// ====================================
function importSiswaBulk(dataArray) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('siswa');
    const existingData = sheet.getDataRange().getValues();
    
    // 1. Ambil daftar NISN yang sudah ada untuk cek duplikasi
    const existingNISN = new Set();
    for (let i = 1; i < existingData.length; i++) {
      existingNISN.add(String(existingData[i][1]).trim());
    }

    const rowsToAdd = [];
    let addedCount = 0;
    let skippedCount = 0;

    // 2. Loop data import
    for (let i = 0; i < dataArray.length; i++) {
      const item = dataArray[i];
      const nisn = String(item.nisn).trim();

      // Validasi dasar
      if (!item.nama || !nisn) {
        skippedCount++;
        continue;
      }

      // Cek Duplikasi NISN
      if (existingNISN.has(nisn)) {
        skippedCount++;
        continue;
      }

      // Format Tanggal Lahir (Jika Excel mengirim format angka tanggal)
      // SheetJS kadang mengirim string, kadang angka. Kita simpan string aman.
      let tglLahir = item.tanggalLahir;
      
      // Siapkan baris
      rowsToAdd.push([
        item.nama,
        "'" + nisn, // Pakai kutip satu agar format text terjaga
        item.jenisKelamin,
        tglLahir,
        item.agama,
        item.namaAyah,
        item.namaIbu,
        "'" + item.noHp,
        item.kelas,
        item.alamat
      ]);
      
      // Tambahkan ke Set agar tidak duplikat di dalam file import itu sendiri
      existingNISN.add(nisn);
      addedCount++;
    }

    // 3. Tulis ke Sheet sekaligus (Batch Operation) agar cepat
    if (rowsToAdd.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAdd.length, rowsToAdd[0].length).setValues(rowsToAdd);
    }

    return { 
      success: true, 
      added: addedCount, 
      skipped: skippedCount, 
      message: `Impor selesai. Berhasil: ${addedCount}, dilewati: ${skippedCount}.` 
    };

  } catch (error) {
    return { success: false, message: 'Terjadi kesalahan. Silakan coba lagi. (' + error.toString() + ')' };
  }
}

// ====================================
// IMPORT GURU DARI EXCEL (BULK)
// ====================================
function importGuruBulk(dataArray) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('users');
    const existingData = sheet.getDataRange().getValues();
    
    // 1. Ambil daftar Username yang sudah ada untuk cek duplikasi
    const existingUsernames = new Set();
    for (let i = 1; i < existingData.length; i++) {
      existingUsernames.add(String(existingData[i][0]).trim());
    }

    const rowsToAdd = [];
    let addedCount = 0;
    let skippedCount = 0;

    // 2. Loop data import
    for (let i = 0; i < dataArray.length; i++) {
      const item = dataArray[i];
      const username = String(item.username).trim();

      // Validasi dasar
      if (!username || !item.password) {
        skippedCount++;
        continue;
      }

      // Cek Duplikasi Username
      if (existingUsernames.has(username)) {
        skippedCount++;
        continue;
      }

      // Siapkan baris: [Username, Password, Role, Kelas]
      rowsToAdd.push([
        "'" + username, // Pakai kutip satu agar format text terjaga
        "'" + item.password,
        'guru',         // Role otomatis di-set 'guru'
        item.kelas || '' // Kelas opsional
      ]);

      // Tambahkan ke Set agar tidak duplikat di dalam file import itu sendiri
      existingUsernames.add(username);
      addedCount++;
    }

    // 3. Tulis ke Sheet sekaligus (Batch Operation)
    if (rowsToAdd.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAdd.length, rowsToAdd[0].length).setValues(rowsToAdd);
    }

    return { 
      success: true, 
      added: addedCount, 
      skipped: skippedCount, 
      message: `Impor selesai. Berhasil: ${addedCount}, dilewati: ${skippedCount}.` 
    };

  } catch (error) {
    return { success: false, message: 'Terjadi kesalahan. Silakan coba lagi. (' + error.toString() + ')' };
  }
}

// ====================================
// IMPORT HARI LIBUR DARI EXCEL (BULK)
// ====================================
function importHariLiburBulk(dataArray) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('hari_libur');
    const existingData = sheet.getDataRange().getValues();
    
    // 1. Ambil daftar Tanggal yang sudah ada
    const existingDates = new Set();
    for (let i = 1; i < existingData.length; i++) {
      if (existingData[i][0]) {
        // Format tanggal existing menjadi string untuk perbandingan
        let tglStr = formatWaktuSheet(new Date(existingData[i][0]), 'yyyy-MM-dd');
        existingDates.add(tglStr);
      }
    }

    const rowsToAdd = [];
    let addedCount = 0;
    let skippedCount = 0;

    // 2. Loop data import
    for (let i = 0; i < dataArray.length; i++) {
      const item = dataArray[i];
      if (!item.tanggal || !item.keterangan) {
        skippedCount++;
        continue;
      }

      // Pastikan format input bersih
      const dateStr = String(item.tanggal).trim(); // Harusnya sudah yyyy-mm-dd dari frontend
      
      // Cek Duplikasi
      if (existingDates.has(dateStr)) {
        skippedCount++;
        continue;
      }

      // --- PERUBAHAN UTAMA: KIRIM SEBAGAI STRING, BUKAN OBJECT DATE ---
      // Dengan mengirim string "2026-01-17", Google Sheet akan menerimanya 
      // sebagai tanggal lokal murni (tanpa pergeseran jam 7:00)
      rowsToAdd.push([
        dateStr, 
        item.keterangan
      ]);
      // ---------------------------------------------------------------

      existingDates.add(dateStr);
      addedCount++;
    }

    // 3. Tulis ke Sheet
    if (rowsToAdd.length > 0) {
      const startRow = sheet.getLastRow() + 1;
      
      // Tulis data
      sheet.getRange(startRow, 1, rowsToAdd.length, rowsToAdd[0].length).setValues(rowsToAdd);
      
      // Paksa Format Tampilan menjadi "17-01-2026" (dd-MM-yyyy)
      sheet.getRange(startRow, 1, rowsToAdd.length, 1).setNumberFormat("dd-MM-yyyy");
    }

    return { 
      success: true, 
      added: addedCount, 
      skipped: skippedCount, 
      message: `Impor selesai. Berhasil: ${addedCount}, gagal: ${skippedCount}.` 
    };

  } catch (error) {
    return { success: false, message: 'Terjadi kesalahan. Silakan coba lagi. (' + error.toString() + ')' };
  }
}

// ==========================================
// DATA REKAP BULANAN
// ==========================================
// --- Copy Fungsi Ini ke code.gs jika belum ada ---
function getMonthlyReportData(bulan, tahun, kelasFilter) {
  try {
    const ss = getSpreadsheet();
    const siswaSheet = ss.getSheetByName('siswa');
    const absensiSheet = ss.getSheetByName('absensi');
    const liburSheet = ss.getSheetByName('hari_libur');
    
    // 1. Setup Tanggal
    const year = parseInt(tahun);
    const month = parseInt(bulan); // 0 = Jan, 11 = Dec
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0); 
    const daysInMonth = endDate.getDate();

    // 2. Mapping Hari Libur
    const holidayMap = {};
    if (liburSheet) {
      const liburData = liburSheet.getDataRange().getValues();
      for(let i=1; i<liburData.length; i++){
        if(liburData[i][0]){
          let tglStr = formatWaktuSheet(new Date(liburData[i][0]), 'yyyy-MM-dd');
          holidayMap[tglStr] = liburData[i][1];
        }
      }
    }

    // 2b. Load jadwal_harian dari config (untuk libur rutin Sabtu/hari lain)
    const configResult = getAppConfig();
    const jadwalHarian = (configResult.success && configResult.data.jadwal_harian)
      ? configResult.data.jadwal_harian : null;
    // Helper: JS getDay() (0=Minggu,1=Sen,...,6=Sab) → key jadwal_harian (1=Sen,...,6=Sab,7=Min)
    function isJadwalLibur(jsDay) {
      if (!jadwalHarian) return jsDay === 0; // fallback: hanya Minggu
      const key = jsDay === 0 ? '7' : String(jsDay);
      const sc = jadwalHarian[key];
      return !sc || sc.libur === true;
    }

    // 3. Ambil & Filter Siswa (support multi-kelas)
    const rawSiswa = siswaSheet.getDataRange().getValues();
    const siswaList = [];
    const fKelasList = kelasFilter
      ? String(kelasFilter).split(',').map(k => k.trim()).filter(Boolean)
      : [];
    for (let i = 1; i < rawSiswa.length; i++) {
        if (!rawSiswa[i][0]) continue;
        const sKelas = String(rawSiswa[i][8]).trim();
        
        if (fKelasList.length > 0 && !fKelasList.includes(sKelas)) continue;
        
        siswaList.push({
            nama: rawSiswa[i][0],
            nisn: String(rawSiswa[i][1]).trim(),
            kelas: sKelas
        });
    }
    siswaList.sort((a, b) => a.nama.localeCompare(b.nama));

    // 4. Ambil & Map Absensi
    const rawAbsen = absensiSheet.getDataRange().getValues();
    const absenMap = {};
    const startStr = formatWaktuSheet(startDate, 'yyyy-MM-dd');
    const endStr = formatWaktuSheet(endDate, 'yyyy-MM-dd');

    for (let i = 1; i < rawAbsen.length; i++) {
        if (!rawAbsen[i][0]) continue;
        const tglAbsen = formatWaktuSheet(new Date(rawAbsen[i][0]), 'yyyy-MM-dd');
        if (tglAbsen < startStr || tglAbsen > endStr) continue;

        const nisn = String(rawAbsen[i][1]).trim();
        const key = tglAbsen + '_' + nisn;
        absenMap[key] = rawAbsen[i][7]; 
    }

    // 5. Build Final Structure
    const reportData = siswaList.map(siswa => {
        let stats = { h: 0, s: 0, i: 0, a: 0, effectiveDays: 0 };
        let dailyCodes = [];

        for (let d = 1; d <= daysInMonth; d++) {
            const currentDate = new Date(year, month, d);
            const dateStr = formatWaktuSheet(currentDate, 'yyyy-MM-dd');
            const isHoliday = holidayMap[dateStr] ? true : false;
            // Cek libur rutin dari jadwal_harian (termasuk Sabtu jika diset libur)
            const isRoutineOff = isJadwalLibur(currentDate.getDay());
            let code = '-';
            let isDayOff = isRoutineOff || isHoliday;

            if (isDayOff) {
                code = 'L'; 
            } else {
                const key = dateStr + '_' + siswa.nisn;
                const status = absenMap[key];
                const todayStr = formatWaktuSheet(new Date(), 'yyyy-MM-dd');
                
                if (dateStr > todayStr) {
                    code = ''; 
                } else {
                    stats.effectiveDays++; 
                    if (status === 'Hadir') { code = 'H'; stats.h++; }
                    else if (status === 'Sakit') { code = 'S'; stats.s++; }
                    else if (status === 'Izin') { code = 'I'; stats.i++; }
                    else if (status === 'Alpa' || status === 'Alpha' || status === 'Belum Absen') { code = 'A'; stats.a++; }
                    else { code = 'A'; stats.a++; } 
                }
            }
            dailyCodes.push({ date: d, code: code, isHoliday: isDayOff });
        }

        let percent = 0;
        if (stats.effectiveDays > 0) percent = Math.round((stats.h / stats.effectiveDays) * 100);

        return {
            nama: siswa.nama,
            nisn: siswa.nisn,
            kelas: siswa.kelas,
            dailyCodes: dailyCodes,
            stats: { ...stats, percent: percent }
        };
    });

    return { success: true, data: { daysInMonth, students: reportData } };

  } catch (e) {
    return { success: false, message: 'Terjadi kesalahan. Silakan coba lagi. (' + e.toString() + ')' };
  }
}

// ==========================================
// FITUR KENAIKAN KELAS & ARSIP TAHUN AJARAN
// ==========================================

/**
 * Memproses kenaikan kelas massal
 * @param {Array} mapping - Array of {asal: '1A', tujuan: '2A'}
 */
function processGradePromotion(mapping) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000); // Kunci script agar tidak crash jika multiple klik
    const ss = getSpreadsheet();
    const siswaSheet = ss.getSheetByName('siswa');
    
    // 1. Siapkan Sheet Alumni (Jika ada yang lulus)
    let alumniSheet = ss.getSheetByName('alumni');
    if (!alumniSheet) {
      alumniSheet = ss.insertSheet('alumni');
      alumniSheet.appendRow(["Nama", "NISN", "Jenis Kelamin", "Kelas Terakhir", "Tahun Lulus", "Kontak"]);
      alumniSheet.getRange(1, 1, 1, 6).setFontWeight("bold").setBackground("#E5E7EB");
    }

    // 2. Ambil Data Siswa
    const dataRange = siswaSheet.getDataRange();
    const values = dataRange.getValues();
    // Asumsi Kolom: 0=Nama, 1=NISN, 2=JK, ... 8=Kelas (Index 8)
    // Sesuaikan index kolom kelas jika berbeda! (Berdasarkan kode sebelumnya, index 8 adalah Kelas)
    const COL_KELAS = 8; 
    
    let movedCount = 0;
    const rowsToDelete = []; // Simpan index baris yang jadi alumni untuk dihapus nanti
    const rowsToUpdate = []; // Simpan update [row, col, value]

    // Buat Map Mapping biar cepat aksesnya
    // mapObj = { '1A': '2A', '6A': 'LULUS' }
    const mapObj = {};
    mapping.forEach(m => mapObj[m.asal] = m.tujuan);

    // 3. Loop Data Siswa (Mulai baris 1 / Row 2)
    for (let i = 1; i < values.length; i++) {
      if (!values[i][0]) continue; // Skip baris kosong
      
      const currentKelas = values[i][COL_KELAS];
      const targetKelas = mapObj[currentKelas];

      if (targetKelas) {
        if (targetKelas === 'LULUS') {
          // Pindahkan ke Alumni
          const tahunLulus = new Date().getFullYear();
          alumniSheet.appendRow([
            values[i][0], // Nama
            values[i][1], // NISN
            values[i][2], // JK
            currentKelas, // Kelas Terakhir
            tahunLulus,
            values[i][4]  // Kontak (Opsional, sesuaikan kolom)
          ]);
          rowsToDelete.push(i + 1); // Row index (1-based)
        } else {
          // Update Kelas di Memory
          // values[i][COL_KELAS] = targetKelas; -> Tidak perlu update array memory, kita catat posisinya
          // Push ke batch update
          rowsToUpdate.push({ row: i + 1, col: COL_KELAS + 1, val: targetKelas });
        }
        movedCount++;
      }
    }

    // 4. Eksekusi Update Kelas (Batch)
    if (rowsToUpdate.length > 0) {

        const kelasRange = siswaSheet.getRange(2, COL_KELAS + 1, values.length - 1, 1);
        const kelasValues = kelasRange.getValues();
        
        rowsToUpdate.forEach(item => {
            // item.row is 1-based index from sheet.
            // array index is row - 2
            const arrIdx = item.row - 2;
            if (arrIdx >= 0 && arrIdx < kelasValues.length) {
                kelasValues[arrIdx][0] = item.val;
            }
        });
        
        kelasRange.setValues(kelasValues);
    }

    // 5. Eksekusi Hapus Alumni (Dari bawah ke atas agar index tidak geser)
    // Sort descending
    rowsToDelete.sort((a, b) => b - a);
    rowsToDelete.forEach(rowIdx => {
      siswaSheet.deleteRow(rowIdx);
    });

    return { success: true, movedCount: movedCount };

  } catch (e) {
    return { success: false, message: 'Terjadi kesalahan. Silakan coba lagi. (' + e.toString() + ')' };
  } finally {
    lock.releaseLock();
  }
}


// ==========================================
// FUNGSI ARSIP & RESET TAHUN AJARAN (FINAL)
// ==========================================
function archiveAndResetYear(archiveName) {
  const lock = LockService.getScriptLock();
  try {
    // 1. Kunci Script (Mencegah double klik)
    lock.waitLock(30000);
    
    const ss = getSpreadsheet();
    const absensiSheet = ss.getSheetByName('absensi');
    
    // Pastikan nama tidak kosong
    if (!archiveName || archiveName.trim() === "") {
       archiveName = "Arsip " + formatWaktuSheet(new Date(), 'yyyy-MM-dd_HH-mm');
    }

    // ======================================================
    // 2. BUAT STRUKTUR FOLDER & FILE
    // ======================================================
    
    // A. Ambil Folder Induk (Wajib ID Folder yang benar di baris 2 script)
    const parentFolder = DriveApp.getFolderById(PARENT_FOLDER_ID);
    
    // B. Buat FOLDER BARU di dalam Folder Induk (Sesuai nama arsip)
    const subFolder = parentFolder.createFolder(archiveName);
    
    // C. Buat File Spreadsheet Baru
    const archiveSS = SpreadsheetApp.create(archiveName);
    const archiveUrl = archiveSS.getUrl();
    const archiveId = archiveSS.getId();
    
    // D. PINDAHKAN File Spreadsheet Baru ke dalam FOLDER BARU
    const file = DriveApp.getFileById(archiveId);
    file.moveTo(subFolder);
    
    // ======================================================
    // 3. COPY DATA KE ARSIP
    // ======================================================
    
    // Copy Sheet Absensi
    absensiSheet.copyTo(archiveSS).setName('Data Absensi');
    
    // Copy Sheet Siswa (Penting untuk sejarah data siswa tahun itu)
    const siswaSheet = ss.getSheetByName('siswa');
    if (siswaSheet) siswaSheet.copyTo(archiveSS).setName('Data Siswa Saat Itu');

    // Hapus Sheet1 kosong bawaan file baru
    const defaultSheet = archiveSS.getSheetByName('Sheet1');
    if (defaultSheet) archiveSS.deleteSheet(defaultSheet);

    // ======================================================
    // 4. BERSIHKAN DATA UTAMA (RESET)
    // ======================================================
    
    // Hapus isi data absensi di file UTAMA (Sisakan Header)
    const lastRow = absensiSheet.getLastRow();
    if (lastRow > 1) {
      // Hapus konten mulai baris 2 sampai akhir
      absensiSheet.getRange(2, 1, lastRow - 1, absensiSheet.getLastColumn()).clearContent();
    }

    return { success: true, url: archiveUrl, message: "Berhasil! Data diarsipkan ke folder: " + archiveName + "." };
    
  } catch (e) {
    return { success: false, message: "Gagal: " + e.toString() };
  } finally {
    lock.releaseLock();
  }
}

// ==========================================
// BACKEND: KENAIKAN KELAS INDIVIDUAL
// ==========================================

// 1. Ambil Siswa per Kelas untuk List View
function getSiswaByKelas(kelasTarget) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('siswa');
  const data = sheet.getDataRange().getValues();
  
  const output = [];
  
  for (let i = 1; i < data.length; i++) {
    if (!data[i][0]) continue; // skip baris kosong

    // ✅ Jika "SEMUA", ambil semua siswa tanpa filter kelas
    if (String(kelasTarget).toUpperCase() === 'SEMUA') {
      output.push({
        nama: data[i][0],
        nisn: String(data[i][1]),
        kelas: data[i][8]
      });
    } else if (String(data[i][8]) === String(kelasTarget)) {
      output.push({
        nama: data[i][0],
        nisn: String(data[i][1]),
        kelas: data[i][8]
      });
    }
  }
  
  return output.sort((a, b) => a.nama.localeCompare(b.nama));
}

// 2. Proses Eksekusi Kenaikan Kelas (Batch Update)
function processIndividualPromotion(kelasAsal, kelasTujuan, promoData) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    
    const ss = getSpreadsheet();
    const siswaSheet = ss.getSheetByName('siswa');
    
    // Siapkan Sheet Alumni jika ada yg LULUS
    let alumniSheet = ss.getSheetByName('alumni');
    if (!alumniSheet && kelasTujuan === 'LULUS') {
      alumniSheet = ss.insertSheet('alumni');
      alumniSheet.appendRow(["Nama", "NISN", "Jenis Kelamin", "Kelas Terakhir", "Tahun Lulus", "Kontak"]);
      alumniSheet.getRange(1, 1, 1, 6).setFontWeight("bold").setBackground("#E5E7EB");
    }

    const dataRange = siswaSheet.getDataRange();
    const values = dataRange.getValues();
    const rowsToDelete = [];
    
    // Buat Map NISN -> Row Index untuk pencarian cepat
    // key: NISN, value: Row Index (0-based array index)
    const nisnMap = {};
    for (let i = 1; i < values.length; i++) {
      const nisn = String(values[i][1]).trim();
      if (nisn) nisnMap[nisn] = i;
    }

    // Loop data promosi dari Frontend
    // promoData = [{nisn: '123', status: 'NAIK'}, {nisn: '456', status: 'TINGGAL'}]
    promoData.forEach(p => {
      const rowIndex = nisnMap[String(p.nisn).trim()];
      
      if (rowIndex !== undefined) {
        // Cek Status
        if (p.status === 'NAIK') {
          if (kelasTujuan === 'LULUS') {
            // PINDAH KE ALUMNI
            const rowData = values[rowIndex];
            alumniSheet.appendRow([
              rowData[0], // Nama
              rowData[1], // NISN
              rowData[2], // JK
              kelasAsal,  // Kelas Terakhir (Kelas Asal dia)
              new Date().getFullYear(), // Tahun Lulus
              rowData[4]  // Kontak
            ]);
            rowsToDelete.push(rowIndex + 1); // Simpan index sheet (1-based) untuk dihapus
          } else {
            // UPDATE KE KELAS BARU
            // Kolom Kelas ada di index 8 (Column I) -> Ubah jadi kelasTujuan
            siswaSheet.getRange(rowIndex + 1, 9).setValue(kelasTujuan);
          }
        } 
        else if (p.status === 'TINGGAL') {
          // TIDAK MELAKUKAN APA-APA (Tetap di kelas asal)
          // Opsional: Bisa memastikan ulang datanya benar
          // siswaSheet.getRange(rowIndex + 1, 9).setValue(kelasAsal);
        }
      }
    });

    // Hapus data siswa yang jadi Alumni (Hapus dari bawah ke atas)
    if (rowsToDelete.length > 0) {
      rowsToDelete.sort((a, b) => b - a); // Sort Descending
      rowsToDelete.forEach(r => siswaSheet.deleteRow(r));
    }

    return { success: true };

  } catch (e) {
    return { success: false, message: 'Terjadi kesalahan. Silakan coba lagi. (' + e.toString() + ')' };
  } finally {
    lock.releaseLock();
  }
}



// ============================================================
// MANAJEMEN KELAS — CRUD
// ============================================================

function getKelasMaster() {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('konfigurasi');
    if (!sheet) return { success: false, message: 'Sheet "konfigurasi" tidak ditemukan.' };

    const lastRow = sheet.getLastRow();
    const result = [];
    if (lastRow >= 2) {
      const data = sheet.getRange(2, 5, lastRow - 1, 1).getValues();
      data.forEach((row, idx) => {
        const nama = String(row[0]).trim();
        if (nama) result.push({ rowIndex: idx + 2, nama });
      });
    }
    return { success: true, data: result };
  } catch (e) {
    return { success: false, message: 'Terjadi kesalahan. Silakan coba lagi. (' + e.toString() + ')' };
  }
}

function addKelas(namaKelas) {
  try {
    namaKelas = String(namaKelas).trim();
    if (!namaKelas) return { success: false, message: 'Nama kelas tidak boleh kosong.' };

    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('konfigurasi');
    if (!sheet) return { success: false, message: 'Sheet "konfigurasi" tidak ditemukan.' };

    // Cek duplikat
    const existing = getKelasMaster();
    if (existing.success && existing.data.some(k => k.nama.toLowerCase() === namaKelas.toLowerCase())) {
      return { success: false, message: `Kelas "${namaKelas}" sudah ada.` };
    }

    const lastRow = sheet.getLastRow();
    // Cari baris kosong di kolom E atau append
    let targetRow = -1;
    if (lastRow >= 2) {
      const col = sheet.getRange(2, 5, lastRow - 1, 1).getValues();
      for (let i = 0; i < col.length; i++) {
        if (!String(col[i][0]).trim()) { targetRow = i + 2; break; }
      }
    }
    if (targetRow === -1) targetRow = lastRow + 1;
    sheet.getRange(targetRow, 5).setValue(namaKelas);
    return { success: true, message: `Kelas "${namaKelas}" berhasil ditambahkan.` };
  } catch (e) {
    return { success: false, message: 'Terjadi kesalahan. Silakan coba lagi. (' + e.toString() + ')' };
  }
}

function updateKelas(rowIndex, namaBaru) {
  try {
    namaBaru = String(namaBaru).trim();
    if (!namaBaru) return { success: false, message: 'Nama kelas tidak boleh kosong.' };

    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('konfigurasi');
    if (!sheet) return { success: false, message: 'Sheet "konfigurasi" tidak ditemukan.' };

    const namaLama = String(sheet.getRange(rowIndex, 5).getValue()).trim();

    // Cek duplikat (kecuali diri sendiri)
    const existing = getKelasMaster();
    if (existing.success && existing.data.some(k => k.nama.toLowerCase() === namaBaru.toLowerCase() && k.rowIndex !== rowIndex)) {
      return { success: false, message: `Kelas "${namaBaru}" sudah ada.` };
    }

    sheet.getRange(rowIndex, 5).setValue(namaBaru);

    // Update di sheet siswa juga
    const siswaSheet = ss.getSheetByName('siswa');
    if (siswaSheet && namaLama) {
      const siswaData = siswaSheet.getDataRange().getValues();
      for (let i = 1; i < siswaData.length; i++) {
        if (String(siswaData[i][8]).trim() === namaLama) {
          siswaSheet.getRange(i + 1, 9).setValue(namaBaru);
        }
      }
    }

    return { success: true, message: `Kelas berhasil diubah dari "${namaLama}" ke "${namaBaru}".` };
  } catch (e) {
    return { success: false, message: 'Terjadi kesalahan. Silakan coba lagi. (' + e.toString() + ')' };
  }
}

function deleteKelas(rowIndex, namaKelas) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('konfigurasi');
    if (!sheet) return { success: false, message: 'Sheet "konfigurasi" tidak ditemukan.' };

    // Cek apakah kelas masih dipakai siswa
    const siswaSheet = ss.getSheetByName('siswa');
    if (siswaSheet) {
      const siswaData = siswaSheet.getDataRange().getValues();
      const count = siswaData.slice(1).filter(r => String(r[8]).trim() === namaKelas).length;
      if (count > 0) {
        return { success: false, message: `Kelas "${namaKelas}" masih digunakan oleh ${count} siswa. Pindahkan atau hapus siswa terlebih dahulu.` };
      }
    }

    sheet.getRange(rowIndex, 5).clearContent();
    return { success: true, message: `Kelas "${namaKelas}" berhasil dihapus.` };
  } catch (e) {
    return { success: false, message: 'Terjadi kesalahan. Silakan coba lagi. (' + e.toString() + ')' };
  }
}

function getDaftarKelas() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('konfigurasi');
  
  if (!sheet) return []; // Return kosong jika sheet belum dibuat

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  // Ambil Data dari Kolom E (Baris 2 s/d Akhir)
  // getRange(row, column, numRows, numColumns)
  // Kolom E adalah kolom ke-5
  const data = sheet.getRange(2, 5, lastRow - 1, 1).getValues();
  
  // Bersihkan data (hapus yang kosong) & Sortir
  const kelasList = data
    .map(row => String(row[0]).trim())
    .filter(k => k !== "");
  
  // Hapus duplikat & Sortir
  const uniqueKelas = [...new Set(kelasList)].sort();

  return uniqueKelas;
}



function getTemplateExcel(type) {
  try {
    const ss = getSpreadsheet(); // Ambil spreadsheet utama
    var timestamp = formatWaktuSheet(new Date(), 'ddMMyyyy_HHmm');
    var fileName = "Template_" + type.toUpperCase() + "_" + timestamp;
    
    // Buat Spreadsheet baru untuk template
    var newSS = SpreadsheetApp.create(fileName);
    var newSheet = newSS.getSheets()[0];
    var headers = [];
    var exampleRow = [];
    
    // LOGIKA DINAMIS: Ambil Header Langsung dari Database
    if (type === 'siswa') {
      var sourceSheet = ss.getSheetByName('siswa');
      
      // Ambil Header asli dari baris 1
      // getRange(row, col, numRows, numCols)
      headers = sourceSheet.getRange(1, 1, 1, sourceSheet.getLastColumn()).getValues()[0];
      
      // Buat Contoh Data Dummy yang Sesuai dengan Header
      exampleRow = headers.map(function(header) {
        var h = String(header).toLowerCase();
        if (h.includes('nama') && (h.includes('ayah') || h.includes('ibu'))) return 'Nama Orang Tua';
        if (h.includes('nama')) return 'Siswa Contoh';
        if (h.includes('nisn')) return "'1234567890"; // Kutip satu agar jadi teks
        if (h.includes('kelamin') || h.includes('jk')) return 'Laki-laki';
        if (h.includes('tgl') || h.includes('lahir')) return '2010-01-01'; // Format YYYY-MM-DD
        if (h.includes('agama')) return 'Islam';
        if (h.includes('hp') || h.includes('handphone')) return "'08123456789";
        if (h.includes('kelas')) return 'X IPA 1';
        if (h.includes('alamat')) return 'Jl. Contoh No. 1';
        return 'Contoh Data'; // Default jika kolom tidak dikenali
      });

    } else if (type === 'guru') {
      // Untuk Guru, kita tetap manual agar aman (tidak mengekspos kolom Role yang sensitif)
      headers = ['Username', 'Password', 'Kelas'];
      exampleRow = ['guru_baru', 'pass123', 'X IPA 1'];
    }

    // 1. Tulis Header ke File Baru (Baris 1)
    var headerRange = newSheet.getRange(1, 1, 1, headers.length);
    headerRange.setValues([headers]);
    
    // Styling Header (Biar mirip Data Sheet asli)
    headerRange.setFontWeight("bold")
               .setBackground("#4F46E5") // Warna Indigo
               .setFontColor("#FFFFFF")
               .setHorizontalAlignment("center");

    // 2. Tulis Data Contoh (Baris 2)
    newSheet.getRange(2, 1, 1, exampleRow.length).setValues([exampleRow]);

    // 3. Format Kolom Teks (Penting untuk NISN/HP agar angka 0 di depan tidak hilang)
    // Kita set seluruh kolom menjadi Plain Text secara default untuk aman
    newSheet.getRange(2, 1, 100, headers.length).setNumberFormat("@");

    // 4. Auto Resize Kolom agar rapi
    newSheet.autoResizeColumns(1, headers.length);

    // 5. Permission & Return URL
    var fileId = newSS.getId();
    var file = DriveApp.getFileById(fileId);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return {
      success: true,
      url: "https://docs.google.com/spreadsheets/d/" + fileId + "/export?format=xlsx",
      filename: fileName
    };

  } catch (e) {
    return { success: false, message: 'Gagal membuat template. Silakan coba lagi. (' + e.toString() + ')' };
  }
}

// ======================================================
// FUNGSI PANCINGAN IZIN DRIVE (Jalankan Sekali Saja)
// ======================================================
// ======================================================
// INISIALISASI JADWAL HARIAN (jalankan sekali dari editor
// jika baris jadwal_harian belum ada di sheet konfigurasi)
// ======================================================
function initJadwalHarian() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName('konfigurasi');
  if (!sheet) {
    Logger.log('Sheet konfigurasi tidak ditemukan.');
    return;
  }
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === 'jadwal_harian') {
      Logger.log('Baris jadwal_harian sudah ada. Tidak perlu init ulang.');
      return;
    }
  }
  const defaultJadwal = {
    "1": {"libur":false,"masuk_mulai":"06:00","masuk_akhir":"07:15","pulang_mulai":"15:00","pulang_akhir":"17:00"},
    "2": {"libur":false,"masuk_mulai":"06:00","masuk_akhir":"07:15","pulang_mulai":"15:00","pulang_akhir":"17:00"},
    "3": {"libur":false,"masuk_mulai":"06:00","masuk_akhir":"07:15","pulang_mulai":"15:00","pulang_akhir":"17:00"},
    "4": {"libur":false,"masuk_mulai":"06:00","masuk_akhir":"07:15","pulang_mulai":"15:00","pulang_akhir":"17:00"},
    "5": {"libur":false,"masuk_mulai":"06:00","masuk_akhir":"07:15","pulang_mulai":"15:00","pulang_akhir":"17:00"},
    "6": {"libur":false,"masuk_mulai":"06:00","masuk_akhir":"07:15","pulang_mulai":"15:00","pulang_akhir":"17:00"},
    "7": {"libur":true,"masuk_mulai":"06:00","masuk_akhir":"07:15","pulang_mulai":"15:00","pulang_akhir":"17:00"}
  };
  sheet.appendRow(['jadwal_harian', JSON.stringify(defaultJadwal), 'Jadwal per hari (JSON)']);
  Logger.log('Berhasil! Baris jadwal_harian ditambahkan ke sheet konfigurasi.');
}

function pancinganIzinDrive() {
  // Mengambil ID folder dari konfigurasi Anda di atas
  // Pastikan ID ini benar agar tidak error 'Folder not found'
  const folderId = PARENT_FOLDER_ID; 
  
  // Perintah ini akan memaksa Google meminta izin akses Drive
  const folder = DriveApp.getFolderById(folderId);
  
  // Jika berhasil, nama folder akan muncul di log
  Logger.log("Sukses! Izin Drive sudah diberikan. Nama Folder: " + folder.getName());
}

// ======================================================
// FUNGSI FORMAT WAKTU (VERSI PAKSA WITA / MAKASSAR)
// ======================================================
function formatWaktuSheet(waktu, formatPola) {
  try {
    // 1. Cek validitas data
    if (!waktu) return "-";
    
    // 2. Pastikan input menjadi object Date
    var dateObj = (waktu instanceof Date) ? waktu : new Date(waktu);
    
 
    var zonaWaktu = 'Asia/Jakarta'; 
    
    // 4. Format dan kembalikan hasil
    return Utilities.formatDate(dateObj, zonaWaktu, formatPola);
    
  } catch (e) {
    return "Error Waktu: " + e.toString();
  }
}
function CEK_ZONA_WAKTU_SEKARANG() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var timezone = ss.getSpreadsheetTimeZone();
  var jamServer = new Date();
  var jamFormatted = Utilities.formatDate(jamServer, timezone, "HH:mm:ss");
  
  console.log("=== HASIL PENGECEKAN ===");
  console.log("1. ID Spreadsheet: " + SPREADSHEET_ID);
  console.log("2. Zona Waktu Settingan File: " + timezone);
  console.log("3. Jam Sekarang (Sesuai Zona Waktu tsb): " + jamFormatted);
  console.log("========================");
}
// ============================================================
// DAFTAR HADIR GURU — Ambil status absensi existing
// Kolom absensi: A=Tanggal, B=NISN, C=Nama, D=Kelas, E=JamDatang, F=JamPulang, G=Keterangan, H=Status
// ============================================================
function getDaftarHadirByKelasAndTanggal(kelas, tanggal) {
  try {
    const ss = getSpreadsheet();
    const absensiSheet = ss.getSheetByName('absensi');
    if (!absensiSheet) return { success: true, data: {} };

    const data = absensiSheet.getDataRange().getValues();
    // result: { nisn: { status, hasJamDatang } }
    // hasJamDatang = true → sudah ada jam (scan QR / input guru hari ini) → dikunci
    const result = {};

    for (let i = 1; i < data.length; i++) {
      if (!data[i][0]) continue;
      const rowDate   = formatWaktuSheet(new Date(data[i][0]), 'yyyy-MM-dd');
      const rowNisn   = String(data[i][1]).replace(/^'/, '').trim();
      const rowKelas  = String(data[i][3]).trim();
      const rowStatus = String(data[i][7]).trim();

      if (rowDate === tanggal && rowKelas === kelas && rowStatus) {
        let jamDatang = data[i][4];
        if (jamDatang instanceof Date) jamDatang = formatWaktuSheet(jamDatang, 'HH:mm');
        else jamDatang = String(jamDatang || '').substring(0, 5);

        result[rowNisn] = {
          status:       rowStatus.toLowerCase(),
          jamDatang:    jamDatang,
          hasJamDatang: true  // semua yang sudah punya record dikunci agar tidak tertimpa
        };
      }
    }

    return { success: true, data: result };
  } catch (e) {
    return { success: false, message: 'Terjadi kesalahan. Silakan coba lagi. (' + e.toString() + ')', data: {} };
  }
}

// ============================================================
// DAFTAR HADIR GURU — Ambil detail masuk+pulang per kelas & tanggal
// Returns: { nisn: { status, jamDatang, jamPulang, rowIndex } }
// ============================================================
function getDaftarHadirDetailByKelasAndTanggal(kelas, tanggal) {
  try {
    const ss = getSpreadsheet();
    const absensiSheet = ss.getSheetByName('absensi');
    if (!absensiSheet) return { success: true, data: {} };

    const data = absensiSheet.getDataRange().getValues();
    const result = {};

    for (let i = 1; i < data.length; i++) {
      if (!data[i][0]) continue;
      const rowDate  = formatWaktuSheet(new Date(data[i][0]), 'yyyy-MM-dd');
      const rowNisn  = String(data[i][1]).replace(/^'/, '').trim();
      const rowKelas = String(data[i][3]).trim();
      if (rowDate !== tanggal || rowKelas !== kelas) continue;

      let jamDatang = data[i][4];
      if (jamDatang instanceof Date) jamDatang = formatWaktuSheet(jamDatang, 'HH:mm');
      else jamDatang = String(jamDatang || '').substring(0, 5);

      let jamPulang = data[i][5];
      if (jamPulang instanceof Date) jamPulang = formatWaktuSheet(jamPulang, 'HH:mm');
      else jamPulang = String(jamPulang || '').substring(0, 5);

      result[rowNisn] = {
        status:    String(data[i][7] || '').toLowerCase(),
        jamDatang: jamDatang,
        jamPulang: jamPulang,
        rowIndex:  i + 1   // 1-based untuk .getRange()
      };
    }
    return { success: true, data: result };
  } catch (e) {
    return { success: false, message: 'Terjadi kesalahan. Silakan coba lagi. (' + e.toString() + ')', data: {} };
  }
}

// ============================================================
// DAFTAR HADIR GURU — Catat pulang SATU siswa (via scan/manual)
// ============================================================
function submitPulangSatu(nisn, kelas, tanggal, namaPengirim) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const ss = getSpreadsheet();
    const absensiSheet = ss.getSheetByName('absensi');
    if (!absensiSheet) return { success: false, message: 'Sheet "absensi" tidak ditemukan.' };

    // Cek hari libur
    const todayStr = formatWaktuSheet(new Date(), 'yyyy-MM-dd');
    if (tanggal === todayStr) {
      const configResult = getAppConfig();
      const config = configResult.success ? configResult.data : {};
      const dayIndex = formatWaktuSheet(new Date(), 'u');
      const dayNames = {'1':'Senin','2':'Selasa','3':'Rabu','4':'Kamis','5':'Jumat','6':'Sabtu','7':'Minggu'};
      if (config.jadwal_harian) {
        const sc = config.jadwal_harian[dayIndex];
        if (!sc || sc.libur) {
          return { success: false, message: `Hari ini libur (${dayNames[dayIndex]||''}). Absensi tidak dapat diinput.` };
        }
      }
    }

    // Ambil config jam pulang
    const configResult2 = getAppConfig();
    const cfg = configResult2.success ? configResult2.data : {};
    const dayIdx = formatWaktuSheet(new Date(), 'u');
    let pulangMulai = cfg.jam_pulang_mulai || '15:00';
    if (cfg.jadwal_harian && cfg.jadwal_harian[dayIdx] && !cfg.jadwal_harian[dayIdx].libur) {
      pulangMulai = cfg.jadwal_harian[dayIdx].pulang_mulai || pulangMulai;
    }

    const nisnClean = String(nisn).trim();
    const jamSekarang = formatWaktuSheet(new Date(), 'HH:mm:ss');
    const nowTimeStr  = formatWaktuSheet(new Date(), 'HH:mm');

    // Cari baris absensi siswa ini untuk tanggal tersebut
    const data = absensiSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (!data[i][0]) continue;
      const rowDate  = formatWaktuSheet(new Date(data[i][0]), 'yyyy-MM-dd');
      const rowNisn  = String(data[i][1]).replace(/^'/, '').trim();
      const rowKelas = String(data[i][3]).trim();
      if (rowDate !== tanggal || rowNisn !== nisnClean || rowKelas !== kelas) continue;

      // Cek sudah pulang?
      const jamPulangAda = data[i][5];
      const jamPulangStr = jamPulangAda instanceof Date
        ? formatWaktuSheet(jamPulangAda, 'HH:mm') : String(jamPulangAda || '').trim();
      if (jamPulangStr) {
        return { success: false, message: `${data[i][2]} sudah tercatat pulang pukul ${jamPulangStr}.` };
      }

      // Hitung keterangan
      const existingKet = String(data[i][6] || '');
      let ketBaru = existingKet;
      if (nowTimeStr < pulangMulai) {
        ketBaru = (ketBaru ? ketBaru + ' & ' : '') + 'Pulang Cepat';
      }
      absensiSheet.getRange(i + 1, 6).setValue(jamSekarang);
      absensiSheet.getRange(i + 1, 7).setValue(ketBaru);

      return {
        success: true,
        nama: String(data[i][2]),
        jamPulang: jamSekarang,
        message: `${data[i][2]} berhasil dicatat pulang pukul ${jamSekarang}.`
      };
    }
    return { success: false, message: 'Belum ada data absen masuk untuk siswa ini. Pastikan sudah absen masuk lebih dulu.' };
  } catch (e) {
    return { success: false, message: 'Terjadi kesalahan. Silakan coba lagi. (' + e.toString() + ')' };
  } finally {
    lock.releaseLock();
  }
}

// ============================================================
// DAFTAR HADIR GURU — Simpan jam pulang massal per kelas
// pulangList: [{ nisn, rowIndex }]  — hanya yang di-centang
// ============================================================
function submitPulangGuru(pulangList, tanggal, namaPengirim) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const ss = getSpreadsheet();
    const absensiSheet = ss.getSheetByName('absensi');
    if (!absensiSheet) return { success: false, message: 'Sheet "absensi" tidak ditemukan.' };

    // Cek hari libur
    const todayStr = formatWaktuSheet(new Date(), 'yyyy-MM-dd');
    if (tanggal === todayStr) {
      const configResult = getAppConfig();
      const config = configResult.success ? configResult.data : {};
      const dayIndex = formatWaktuSheet(new Date(), 'u');
      const dayNames = {'1':'Senin','2':'Selasa','3':'Rabu','4':'Kamis','5':'Jumat','6':'Sabtu','7':'Minggu'};
      if (config.jadwal_harian) {
        const sc = config.jadwal_harian[dayIndex];
        if (!sc || sc.libur) {
          return { success: false, message: `Hari ini libur (${dayNames[dayIndex]||''}). Absensi tidak dapat diinput.` };
        }
      }
    }

    const jamSekarang  = formatWaktuSheet(new Date(), 'HH:mm:ss');
    const nowTimeStr   = formatWaktuSheet(new Date(), 'HH:mm');
    const configResult2 = getAppConfig();
    const cfg2 = configResult2.success ? configResult2.data : {};
    const dayIdx2 = formatWaktuSheet(new Date(), 'u');
    let pulangMulai = cfg2.jam_pulang_mulai || '15:00';
    if (cfg2.jadwal_harian && cfg2.jadwal_harian[dayIdx2] && !cfg2.jadwal_harian[dayIdx2].libur) {
      pulangMulai = cfg2.jadwal_harian[dayIdx2].pulang_mulai || pulangMulai;
    }

    let count = 0;
    for (const item of pulangList) {
      if (!item.rowIndex) continue;
      // Keterangan pulang
      const existing = absensiSheet.getRange(item.rowIndex, 7).getValue() || '';
      let ketBaru = String(existing);
      if (nowTimeStr < pulangMulai) {
        ketBaru = (ketBaru ? ketBaru + ' & ' : '') + 'Pulang Cepat (Input: ' + (namaPengirim || 'Guru') + ')';
      }
      absensiSheet.getRange(item.rowIndex, 6).setValue(jamSekarang);  // Kolom F: Jam Pulang
      absensiSheet.getRange(item.rowIndex, 7).setValue(ketBaru);       // Kolom G: Keterangan
      count++;
    }

    return { success: true, message: `${count} siswa berhasil dicatat pulang.` };
  } catch (e) {
    return { success: false, message: 'Terjadi kesalahan. Silakan coba lagi. (' + e.toString() + ')' };
  } finally {
    lock.releaseLock();
  }
}

// ============================================================
// DAFTAR HADIR GURU — Simpan/Timpa absensi satu kelas satu tanggal
// dataList: [{ nisn, nama, kelas, status }]
// ============================================================
function submitDaftarHadirGuru(dataList, tanggal, namaPengirim) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const ss = getSpreadsheet();
    const absensiSheet = ss.getSheetByName('absensi');
    if (!absensiSheet) return { success: false, message: 'Sheet "absensi" tidak ditemukan.' };

    // ── CEK HARI LIBUR untuk tanggal yang di-submit ──
    const todayStr = formatWaktuSheet(new Date(), 'yyyy-MM-dd');
    if (tanggal === todayStr) {
      // Cek jadwal_harian
      const configResult = getAppConfig();
      const config = configResult.success ? configResult.data : {};
      const dayIndex = formatWaktuSheet(new Date(), 'u');
      const dayNames = {'1':'Senin','2':'Selasa','3':'Rabu','4':'Kamis','5':'Jumat','6':'Sabtu','7':'Minggu'};
      if (config.jadwal_harian) {
        const todaySchedule = config.jadwal_harian[dayIndex];
        if (!todaySchedule || todaySchedule.libur) {
          return { success: false, message: `Hari ini ditetapkan libur (${dayNames[dayIndex] || ''}). Absensi tidak dapat diinput.` };
        }
      }
      // Cek tanggal merah
      const liburSheet = ss.getSheetByName('hari_libur');
      if (liburSheet) {
        const liburData = liburSheet.getDataRange().getValues();
        for (let i = 1; i < liburData.length; i++) {
          if (!liburData[i][0]) continue;
          if (formatWaktuSheet(new Date(liburData[i][0]), 'yyyy-MM-dd') === todayStr) {
            return { success: false, message: `Hari ini libur: ${liburData[i][1]}. Absensi tidak dapat diinput.` };
          }
        }
      }
    }
    // ─────────────────────────────────────────────────

    // Status map frontend ke format tersimpan
    const statusMap = { hadir: 'Hadir', sakit: 'Sakit', izin: 'Izin', alpa: 'Alpa' };

    // 1. Hapus baris lama untuk kelas+tanggal ini (timpa data)
    const allData = absensiSheet.getDataRange().getValues();
    const rowsToDelete = [];
    for (let i = 1; i < allData.length; i++) {
      if (!allData[i][0]) continue;
      const rowDate  = formatWaktuSheet(new Date(allData[i][0]), 'yyyy-MM-dd');
      const rowKelas = String(allData[i][3]).trim();
      const rowNisn  = String(allData[i][1]).replace(/^'/, '').trim();
      const isInList = dataList.some(d => String(d.nisn).trim() === rowNisn);
      if (rowDate === tanggal && rowKelas === dataList[0]?.kelas && isInList) {
        rowsToDelete.push(i + 1);
      }
    }
    for (let r = rowsToDelete.length - 1; r >= 0; r--) {
      absensiSheet.deleteRow(rowsToDelete[r]);
    }

    // 2. Tulis baris baru — sertakan jam & keterangan waktu jika input hari ini
    const jamSekarang = formatWaktuSheet(new Date(), 'HH:mm:ss');
    const nowTimeStr  = formatWaktuSheet(new Date(), 'HH:mm');
    const isToday = (tanggal === todayStr);

    // Ambil config jam untuk hitung terlambat / pulang cepat
    const configResult2 = getAppConfig();
    const cfg = configResult2.success ? configResult2.data : {};
    const dayIdx2 = formatWaktuSheet(new Date(), 'u');
    let cfgJam = {
      jam_masuk_akhir:  '07:15',
      jam_pulang_mulai: '15:00',
      jam_pulang_akhir: '17:00'
    };
    if (cfg.jadwal_harian && cfg.jadwal_harian[dayIdx2] && !cfg.jadwal_harian[dayIdx2].libur) {
      const sc = cfg.jadwal_harian[dayIdx2];
      cfgJam.jam_masuk_akhir  = sc.masuk_akhir  || cfgJam.jam_masuk_akhir;
      cfgJam.jam_pulang_mulai = sc.pulang_mulai || cfgJam.jam_pulang_mulai;
      cfgJam.jam_pulang_akhir = sc.pulang_akhir || cfgJam.jam_pulang_akhir;
    } else {
      cfgJam.jam_masuk_akhir  = cfg.jam_masuk_akhir  || cfgJam.jam_masuk_akhir;
      cfgJam.jam_pulang_mulai = cfg.jam_pulang_mulai || cfgJam.jam_pulang_mulai;
      cfgJam.jam_pulang_akhir = cfg.jam_pulang_akhir || cfgJam.jam_pulang_akhir;
    }

    const newRows = dataList.map(d => {
      const statusFinal = statusMap[d.status] || d.status;
      const isHadir     = (statusFinal === 'Hadir');

      let jamDatangRow = '';
      let keteranganRow = 'Input: ' + (namaPengirim || 'Guru');

      if (isToday && isHadir) {
        jamDatangRow = jamSekarang;
        // Hitung keterangan waktu
        if (nowTimeStr > cfgJam.jam_masuk_akhir) {
          const lateMin = calculateTimeDiff(cfgJam.jam_masuk_akhir, nowTimeStr);
          keteranganRow = `Terlambat ${lateMin} menit (Input: ${namaPengirim || 'Guru'})`;
        } else {
          keteranganRow = 'Tepat Waktu (Input: ' + (namaPengirim || 'Guru') + ')';
        }
      }

      return [
        tanggal,                    // Kolom A: Tanggal
        "'" + String(d.nisn).trim(),// Kolom B: NISN
        d.nama,                     // Kolom C: Nama
        d.kelas,                    // Kolom D: Kelas
        jamDatangRow,               // Kolom E: Jam Datang
        '',                         // Kolom F: Jam Pulang
        keteranganRow,              // Kolom G: Keterangan
        statusFinal                 // Kolom H: Status
      ];
    });

    if (newRows.length > 0) {
      absensiSheet.getRange(
        absensiSheet.getLastRow() + 1, 1, newRows.length, 8
      ).setValues(newRows);
    }

    return { success: true, message: `${newRows.length} data absensi berhasil disimpan.` };

  } catch (e) {
    return { success: false, message: 'Gagal menyimpan data. Silakan coba lagi. (' + e.toString() + ')' };
  } finally {
    lock.releaseLock();
  }
}