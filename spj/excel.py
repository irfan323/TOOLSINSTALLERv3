"""Generator workbook Excel untuk SPJ beserta seluruh lampiran.

Menghasilkan satu file .xlsx multi-sheet:
  - Daftar Isi
  - Kuitansi / Bukti Pembayaran
  - HPS (Kopi & Make Up)
  - Lampiran Surat Pesanan / Daftar Permintaan (Kopi & Make Up)
  - Lampiran BA Pemeriksaan Hasil Pekerjaan (Kopi & Make Up)
  - Lampiran BA Serah Terima Hasil Pekerjaan (Kopi & Make Up)
  - Lampiran BA Pembayaran (Kopi & Make Up)
  - Lampiran Invoice Tagihan (Kopi & Make Up)
"""

from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, Border, Side, PatternFill
from openpyxl.utils import get_column_letter

from . import config
from .items import KOPI, MAKEUP, hitung_total
from .terbilang import terbilang

# --------------------------------------------------------------------------
# Gaya
# --------------------------------------------------------------------------
RP_FMT = '#,##0'
THIN = Side(style="thin")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
HEADER_FILL = PatternFill("solid", fgColor="D9E1F2")
TOTAL_FILL = PatternFill("solid", fgColor="FCE4D6")

CENTER = Alignment(horizontal="center", vertical="center", wrap_text=True)
LEFT = Alignment(horizontal="left", vertical="center", wrap_text=True)
RIGHT = Alignment(horizontal="right", vertical="center")
CENTER_TOP = Alignment(horizontal="center", vertical="top", wrap_text=True)

F_TITLE = Font(name="Arial", size=12, bold=True)
F_SUB = Font(name="Arial", size=10, bold=True)
F_NORM = Font(name="Arial", size=10)
F_SMALL = Font(name="Arial", size=8)
F_HEAD = Font(name="Arial", size=10, bold=True)


# --------------------------------------------------------------------------
# Helper
# --------------------------------------------------------------------------
def _merge(ws, r, c1, c2, value, font=F_NORM, align=CENTER):
    ws.merge_cells(start_row=r, start_column=c1, end_row=r, end_column=c2)
    cell = ws.cell(row=r, column=c1, value=value)
    cell.font = font
    cell.alignment = align
    return cell


def _kop_surat(ws, last_col):
    """Tulis kop surat instansi (5 baris) lalu garis pemisah."""
    I = config.INSTANSI
    rows = [
        (I["kementerian"], F_SUB),
        (I["direktorat"], F_SUB),
        (f"{I['balai']} {I['kota']}", F_TITLE),
        (I["alamat"], F_SMALL),
        (I["kontak"], F_SMALL),
    ]
    for i, (text, font) in enumerate(rows, start=1):
        _merge(ws, i, 1, last_col, text, font=font)
    # garis bawah kop
    for col in range(1, last_col + 1):
        ws.cell(row=6, column=col).border = Border(bottom=Side(style="medium"))
    return 7  # baris lanjutan


def _autosize(ws, widths):
    for i, w in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(i)].width = w


def _signature(ws, row, col_kiri, col_kanan, kiri, kanan, last_col):
    """Blok tanda tangan dua kolom (kiri & kanan)."""
    # baris jabatan
    _merge(ws, row, col_kiri[0], col_kiri[1], kiri["jabatan1"], font=F_NORM)
    _merge(ws, row, col_kanan[0], col_kanan[1], kanan["jabatan1"], font=F_NORM)
    _merge(ws, row + 1, col_kiri[0], col_kiri[1], kiri.get("jabatan2", ""), font=F_NORM)
    _merge(ws, row + 1, col_kanan[0], col_kanan[1], kanan.get("jabatan2", ""), font=F_NORM)
    # ruang tanda tangan
    nama_row = row + 5
    c = _merge(ws, nama_row, col_kiri[0], col_kiri[1], kiri["nama"], font=F_SUB)
    c.font = Font(name="Arial", size=10, bold=True, underline="single")
    c = _merge(ws, nama_row, col_kanan[0], col_kanan[1], kanan["nama"], font=F_SUB)
    c.font = Font(name="Arial", size=10, bold=True, underline="single")
    _merge(ws, nama_row + 1, col_kiri[0], col_kiri[1], kiri.get("ket", ""), font=F_NORM)
    _merge(ws, nama_row + 1, col_kanan[0], col_kanan[1], kanan.get("ket", ""), font=F_NORM)
    return nama_row + 2


# --------------------------------------------------------------------------
# Tabel item
# --------------------------------------------------------------------------
def _tabel_harga(ws, start_row, items, nilai_total=None):
    """Tabel lampiran dengan harga. Kolom:
    No | Nama Bahan | Spesifikasi Teknis | Volume | Satuan | Harga Satuan | Jumlah
    """
    headers = ["No", "Nama Bahan", "Spesifikasi Teknis", "Volume",
               "Satuan", "Harga Satuan (Rp)", "Jumlah (Rp)"]
    r = start_row
    for c, h in enumerate(headers, start=1):
        cell = ws.cell(row=r, column=c, value=h)
        cell.font = F_HEAD
        cell.alignment = CENTER
        cell.border = BORDER
        cell.fill = HEADER_FILL
    r += 1
    subtotal = 0
    for idx, (nama, spek, vol, satuan, harga) in enumerate(items, start=1):
        jumlah = vol * harga
        subtotal += jumlah
        vals = [idx, nama, spek, vol, satuan, harga, jumlah]
        for c, v in enumerate(vals, start=1):
            cell = ws.cell(row=r, column=c, value=v)
            cell.border = BORDER
            cell.font = F_NORM
            if c == 1 or c == 4:
                cell.alignment = CENTER
            elif c == 5:
                cell.alignment = CENTER
            elif c in (6, 7):
                cell.alignment = RIGHT
                cell.number_format = RP_FMT
            else:
                cell.alignment = LEFT
        r += 1
    # baris TOTAL
    total = nilai_total if nilai_total is not None else subtotal
    _merge(ws, r, 1, 6, "TOTAL", font=F_HEAD, align=RIGHT)
    for c in range(1, 7):
        ws.cell(row=r, column=c).border = BORDER
        ws.cell(row=r, column=c).fill = TOTAL_FILL
    tc = ws.cell(row=r, column=7, value=total)
    tc.font = F_HEAD
    tc.alignment = RIGHT
    tc.number_format = RP_FMT
    tc.border = BORDER
    tc.fill = TOTAL_FILL
    r += 1
    # terbilang
    _merge(ws, r, 1, 7, f"Terbilang : {terbilang(total)}", font=Font(
        name="Arial", size=10, bold=True, italic=True), align=LEFT)
    return r + 1, total


def _tabel_tanpa_harga(ws, start_row, items, keterangan=""):
    """Tabel lampiran tanpa harga. Kolom:
    No | Nama Bahan | Spesifikasi Teknis | Volume | Satuan | Keterangan
    """
    headers = ["No", "Nama Bahan", "Spesifikasi Teknis", "Volume",
               "Satuan", "Keterangan"]
    r = start_row
    for c, h in enumerate(headers, start=1):
        cell = ws.cell(row=r, column=c, value=h)
        cell.font = F_HEAD
        cell.alignment = CENTER
        cell.border = BORDER
        cell.fill = HEADER_FILL
    r += 1
    for idx, (nama, spek, vol, satuan, _harga) in enumerate(items, start=1):
        vals = [idx, nama, spek, vol, satuan, keterangan]
        for c, v in enumerate(vals, start=1):
            cell = ws.cell(row=r, column=c, value=v)
            cell.border = BORDER
            cell.font = F_NORM
            if c in (1, 4, 5):
                cell.alignment = CENTER
            elif c == 6:
                cell.alignment = CENTER
            else:
                cell.alignment = LEFT
        r += 1
    return r


# --------------------------------------------------------------------------
# Pembuatan tiap jenis sheet
# --------------------------------------------------------------------------
def _set_print(ws, last_col, landscape=False):
    ws.print_options.horizontalCentered = True
    ws.page_setup.orientation = "landscape" if landscape else "portrait"
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.page_margins.left = ws.page_margins.right = 0.4
    ws.print_area = f"A1:{get_column_letter(last_col)}{ws.max_row}"


def sheet_kuitansi(wb):
    ws = wb.create_sheet("Kuitansi")
    last_col = 6
    _autosize(ws, [6, 22, 14, 6, 16, 16])
    r = _kop_surat(ws, last_col)
    D = config.DOKUMEN
    total = config.NILAI_KONTRAK["total"]

    _merge(ws, r, 1, 3, f"Tahun Anggaran : {D['tahun_anggaran']}", font=F_NORM, align=LEFT)
    _merge(ws, r + 1, 1, 3, "Nomor Bukti     : ................", font=F_NORM, align=LEFT)
    _merge(ws, r + 2, 1, 3, "MAK              : ................", font=F_NORM, align=LEFT)
    r += 4
    _merge(ws, r, 1, last_col, "KUITANSI / BUKTI PEMBAYARAN", font=F_TITLE)
    r += 2
    _merge(ws, r, 1, last_col,
           "Sudah terima dari : Kuasa Pengguna Anggaran Balai Besar Pelatihan "
           "Vokasi dan Produktivitas Makassar", font=F_NORM, align=LEFT)
    r += 1
    _merge(ws, r, 1, last_col, f"Uang sejumlah     : Rp {total:,.0f}", font=F_SUB, align=LEFT)
    r += 1
    _merge(ws, r, 1, last_col, f"Terbilang         : {terbilang(total)}",
           font=Font(name="Arial", size=10, italic=True), align=LEFT)
    r += 1
    _merge(ws, r, 1, last_col, f"Untuk pembayaran  : {D['kegiatan']}", font=F_NORM, align=LEFT)
    r += 3

    # Tanda tangan: kiri Setuju dibayar PPK, kanan Yang menerima Penyedia
    _merge(ws, r, 1, 3, config.DOKUMEN["kota_tanggal"], font=F_NORM)
    _merge(ws, r, 4, 6, "Yang menerima,", font=F_NORM)
    _merge(ws, r + 1, 1, 3, "Setuju dibayar,", font=F_NORM)
    _merge(ws, r + 1, 4, 6, config.PENYEDIA["nama"], font=F_NORM)
    _merge(ws, r + 2, 1, 3, "Pejabat Pembuat Komitmen", font=F_NORM)
    rr = r + 6
    c = _merge(ws, rr, 1, 3, config.PPK["nama"], font=F_SUB)
    c.font = Font(name="Arial", size=10, bold=True, underline="single")
    c = _merge(ws, rr, 4, 6, config.PENYEDIA["direktur"], font=F_SUB)
    c.font = Font(name="Arial", size=10, bold=True, underline="single")
    _merge(ws, rr + 1, 1, 3, f"NIP. {config.PPK['nip']}", font=F_NORM)
    _merge(ws, rr + 1, 4, 6, config.PENYEDIA["jabatan"], font=F_NORM)
    _set_print(ws, last_col)
    return ws


def sheet_hps(wb, paket, nama_sheet):
    ws = wb.create_sheet(nama_sheet)
    last_col = 7
    _autosize(ws, [5, 24, 40, 8, 8, 16, 16])
    r = _kop_surat(ws, last_col)
    _merge(ws, r, 1, last_col, "HARGA PERKIRAAN SENDIRI (HPS)", font=F_TITLE)
    _merge(ws, r + 1, 1, last_col, "BAHAN PELATIHAN BERBASIS KOMPETENSI", font=F_SUB)
    r += 2
    info = [
        f"KEJURUAN          : {paket['kejuruan']}",
        f"BIDANG KEAHLIAN   : {paket['bidang']}",
        f"JUMLAH JAM        : {paket['jam']}",
        f"TAHUN ANGGARAN    : {config.DOKUMEN['sumber_dana']}",
    ]
    for line in info:
        _merge(ws, r, 1, last_col, line, font=F_NORM, align=LEFT)
        r += 1
    r += 1
    end_row, total = _tabel_harga(ws, r, paket["items"])
    r = end_row + 2
    _merge(ws, r, 4, 7, config.DOKUMEN["kota_tanggal"], font=F_NORM)
    _merge(ws, r + 1, 4, 7, "Pejabat Pembuat Komitmen", font=F_NORM)
    _merge(ws, r + 2, 4, 7, "BBPVP Makassar", font=F_NORM)
    c = _merge(ws, r + 6, 4, 7, config.PPK["nama"], font=F_SUB)
    c.font = Font(name="Arial", size=10, bold=True, underline="single")
    _merge(ws, r + 7, 4, 7, f"NIP. {config.PPK['nip']}", font=F_NORM)
    _set_print(ws, last_col, landscape=True)
    return ws


def sheet_lampiran_polos(wb, paket, nama_sheet, judul_lampiran, nomor, tanggal,
                         keterangan="", ttd="pengadaan"):
    """Lampiran tanpa harga (Surat Pesanan / BA Pemeriksaan / BA Serah Terima)."""
    ws = wb.create_sheet(nama_sheet)
    last_col = 6
    _autosize(ws, [5, 26, 46, 8, 8, 22])
    r = 1
    for line in judul_lampiran:
        _merge(ws, r, 1, last_col, line, font=F_SUB, align=LEFT)
        r += 1
    _merge(ws, r, 1, last_col, f"NOMOR   : {nomor}", font=F_NORM, align=LEFT)
    _merge(ws, r + 1, 1, last_col, f"TANGGAL : {tanggal}", font=F_NORM, align=LEFT)
    _merge(ws, r + 2, 1, last_col,
           f"Kejuruan : {paket['judul']}", font=F_NORM, align=LEFT)
    r += 4
    end = _tabel_tanpa_harga(ws, r, paket["items"], keterangan=keterangan)
    r = end + 2
    # tanda tangan
    if ttd == "pengadaan":
        _merge(ws, r, 4, 6, "Pejabat Pengadaan Barang/Jasa", font=F_NORM)
        nm, nip = config.PEJABAT_PENGADAAN["nama"], config.PEJABAT_PENGADAAN["nip"]
    else:  # ppk
        _merge(ws, r, 4, 6, "Pejabat Pembuat Komitmen", font=F_NORM)
        nm, nip = config.PPK["nama"], config.PPK["nip"]
    _merge(ws, r + 1, 4, 6, "BBPVP Makassar", font=F_NORM)
    c = _merge(ws, r + 5, 4, 6, nm, font=F_SUB)
    c.font = Font(name="Arial", size=10, bold=True, underline="single")
    _merge(ws, r + 6, 4, 6, f"NIP. {nip}", font=F_NORM)
    _set_print(ws, last_col, landscape=True)
    return ws


def sheet_lampiran_harga(wb, paket, nama_sheet, judul_lampiran, nomor, tanggal,
                         nilai_total, ttd_dua=False):
    """Lampiran dengan harga (BA Pembayaran / Invoice)."""
    ws = wb.create_sheet(nama_sheet)
    last_col = 7
    _autosize(ws, [5, 24, 40, 8, 8, 16, 16])
    r = 1
    for line in judul_lampiran:
        _merge(ws, r, 1, last_col, line, font=F_SUB, align=LEFT)
        r += 1
    _merge(ws, r, 1, last_col, f"NOMOR   : {nomor}", font=F_NORM, align=LEFT)
    _merge(ws, r + 1, 1, last_col, f"TANGGAL : {tanggal}", font=F_NORM, align=LEFT)
    _merge(ws, r + 2, 1, last_col, f"Kejuruan : {paket['judul']}", font=F_NORM, align=LEFT)
    r += 4
    end, total = _tabel_harga(ws, r, paket["items"], nilai_total=nilai_total)
    r = end + 2
    if ttd_dua:
        _merge(ws, r, 1, 3, "Wakil Penyedia", font=F_NORM)
        _merge(ws, r, 5, 7, "Pejabat Pembuat Komitmen", font=F_NORM)
        _merge(ws, r + 1, 1, 3, config.PENYEDIA["nama"], font=F_NORM)
        _merge(ws, r + 1, 5, 7, "BBPVP Makassar", font=F_NORM)
        c = _merge(ws, r + 5, 1, 3, config.PENYEDIA["direktur"], font=F_SUB)
        c.font = Font(name="Arial", size=10, bold=True, underline="single")
        c = _merge(ws, r + 5, 5, 7, config.PPK["nama"], font=F_SUB)
        c.font = Font(name="Arial", size=10, bold=True, underline="single")
        _merge(ws, r + 6, 1, 3, config.PENYEDIA["jabatan"], font=F_NORM)
        _merge(ws, r + 6, 5, 7, f"NIP. {config.PPK['nip']}", font=F_NORM)
    else:
        _merge(ws, r, 5, 7, config.PENYEDIA["nama"], font=F_NORM)
        c = _merge(ws, r + 4, 5, 7, config.PENYEDIA["direktur"], font=F_SUB)
        c.font = Font(name="Arial", size=10, bold=True, underline="single")
        _merge(ws, r + 5, 5, 7, config.PENYEDIA["jabatan"], font=F_NORM)
    _set_print(ws, last_col, landscape=True)
    return ws


def sheet_daftar_isi(wb, daftar):
    ws = wb.create_sheet("Daftar Isi", 0)
    last_col = 3
    _autosize(ws, [6, 55, 22])
    r = _kop_surat(ws, last_col)
    _merge(ws, r, 1, last_col, "SURAT PERTANGGUNGJAWABAN (SPJ)", font=F_TITLE)
    _merge(ws, r + 1, 1, last_col, config.DOKUMEN["kegiatan"], font=F_SUB)
    _merge(ws, r + 2, 1, last_col,
           f"Tahun Anggaran {config.DOKUMEN['tahun_anggaran']}", font=F_NORM)
    r += 4
    for c, h in enumerate(["No", "Dokumen / Lampiran", "Sheet"], start=1):
        cell = ws.cell(row=r, column=c, value=h)
        cell.font = F_HEAD
        cell.alignment = CENTER
        cell.border = BORDER
        cell.fill = HEADER_FILL
    r += 1
    for i, nama in enumerate(daftar, start=1):
        for c, v in enumerate([i, nama, nama], start=1):
            cell = ws.cell(row=r, column=c, value=v)
            cell.border = BORDER
            cell.font = F_NORM
            cell.alignment = CENTER if c in (1, 3) else LEFT
        r += 1
    _set_print(ws, last_col)
    return ws


# --------------------------------------------------------------------------
# Orkestrasi
# --------------------------------------------------------------------------
def build_workbook():
    wb = Workbook()
    wb.remove(wb.active)  # buang sheet default
    D = config.DOKUMEN
    NK = config.NILAI_KONTRAK
    tgl = D["tanggal_dokumen"]

    # 1. Kuitansi
    sheet_kuitansi(wb)

    # 2-3. HPS
    sheet_hps(wb, KOPI, "HPS - Kopi")
    sheet_hps(wb, MAKEUP, "HPS - Make Up")

    # 4-5. Lampiran Surat Pesanan (Daftar Permintaan) - tanpa harga
    sp_judul = ["LAMPIRAN : SURAT PESANAN", "DAFTAR PERMINTAAN BAHAN PELATIHAN"]
    sheet_lampiran_polos(wb, KOPI, "SP - Kopi", sp_judul,
                         D["no_surat_pesanan"], "April 2026", ttd="pengadaan")
    sheet_lampiran_polos(wb, MAKEUP, "SP - Make Up", sp_judul,
                         D["no_surat_pesanan"], "April 2026", ttd="pengadaan")

    # 6-7. Lampiran BA Pemeriksaan - tanpa harga, keterangan kondisi
    bap_judul = ["LAMPIRAN : Berita Acara Penelitian dan Pemeriksaan Hasil Pekerjaan"]
    sheet_lampiran_polos(wb, KOPI, "BA Pemeriksaan - Kopi", bap_judul,
                         D["no_ba_pemeriksaan"], tgl,
                         keterangan="Kondisi Baik dan Lengkap", ttd="ppk")
    sheet_lampiran_polos(wb, MAKEUP, "BA Pemeriksaan - Make Up", bap_judul,
                         D["no_ba_pemeriksaan"], tgl,
                         keterangan="Kondisi Baik dan Lengkap", ttd="ppk")

    # 8-9. Lampiran BA Serah Terima - tanpa harga
    bast_judul = ["LAMPIRAN : Berita Acara Serah Terima Hasil Pekerjaan"]
    sheet_lampiran_polos(wb, KOPI, "BA Serah Terima - Kopi", bast_judul,
                         D["no_ba_serah_terima"], tgl,
                         keterangan="Kondisi Baik dan Lengkap", ttd="ppk")
    sheet_lampiran_polos(wb, MAKEUP, "BA Serah Terima - Make Up", bast_judul,
                         D["no_ba_serah_terima"], tgl,
                         keterangan="Kondisi Baik dan Lengkap", ttd="ppk")

    # 10-11. Lampiran BA Pembayaran - dengan harga (nilai kontrak)
    bayar_judul = ["LAMPIRAN : Berita Acara Pembayaran"]
    sheet_lampiran_harga(wb, KOPI, "BA Pembayaran - Kopi", bayar_judul,
                         D["no_ba_pembayaran"], tgl, NK["kopi"], ttd_dua=True)
    sheet_lampiran_harga(wb, MAKEUP, "BA Pembayaran - Make Up", bayar_judul,
                         D["no_ba_pembayaran"], tgl, NK["makeup"], ttd_dua=True)

    # 12-13. Lampiran Invoice - dengan harga (nilai kontrak)
    inv_judul = ["LAMPIRAN INVOICE TAGIHAN"]
    sheet_lampiran_harga(wb, KOPI, "Invoice - Kopi", inv_judul,
                         D["no_invoice"], tgl, NK["kopi"], ttd_dua=False)
    sheet_lampiran_harga(wb, MAKEUP, "Invoice - Make Up", inv_judul,
                         D["no_invoice"], tgl, NK["makeup"], ttd_dua=False)

    # Daftar isi (disisipkan di awal)
    daftar = [ws.title for ws in wb.worksheets]
    sheet_daftar_isi(wb, daftar)

    return wb


def generate(path="SPJ_BBPVP_Makassar.xlsx"):
    wb = build_workbook()
    wb.save(path)
    return path
