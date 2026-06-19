"""Generator workbook Excel untuk SPJ beserta seluruh lampiran.

Menghasilkan satu file .xlsx multi-sheet yang rapi & siap cetak:
  - Daftar Isi
  - Kuitansi / Bukti Pembayaran
  - HPS (Kopi & Make Up)
  - Lampiran Surat Pesanan / Daftar Permintaan (Kopi & Make Up)
  - Lampiran BA Pemeriksaan Hasil Pekerjaan (Kopi & Make Up)
  - Lampiran BA Serah Terima Hasil Pekerjaan (Kopi & Make Up)
  - Lampiran BA Pembayaran (Kopi & Make Up)
  - Lampiran Invoice Tagihan (Kopi & Make Up)
"""

import math

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
THIN = Side(style="thin", color="9E9E9E")
MED = Side(style="medium", color="404040")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
HEADER_FILL = PatternFill("solid", fgColor="1F4E78")   # biru tua
ZEBRA_FILL = PatternFill("solid", fgColor="F2F6FB")    # biru sangat muda
TOTAL_FILL = PatternFill("solid", fgColor="FCE4D6")    # oranye muda

CENTER = Alignment(horizontal="center", vertical="center", wrap_text=True)
CENTER_TOP = Alignment(horizontal="center", vertical="top", wrap_text=True)
LEFT = Alignment(horizontal="left", vertical="top", wrap_text=True)
LEFT_MID = Alignment(horizontal="left", vertical="center", wrap_text=True)
RIGHT = Alignment(horizontal="right", vertical="center")
RIGHT_TOP = Alignment(horizontal="right", vertical="top")

F_TITLE = Font(name="Arial", size=13, bold=True)
F_SUB = Font(name="Arial", size=10, bold=True)
F_NORM = Font(name="Arial", size=10)
F_SMALL = Font(name="Arial", size=8)
F_HEAD = Font(name="Arial", size=10, bold=True, color="FFFFFF")
F_NAMA = Font(name="Arial", size=10, color="FFFFFF")  # tdk dipakai, jaga2
F_NAME_UL = Font(name="Arial", size=10, bold=True, underline="single")


# --------------------------------------------------------------------------
# Helper umum
# --------------------------------------------------------------------------
def _merge(ws, r, c1, c2, value, font=F_NORM, align=CENTER):
    ws.merge_cells(start_row=r, start_column=c1, end_row=r, end_column=c2)
    cell = ws.cell(row=r, column=c1, value=value)
    cell.font = font
    cell.alignment = align
    return cell


def _autosize(ws, widths):
    for i, w in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(i)].width = w


def _row_height(pairs):
    """Perkirakan tinggi baris dari pasangan (teks, lebar_kolom_char)."""
    lines = 1
    for text, width in pairs:
        if not text:
            continue
        lines = max(lines, math.ceil(len(str(text)) / max(width - 2, 6)))
    return 15 * lines + 5


def _kop_surat(ws, last_col):
    """Tulis kop surat instansi (5 baris) lalu garis pemisah tebal."""
    I = config.INSTANSI
    rows = [
        (I["kementerian"], F_SUB, 16),
        (I["direktorat"], F_SUB, 16),
        (f"{I['balai']} {I['kota']}", F_TITLE, 20),
        (I["alamat"], F_SMALL, 24),
        (I["kontak"], F_SMALL, 14),
    ]
    for i, (text, font, h) in enumerate(rows, start=1):
        _merge(ws, i, 1, last_col, text, font=font)
        ws.row_dimensions[i].height = h
    for col in range(1, last_col + 1):
        ws.cell(row=6, column=col).border = Border(bottom=MED)
    ws.row_dimensions[6].height = 6
    return 7


def _set_print(ws, last_col, landscape=False):
    ws.sheet_view.showGridLines = False
    ws.print_options.horizontalCentered = True
    ws.page_setup.orientation = "landscape" if landscape else "portrait"
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.page_margins.left = ws.page_margins.right = 0.4
    ws.page_margins.top = ws.page_margins.bottom = 0.5
    ws.print_area = f"A1:{get_column_letter(last_col)}{ws.max_row}"


def _ttd_nama(ws, r, c1, c2, nama):
    c = _merge(ws, r, c1, c2, nama, font=F_NAME_UL)
    c.font = F_NAME_UL
    return c


# --------------------------------------------------------------------------
# Tabel item
# --------------------------------------------------------------------------
def _tabel_harga(ws, start_row, items, widths, nilai_total=None):
    """Tabel lampiran dengan harga.
    Kolom: No | Nama Bahan | Spesifikasi Teknis | Volume | Satuan | Harga Satuan | Jumlah
    """
    w_nama, w_spek = widths[1], widths[2]
    headers = ["No", "Nama Bahan", "Spesifikasi Teknis", "Volume",
               "Satuan", "Harga Satuan (Rp)", "Jumlah (Rp)"]
    r = start_row
    for c, h in enumerate(headers, start=1):
        cell = ws.cell(row=r, column=c, value=h)
        cell.font = F_HEAD
        cell.alignment = CENTER
        cell.border = BORDER
        cell.fill = HEADER_FILL
    ws.row_dimensions[r].height = 30
    ws.freeze_panes = ws.cell(row=r + 1, column=1)
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
            if c == 1:
                cell.alignment = CENTER_TOP
            elif c in (4, 5):
                cell.alignment = CENTER_TOP
            elif c in (6, 7):
                cell.alignment = RIGHT_TOP
                cell.number_format = RP_FMT
            else:
                cell.alignment = LEFT
            if idx % 2 == 0:
                cell.fill = ZEBRA_FILL
        ws.row_dimensions[r].height = _row_height([(nama, w_nama), (spek, w_spek)])
        r += 1
    # baris TOTAL
    total = nilai_total if nilai_total is not None else subtotal
    _merge(ws, r, 1, 6, "TOTAL", font=F_SUB, align=RIGHT)
    for c in range(1, 7):
        ws.cell(row=r, column=c).border = BORDER
        ws.cell(row=r, column=c).fill = TOTAL_FILL
    tc = ws.cell(row=r, column=7, value=total)
    tc.font = F_SUB
    tc.alignment = RIGHT
    tc.number_format = RP_FMT
    tc.border = BORDER
    tc.fill = TOTAL_FILL
    ws.row_dimensions[r].height = 20
    r += 1
    _merge(ws, r, 1, 7, f"Terbilang : {terbilang(total)}",
           font=Font(name="Arial", size=10, bold=True, italic=True), align=LEFT_MID)
    ws.row_dimensions[r].height = 20
    return r + 1, total


def _tabel_tanpa_harga(ws, start_row, items, widths, keterangan=""):
    """Tabel lampiran tanpa harga.
    Kolom: No | Nama Bahan | Spesifikasi Teknis | Volume | Satuan | Keterangan
    """
    w_nama, w_spek = widths[1], widths[2]
    headers = ["No", "Nama Bahan", "Spesifikasi Teknis", "Volume",
               "Satuan", "Keterangan"]
    r = start_row
    for c, h in enumerate(headers, start=1):
        cell = ws.cell(row=r, column=c, value=h)
        cell.font = F_HEAD
        cell.alignment = CENTER
        cell.border = BORDER
        cell.fill = HEADER_FILL
    ws.row_dimensions[r].height = 24
    ws.freeze_panes = ws.cell(row=r + 1, column=1)
    r += 1
    for idx, (nama, spek, vol, satuan, _harga) in enumerate(items, start=1):
        vals = [idx, nama, spek, vol, satuan, keterangan]
        for c, v in enumerate(vals, start=1):
            cell = ws.cell(row=r, column=c, value=v)
            cell.border = BORDER
            cell.font = F_NORM
            if c in (1, 4, 5, 6):
                cell.alignment = CENTER_TOP
            else:
                cell.alignment = LEFT
            if idx % 2 == 0:
                cell.fill = ZEBRA_FILL
        ws.row_dimensions[r].height = _row_height([(nama, w_nama), (spek, w_spek)])
        r += 1
    return r


# --------------------------------------------------------------------------
# Sheet builders
# --------------------------------------------------------------------------
def sheet_kuitansi(wb):
    ws = wb.create_sheet("Kuitansi")
    last_col = 6
    widths = [6, 22, 14, 8, 16, 16]
    _autosize(ws, widths)
    r = _kop_surat(ws, last_col)
    D = config.DOKUMEN
    total = config.NILAI_KONTRAK["total"]

    _merge(ws, r, 1, 3, f"Tahun Anggaran : {D['tahun_anggaran']}", font=F_NORM, align=LEFT_MID)
    _merge(ws, r + 1, 1, 3, "Nomor Bukti     : ................", font=F_NORM, align=LEFT_MID)
    _merge(ws, r + 2, 1, 3, "MAK              : ................", font=F_NORM, align=LEFT_MID)
    r += 4
    c = _merge(ws, r, 1, last_col, "KUITANSI / BUKTI PEMBAYARAN", font=F_TITLE)
    ws.row_dimensions[r].height = 24
    r += 2
    _merge(ws, r, 1, last_col,
           "Sudah terima dari : Kuasa Pengguna Anggaran Balai Besar Pelatihan "
           "Vokasi dan Produktivitas Makassar", font=F_NORM, align=LEFT_MID)
    ws.row_dimensions[r].height = 30
    r += 1
    box = _merge(ws, r, 1, last_col, f"Uang sejumlah     :  Rp {total:,.0f}", font=F_SUB, align=LEFT_MID)
    box.fill = TOTAL_FILL
    for col in range(1, last_col + 1):
        ws.cell(row=r, column=col).border = BORDER
    r += 1
    _merge(ws, r, 1, last_col, f"Terbilang         :  {terbilang(total)}",
           font=Font(name="Arial", size=10, bold=True, italic=True), align=LEFT_MID)
    ws.row_dimensions[r].height = 20
    r += 1
    _merge(ws, r, 1, last_col, f"Untuk pembayaran  :  {D['kegiatan']}", font=F_NORM, align=LEFT_MID)
    ws.row_dimensions[r].height = 30
    r += 2

    _merge(ws, r, 1, 3, config.DOKUMEN["kota_tanggal"], font=F_NORM)
    _merge(ws, r, 4, 6, "Yang menerima,", font=F_NORM)
    _merge(ws, r + 1, 1, 3, "Setuju dibayar,", font=F_NORM)
    _merge(ws, r + 1, 4, 6, config.PENYEDIA["nama"], font=F_NORM)
    _merge(ws, r + 2, 1, 3, "Pejabat Pembuat Komitmen", font=F_NORM)
    ws.row_dimensions[r + 4].height = 18  # ruang ttd
    ws.row_dimensions[r + 5].height = 18
    rr = r + 6
    _ttd_nama(ws, rr, 1, 3, config.PPK["nama"])
    _ttd_nama(ws, rr, 4, 6, config.PENYEDIA["direktur"])
    _merge(ws, rr + 1, 1, 3, f"NIP. {config.PPK['nip']}", font=F_NORM)
    _merge(ws, rr + 1, 4, 6, config.PENYEDIA["jabatan"], font=F_NORM)
    _set_print(ws, last_col)
    return ws


def sheet_hps(wb, paket, nama_sheet):
    ws = wb.create_sheet(nama_sheet)
    last_col = 7
    widths = [5, 24, 50, 8, 9, 16, 17]
    _autosize(ws, widths)
    r = _kop_surat(ws, last_col)
    _merge(ws, r, 1, last_col, "HARGA PERKIRAAN SENDIRI (HPS)", font=F_TITLE)
    ws.row_dimensions[r].height = 22
    _merge(ws, r + 1, 1, last_col, "BAHAN PELATIHAN BERBASIS KOMPETENSI", font=F_SUB)
    r += 3
    info = [
        f"KEJURUAN          : {paket['kejuruan']}",
        f"BIDANG KEAHLIAN   : {paket['bidang']}",
        f"JUMLAH JAM        : {paket['jam']}",
        f"TAHUN ANGGARAN    : {config.DOKUMEN['sumber_dana']}",
    ]
    for line in info:
        _merge(ws, r, 1, last_col, line, font=F_NORM, align=LEFT_MID)
        r += 1
    r += 1
    end_row, _ = _tabel_harga(ws, r, paket["items"], widths)
    r = end_row + 2
    _merge(ws, r, 4, 7, config.DOKUMEN["kota_tanggal"], font=F_NORM)
    _merge(ws, r + 1, 4, 7, "Pejabat Pembuat Komitmen", font=F_NORM)
    _merge(ws, r + 2, 4, 7, "BBPVP Makassar", font=F_NORM)
    _ttd_nama(ws, r + 6, 4, 7, config.PPK["nama"])
    _merge(ws, r + 7, 4, 7, f"NIP. {config.PPK['nip']}", font=F_NORM)
    _set_print(ws, last_col, landscape=True)
    return ws


def sheet_lampiran_polos(wb, paket, nama_sheet, judul_lampiran, nomor, tanggal,
                         keterangan="", ttd="pengadaan"):
    ws = wb.create_sheet(nama_sheet)
    last_col = 6
    widths = [5, 26, 54, 9, 9, 22]
    _autosize(ws, widths)
    r = 1
    for line in judul_lampiran:
        _merge(ws, r, 1, last_col, line, font=F_SUB, align=LEFT_MID)
        r += 1
    _merge(ws, r, 1, last_col, f"NOMOR   : {nomor}", font=F_NORM, align=LEFT_MID)
    _merge(ws, r + 1, 1, last_col, f"TANGGAL : {tanggal}", font=F_NORM, align=LEFT_MID)
    _merge(ws, r + 2, 1, last_col, f"Kejuruan : {paket['judul']}", font=F_SUB, align=LEFT_MID)
    r += 4
    end = _tabel_tanpa_harga(ws, r, paket["items"], widths, keterangan=keterangan)
    r = end + 2
    if ttd == "pengadaan":
        _merge(ws, r, 4, 6, "Pejabat Pengadaan Barang/Jasa", font=F_NORM)
        nm, nip = config.PEJABAT_PENGADAAN["nama"], config.PEJABAT_PENGADAAN["nip"]
    else:
        _merge(ws, r, 4, 6, "Pejabat Pembuat Komitmen", font=F_NORM)
        nm, nip = config.PPK["nama"], config.PPK["nip"]
    _merge(ws, r + 1, 4, 6, "BBPVP Makassar", font=F_NORM)
    _ttd_nama(ws, r + 5, 4, 6, nm)
    _merge(ws, r + 6, 4, 6, f"NIP. {nip}", font=F_NORM)
    _set_print(ws, last_col, landscape=True)
    return ws


def sheet_lampiran_harga(wb, paket, nama_sheet, judul_lampiran, nomor, tanggal,
                         nilai_total, ttd_dua=False):
    ws = wb.create_sheet(nama_sheet)
    last_col = 7
    widths = [5, 24, 50, 8, 9, 16, 17]
    _autosize(ws, widths)
    r = 1
    for line in judul_lampiran:
        _merge(ws, r, 1, last_col, line, font=F_SUB, align=LEFT_MID)
        r += 1
    _merge(ws, r, 1, last_col, f"NOMOR   : {nomor}", font=F_NORM, align=LEFT_MID)
    _merge(ws, r + 1, 1, last_col, f"TANGGAL : {tanggal}", font=F_NORM, align=LEFT_MID)
    _merge(ws, r + 2, 1, last_col, f"Kejuruan : {paket['judul']}", font=F_SUB, align=LEFT_MID)
    r += 4
    end, _ = _tabel_harga(ws, r, paket["items"], widths, nilai_total=nilai_total)
    r = end + 2
    if ttd_dua:
        _merge(ws, r, 1, 3, "Wakil Penyedia,", font=F_NORM)
        _merge(ws, r, 5, 7, "Pejabat Pembuat Komitmen,", font=F_NORM)
        _merge(ws, r + 1, 1, 3, config.PENYEDIA["nama"], font=F_NORM)
        _merge(ws, r + 1, 5, 7, "BBPVP Makassar", font=F_NORM)
        _ttd_nama(ws, r + 5, 1, 3, config.PENYEDIA["direktur"])
        _ttd_nama(ws, r + 5, 5, 7, config.PPK["nama"])
        _merge(ws, r + 6, 1, 3, config.PENYEDIA["jabatan"], font=F_NORM)
        _merge(ws, r + 6, 5, 7, f"NIP. {config.PPK['nip']}", font=F_NORM)
    else:
        _merge(ws, r, 5, 7, config.PENYEDIA["nama"], font=F_NORM)
        _ttd_nama(ws, r + 4, 5, 7, config.PENYEDIA["direktur"])
        _merge(ws, r + 5, 5, 7, config.PENYEDIA["jabatan"], font=F_NORM)
    _set_print(ws, last_col, landscape=True)
    return ws


def sheet_daftar_isi(wb, daftar):
    ws = wb.create_sheet("Daftar Isi", 0)
    last_col = 3
    _autosize(ws, [6, 58, 20])
    r = _kop_surat(ws, last_col)
    _merge(ws, r, 1, last_col, "SURAT PERTANGGUNGJAWABAN (SPJ)", font=F_TITLE)
    ws.row_dimensions[r].height = 22
    _merge(ws, r + 1, 1, last_col, config.DOKUMEN["kegiatan"], font=F_SUB)
    ws.row_dimensions[r + 1].height = 30
    _merge(ws, r + 2, 1, last_col,
           f"Tahun Anggaran {config.DOKUMEN['tahun_anggaran']}", font=F_NORM)
    r += 4
    for c, h in enumerate(["No", "Dokumen / Lampiran", "Sheet"], start=1):
        cell = ws.cell(row=r, column=c, value=h)
        cell.font = F_HEAD
        cell.alignment = CENTER
        cell.border = BORDER
        cell.fill = HEADER_FILL
    ws.row_dimensions[r].height = 22
    r += 1
    for i, nama in enumerate(daftar, start=1):
        for c, v in enumerate([i, nama, nama], start=1):
            cell = ws.cell(row=r, column=c, value=v)
            cell.border = BORDER
            cell.font = F_NORM
            cell.alignment = CENTER if c in (1, 3) else LEFT_MID
            if i % 2 == 0:
                cell.fill = ZEBRA_FILL
        r += 1
    _set_print(ws, last_col)
    return ws


# --------------------------------------------------------------------------
# Orkestrasi
# --------------------------------------------------------------------------
def build_workbook():
    wb = Workbook()
    wb.remove(wb.active)
    D = config.DOKUMEN
    NK = config.NILAI_KONTRAK
    tgl = D["tanggal_dokumen"]

    sheet_kuitansi(wb)

    sheet_hps(wb, KOPI, "HPS - Kopi")
    sheet_hps(wb, MAKEUP, "HPS - Make Up")

    sp_judul = ["LAMPIRAN : SURAT PESANAN", "DAFTAR PERMINTAAN BAHAN PELATIHAN"]
    sheet_lampiran_polos(wb, KOPI, "SP - Kopi", sp_judul,
                         D["no_surat_pesanan"], "April 2026", ttd="pengadaan")
    sheet_lampiran_polos(wb, MAKEUP, "SP - Make Up", sp_judul,
                         D["no_surat_pesanan"], "April 2026", ttd="pengadaan")

    bap_judul = ["LAMPIRAN : Berita Acara Penelitian dan Pemeriksaan Hasil Pekerjaan"]
    sheet_lampiran_polos(wb, KOPI, "BA Pemeriksaan - Kopi", bap_judul,
                         D["no_ba_pemeriksaan"], tgl,
                         keterangan="Kondisi Baik dan Lengkap", ttd="ppk")
    sheet_lampiran_polos(wb, MAKEUP, "BA Pemeriksaan - Make Up", bap_judul,
                         D["no_ba_pemeriksaan"], tgl,
                         keterangan="Kondisi Baik dan Lengkap", ttd="ppk")

    bast_judul = ["LAMPIRAN : Berita Acara Serah Terima Hasil Pekerjaan"]
    sheet_lampiran_polos(wb, KOPI, "BA Serah Terima - Kopi", bast_judul,
                         D["no_ba_serah_terima"], tgl,
                         keterangan="Kondisi Baik dan Lengkap", ttd="ppk")
    sheet_lampiran_polos(wb, MAKEUP, "BA Serah Terima - Make Up", bast_judul,
                         D["no_ba_serah_terima"], tgl,
                         keterangan="Kondisi Baik dan Lengkap", ttd="ppk")

    bayar_judul = ["LAMPIRAN : Berita Acara Pembayaran"]
    sheet_lampiran_harga(wb, KOPI, "BA Pembayaran - Kopi", bayar_judul,
                         D["no_ba_pembayaran"], tgl, NK["kopi"], ttd_dua=True)
    sheet_lampiran_harga(wb, MAKEUP, "BA Pembayaran - Make Up", bayar_judul,
                         D["no_ba_pembayaran"], tgl, NK["makeup"], ttd_dua=True)

    inv_judul = ["LAMPIRAN INVOICE TAGIHAN"]
    sheet_lampiran_harga(wb, KOPI, "Invoice - Kopi", inv_judul,
                         D["no_invoice"], tgl, NK["kopi"], ttd_dua=False)
    sheet_lampiran_harga(wb, MAKEUP, "Invoice - Make Up", inv_judul,
                         D["no_invoice"], tgl, NK["makeup"], ttd_dua=False)

    daftar = [ws.title for ws in wb.worksheets]
    sheet_daftar_isi(wb, daftar)

    return wb


def generate(path="SPJ_BBPVP_Makassar.xlsx"):
    wb = build_workbook()
    wb.save(path)
    return path
