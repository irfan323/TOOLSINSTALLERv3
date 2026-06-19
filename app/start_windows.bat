@echo off
REM ============================================================
REM  SPJ BOS Otomatis - Klik dua kali file ini untuk menjalankan
REM ============================================================
title SPJ BOS Otomatis
cd /d "%~dp0"

echo.
echo [*] Menyiapkan aplikasi (sekali saja akan agak lama)...
echo.

REM Cari Python
where python >nul 2>nul
if errorlevel 1 (
  echo [X] Python belum terpasang.
  echo     Silakan pasang Python dari https://www.python.org/downloads/
  echo     PENTING: centang "Add Python to PATH" saat memasang.
  echo.
  pause
  exit /b 1
)

REM Buat virtual environment bila belum ada
if not exist ".venv\" (
  echo [*] Membuat lingkungan Python...
  python -m venv .venv
)

call .venv\Scripts\activate.bat

echo [*] Memasang Flask...
python -m pip install --quiet --upgrade pip
python -m pip install --quiet flask

REM WeasyPrint opsional (untuk unduh PDF langsung). Bila gagal, aplikasi
REM tetap jalan; PDF tetap bisa lewat browser (Ctrl+P -> Simpan sebagai PDF).
python -m pip install --quiet weasyprint 2>nul

echo.
echo [*] Menjalankan aplikasi. Browser akan terbuka otomatis.
echo     Untuk berhenti: tutup jendela ini atau tekan Ctrl+C.
echo.
python app.py

pause
