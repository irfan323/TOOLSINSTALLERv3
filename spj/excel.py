"""Generator workbook Excel untuk SPJ — meniru template PDF apa adanya.

Seluruh dokumen pada berkas SPJ direproduksi menjadi sheet dengan urutan
sama seperti PDF dan gaya polos hitam-putih (tanpa warna), header tabel
memakai baris bernomor (1, 2, 3, ...) sesuai konvensi dokumen.

Urutan sheet (tanpa halaman pajak/SSP):
  1. Kuitansi / Bukti Pembayaran
  2. Surat Perintah Pengadaan Barang/Jasa
  3-4. HPS (Kopi & Make Up)
  5. Surat Pesanan
  6-7. Lampiran Surat Pesanan (Kopi & Make Up)
  8. Berita Acara Penelitian dan Pemeriksaan Hasil Pekerjaan
  9-10. Lampiran BA Pemeriksaan (Kopi & Make Up)
  11. Berita Acara Serah Terima Hasil Pekerjaan
  12-13. Lampiran BA Serah Terima (Kopi & Make Up)
  14. Berita Acara Pembayaran
  15-16. Lampiran BA Pembayaran (Kopi & Make Up)
  17. Invoice Tagihan
  18-19. Lampiran Invoice (Kopi & Make Up)
"""

import math

from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, Border, Side
from openpyxl.utils import get_column_letter

from . import config
from .items import KOPI, MAKEUP
from .terbilang import terbilang

# --------------------------------------------------------------------------
# Gaya polos hitam-putih
# --------------------------------------------------------------------------
RP_FMT = '#,##0'
THIN = Side(style="thin", color="000000")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)

CENTER = Alignment(horizontal="center", vertical="center", wrap_text=True)
CENTER_TOP = Alignment(horizontal="center", vertical="top", wrap_text=True)
LEFT = Alignment(horizontal="left", vertical="top", wrap_text=True)
LEFT_MID = Alignment(horizontal="left", vertical="center", wrap_text=True)
RIGHT = Alignment(horizontal="right", vertical="center")
RIGHT_TOP = Alignment(horizontal="right", vertical="top")
JUSTIFY = Alignment(horizontal="justify", vertical="top", wrap_text=True)

F_TITLE = Font(name="Arial", size=13, bold=True)
F_DOC = Font(name="Arial", size=12, bold=True)
F_SUB = Font(name="Arial", size=10, bold=True)
F_NORM = Font(name="Arial", size=10)
F_SMALL = Font(name="Arial", size=8)
F_NAME_UL = Font(name="Arial", size=10, bold=True, underline="single")
F_ITALIC = Font(name="Arial", size=10, italic=True)


# --------------------------------------------------------------------------
# Helper umum
# --------------------------------------------------------------------------
def _merge(ws, r, c1, c2, value, font=F_NORM, align=CENTER):
    if c2 > c1:
        ws.merge_cells(start_row=r, start_column=c1, end_row=r, end_column=c2)
    cell = ws.cell(row=r, column=c1, value=value)
    cell.font = font
    cell.alignment = align
    return cell


def _autosize(ws, widths):
    for i, w in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(i)].width = w


def _total_width(ws, last_col):
    return sum((ws.column_dimensions[get_column_letter(i)].width or 8.43)
               for i in range(1, last_col + 1))


def _row_height(pairs):
    lines = 1
    for text, width in pairs:
        if not text:
            continue
        lines = max(lines, math.ceil(len(str(text)) / max(width - 2, 6)))
    return 15 * lines + 4


def _kop_surat(ws, last_col):
    """Kop surat instansi (5 baris) + garis pemisah bawah."""
    I = config.INSTANSI
    rows = [
        (I["kementerian"], F_SUB, 15),
        (I["direktorat"], F_SUB, 15),
        (f"{I['balai']} {I['kota']}", F_TITLE, 19),
        (I["alamat"], F_SMALL, 24),
        (I["kontak"], F_SMALL, 13),
    ]
    for i, (text, font, h) in enumerate(rows, start=1):
        _merge(ws, i, 1, last_col, text, font=font)
        ws.row_dimensions[i].height = h
    for col in range(1, last_col + 1):
        ws.cell(row=6, column=col).border = Border(bottom=Side(style="medium", color="000000"))
    ws.row_dimensions[6].height = 5
    return 7


def _para(ws, r, text, last_col, font=F_NORM, align=JUSTIFY, height=None):
    _merge(ws, r, 1, last_col, text, font=font, align=align)
    if height is not None:
        ws.row_dimensions[r].height = height
    else:
        w = _total_width(ws, last_col)
        lines = max(1, math.ceil(len(text) / (w * 0.95)))
        ws.row_dimensions[r].height = 15 * lines + 3
    return r + 1


def _field(ws, r, label, value, last_col, label_cols=2, font=F_NORM):
    """Baris 'Label : Value' — label di kolom kiri, value di sisanya."""
    _merge(ws, r, 1, label_cols, label, font=font, align=LEFT_MID)
    ws.cell(row=r, column=label_cols + 1, value=":").alignment = CENTER
    ws.cell(row=r, column=label_cols + 1).font = font
    _merge(ws, r, label_cols + 2, last_col, value, font=font, align=LEFT_MID)
    return r + 1


def _ttd_block(ws, r, c1, c2, baris_atas, nama, baris_bawah, gap=4):
    """Blok tanda tangan: baris atas, ruang, nama (garis bawah), baris bawah."""
    rr = r
    for line in baris_atas:
        _merge(ws, rr, c1, c2, line, font=F_NORM)
        rr += 1
    rr += gap
    c = _merge(ws, rr, c1, c2, nama, font=F_NAME_UL)
    c.font = F_NAME_UL
    rr += 1
    for line in baris_bawah:
        _merge(ws, rr, c1, c2, line, font=F_NORM)
        rr += 1
    return rr


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


# --------------------------------------------------------------------------
# Tabel item (gaya polos + baris nomor kolom)
# --------------------------------------------------------------------------
def _tabel_harga(ws, start_row, items, widths, nilai_total=None):
    """No | Nama Bahan | Spesifikasi Teknis | Volume | Harga Satuan | Jumlah."""
    w_nama, w_spek = widths[1], widths[2]
    headers = ["No", "Nama Bahan", "Spesifikasi Teknis", "Volume",
               "Harga Satuan (Rp)", "Jumlah (Rp)"]
    last = len(headers)
    r = start_row
    for c, h in enumerate(headers, start=1):
        cell = ws.cell(row=r, column=c, value=h)
        cell.font = F_SUB
        cell.alignment = CENTER
        cell.border = BORDER
    ws.row_dimensions[r].height = 30
    r += 1
    for c in range(1, last + 1):  # baris nomor kolom
        cell = ws.cell(row=r, column=c, value=c)
        cell.font = F_NORM
        cell.alignment = CENTER
        cell.border = BORDER
    ws.row_dimensions[r].height = 14
    ws.freeze_panes = ws.cell(row=r + 1, column=1)
    r += 1
    subtotal = 0
    for idx, (nama, spek, vol, satuan, harga) in enumerate(items, start=1):
        jumlah = vol * harga
        subtotal += jumlah
        vals = [idx, nama, spek, f"{vol} {satuan}", harga, jumlah]
        for c, v in enumerate(vals, start=1):
            cell = ws.cell(row=r, column=c, value=v)
            cell.border = BORDER
            cell.font = F_NORM
            if c in (1, 4):
                cell.alignment = CENTER_TOP
            elif c in (5, 6):
                cell.alignment = RIGHT_TOP
                cell.number_format = RP_FMT
            else:
                cell.alignment = LEFT
        ws.row_dimensions[r].height = _row_height([(nama, w_nama), (spek, w_spek)])
        r += 1
    total = nilai_total if nilai_total is not None else subtotal
    _merge(ws, r, 1, last - 1, "TOTAL", font=F_SUB, align=RIGHT)
    for c in range(1, last):
        ws.cell(row=r, column=c).border = BORDER
    tc = ws.cell(row=r, column=last, value=total)
    tc.font = F_SUB
    tc.alignment = RIGHT
    tc.number_format = RP_FMT
    tc.border = BORDER
    ws.row_dimensions[r].height = 18
    r += 1
    _merge(ws, r, 1, last, f"Terbilang : {terbilang(total)}", font=F_ITALIC, align=LEFT_MID)
    ws.row_dimensions[r].height = 18
    return r + 1, total


def _tabel_tanpa_harga(ws, start_row, items, widths, keterangan=""):
    """No | Nama Bahan | Spesifikasi Teknis | Volume | Keterangan."""
    w_nama, w_spek = widths[1], widths[2]
    headers = ["No", "Nama Bahan", "Spesifikasi Teknis", "Volume", "Keterangan"]
    last = len(headers)
    r = start_row
    for c, h in enumerate(headers, start=1):
        cell = ws.cell(row=r, column=c, value=h)
        cell.font = F_SUB
        cell.alignment = CENTER
        cell.border = BORDER
    ws.row_dimensions[r].height = 24
    r += 1
    for c in range(1, last + 1):
        cell = ws.cell(row=r, column=c, value=c)
        cell.font = F_NORM
        cell.alignment = CENTER
        cell.border = BORDER
    ws.row_dimensions[r].height = 14
    ws.freeze_panes = ws.cell(row=r + 1, column=1)
    r += 1
    for idx, (nama, spek, vol, satuan, _harga) in enumerate(items, start=1):
        vals = [idx, nama, spek, f"{vol} {satuan}", keterangan]
        for c, v in enumerate(vals, start=1):
            cell = ws.cell(row=r, column=c, value=v)
            cell.border = BORDER
            cell.font = F_NORM
            if c in (1, 4, 5):
                cell.alignment = CENTER_TOP
            else:
                cell.alignment = LEFT
        ws.row_dimensions[r].height = _row_height([(nama, w_nama), (spek, w_spek)])
        r += 1
    return r


# --------------------------------------------------------------------------
# 1. KUITANSI
# --------------------------------------------------------------------------
def sheet_kuitansi(wb):
    ws = wb.create_sheet("Kuitansi")
    last_col = 6
    _autosize(ws, [16, 4, 18, 18, 18, 18])
    r = _kop_surat(ws, last_col)
    D = config.DOKUMEN
    total = config.NILAI_KONTRAK["total"]

    _merge(ws, r, 1, last_col, f"Tahun Anggaran : {D['tahun_anggaran']}", font=F_NORM, align=LEFT_MID)
    _merge(ws, r + 1, 1, last_col, "Nomor Bukti     : ................", font=F_NORM, align=LEFT_MID)
    _merge(ws, r + 2, 1, last_col, "MAK              : ................", font=F_NORM, align=LEFT_MID)
    r += 4
    _merge(ws, r, 1, last_col, "KUITANSI / BUKTI PEMBAYARAN", font=F_DOC)
    ws.row_dimensions[r].height = 22
    r += 2
    r = _para(ws, r, "Sudah terima dari : Kuasa Pengguna Anggaran Balai Besar "
              "Pelatihan Vokasi dan Produktivitas Makassar", last_col, align=LEFT_MID)
    r = _field(ws, r, "Uang sejumlah", f"Rp {total:,.0f}", last_col, font=F_SUB)
    r = _field(ws, r, "Terbilang", terbilang(total), last_col, font=F_ITALIC)
    r = _para(ws, r, f"Untuk pembayaran : {D['kegiatan']}", last_col, align=LEFT_MID)
    r += 2

    _merge(ws, r, 1, 3, D["kota_tanggal"], font=F_NORM)
    _merge(ws, r, 4, 6, "Yang menerima,", font=F_NORM)
    _merge(ws, r + 1, 1, 3, "Setuju dibayar,", font=F_NORM)
    _merge(ws, r + 1, 4, 6, config.PENYEDIA["nama"], font=F_NORM)
    _merge(ws, r + 2, 1, 3, "Pejabat Pembuat Komitmen", font=F_NORM)
    rr = r + 6
    c = _merge(ws, rr, 1, 3, config.PPK["nama"], font=F_NAME_UL); c.font = F_NAME_UL
    c = _merge(ws, rr, 4, 6, config.PENYEDIA["direktur"], font=F_NAME_UL); c.font = F_NAME_UL
    _merge(ws, rr + 1, 1, 3, f"NIP. {config.PPK['nip']}", font=F_NORM)
    _merge(ws, rr + 1, 4, 6, config.PENYEDIA["jabatan"], font=F_NORM)
    _set_print(ws, last_col)
    return ws


# --------------------------------------------------------------------------
# 2. SURAT PERINTAH PENGADAAN
# --------------------------------------------------------------------------
def sheet_surat_perintah(wb):
    ws = wb.create_sheet("Surat Perintah")
    last_col = 6
    _autosize(ws, [16, 4, 18, 18, 18, 18])
    D = config.DOKUMEN
    r = _kop_surat(ws, last_col)
    _merge(ws, r, 1, 4, f"Nomor     : SP.    /PPK/BBPVPMKS-MAMUJU/IV/2026", font=F_NORM, align=LEFT_MID)
    _merge(ws, r, 5, 6, "Makassar, April 2026", font=F_NORM, align=RIGHT)
    _merge(ws, r + 1, 1, 4, "Lampiran  : 1 (satu) berkas", font=F_NORM, align=LEFT_MID)
    _merge(ws, r + 2, 1, 4, "Perihal   : Perintah Pengadaan Barang/Jasa", font=F_SUB, align=LEFT_MID)
    r += 4
    _merge(ws, r, 1, last_col, "Kepada Yth.", font=F_NORM, align=LEFT_MID)
    _merge(ws, r + 1, 1, last_col, "Pejabat Pengadaan BBPVP Makassar", font=F_NORM, align=LEFT_MID)
    _merge(ws, r + 2, 1, last_col, "di Tempat,", font=F_NORM, align=LEFT_MID)
    r += 4
    r = _para(ws, r,
              "Sehubungan dengan akan dilaksanakannya kegiatan pengadaan barang/jasa "
              "di lingkungan BBPVP Makassar tahun anggaran 2026, terkait dengan kegiatan "
              "Pengadaan Bahan Pelatihan Berbasis Kompetensi sebanyak 2 (dua) Paket Jurusan "
              "maka dengan ini disampaikan untuk melaksanakan proses pengadaan barang/jasa "
              "pada kegiatan tersebut. Sebagai dasar pelaksanaan, berikut dilampirkan :", last_col)
    for t in ["1. Daftar barang yang akan diadakan;",
              "2. Spesifikasi Teknis;", "3. Penetapan HPS."]:
        _merge(ws, r, 1, last_col, t, font=F_NORM, align=LEFT_MID); r += 1
    r = _para(ws, r,
              "Dalam pelaksanaan proses pengadaan barang/jasa agar senantiasa berpedoman "
              "pada peraturan perundang-undangan yang berlaku. Diharapkan agar pejabat "
              "pengadaan barang/jasa segera melakukan persiapan dan pelaksanaan pengadaan "
              "dengan memperhatikan batasan waktu yang tersedia.", last_col)
    r = _para(ws, r, "Demikian disampaikan dan atas kerjasamanya diucapkan terima kasih.", last_col)
    r += 1
    _ttd_block(ws, r, 4, 6, ["Pejabat Pembuat Komitmen", "BBPVP Makassar"],
               config.PPK["nama"], [f"NIP. {config.PPK['nip']}"])
    rr = r + 8
    _merge(ws, rr, 1, last_col, "Tembusan disampaikan dengan hormat kepada:", font=F_NORM, align=LEFT_MID)
    _merge(ws, rr + 1, 1, last_col, "1. Kuasa Pengguna Anggaran (KPA)", font=F_NORM, align=LEFT_MID)
    _merge(ws, rr + 2, 1, last_col, "2. Arsip", font=F_NORM, align=LEFT_MID)
    _set_print(ws, last_col)
    return ws


# --------------------------------------------------------------------------
# 3-4. HPS
# --------------------------------------------------------------------------
def sheet_hps(wb, paket, nama_sheet):
    ws = wb.create_sheet(nama_sheet)
    last_col = 6
    widths = [5, 24, 54, 12, 16, 17]
    _autosize(ws, widths)
    r = _kop_surat(ws, last_col)
    _merge(ws, r, 1, last_col, "HARGA PERKIRAAN SENDIRI (HPS)", font=F_DOC)
    ws.row_dimensions[r].height = 20
    _merge(ws, r + 1, 1, last_col, "BAHAN PELATIHAN BERBASIS KOMPETENSI", font=F_SUB)
    r += 3
    for line in [f"KEJURUAN          : {paket['kejuruan']}",
                 f"BIDANG KEAHLIAN   : {paket['bidang']}",
                 f"JUMLAH JAM        : {paket['jam']}",
                 f"TAHUN ANGGARAN    : {config.DOKUMEN['sumber_dana']}"]:
        _merge(ws, r, 1, last_col, line, font=F_NORM, align=LEFT_MID); r += 1
    r += 1
    end_row, _ = _tabel_harga(ws, r, paket["items"], widths)
    r = end_row + 2
    _merge(ws, r, 4, last_col, config.DOKUMEN["kota_tanggal"], font=F_NORM)
    _ttd_block(ws, r + 1, 4, last_col, ["Pejabat Pembuat Komitmen", "BBPVP Makassar"],
               config.PPK["nama"], [f"NIP. {config.PPK['nip']}"])
    _set_print(ws, last_col, landscape=True)
    return ws


# --------------------------------------------------------------------------
# 5. SURAT PESANAN
# --------------------------------------------------------------------------
def sheet_surat_pesanan(wb):
    ws = wb.create_sheet("Surat Pesanan")
    last_col = 6
    _autosize(ws, [16, 4, 18, 18, 18, 18])
    r = _kop_surat(ws, last_col)
    _merge(ws, r, 1, last_col, "SURAT PESANAN", font=F_DOC)
    ws.row_dimensions[r].height = 20
    _merge(ws, r + 1, 1, last_col,
           f"Nomor : {config.DOKUMEN['no_surat_pesanan']}", font=F_NORM)
    r += 3
    _merge(ws, r, 1, last_col, "Kepada Yth.", font=F_NORM, align=LEFT_MID)
    _merge(ws, r + 1, 1, last_col, f"Pimpinan {config.PENYEDIA['nama'].upper()}", font=F_NORM, align=LEFT_MID)
    _merge(ws, r + 2, 1, last_col, "di Tempat,", font=F_NORM, align=LEFT_MID)
    r += 4
    r = _para(ws, r,
              "Sehubungan dengan kegiatan Pengadaan Bahan Pelatihan Berbasis Kompetensi "
              "sebanyak 2 (dua) Paket Kejuruan, maka dengan ini disampaikan agar kiranya "
              "dapat disiapkan barang sesuai pesanan berikut (terlampir).", last_col)
    r = _para(ws, r,
              "Demikian Pesanan ini dibuat dan untuk dilaksanakan setelah menerima "
              "surat pesanan ini.", last_col)
    r += 1
    _merge(ws, r, 4, last_col, "Makassar, April 2026", font=F_NORM)
    _ttd_block(ws, r + 1, 4, last_col, ["Pejabat Pengadaan Barang/Jasa", "BBPVP Makassar"],
               config.PEJABAT_PENGADAAN["nama"], [f"NIP. {config.PEJABAT_PENGADAAN['nip']}"])
    _set_print(ws, last_col)
    return ws


# --------------------------------------------------------------------------
# Lampiran tanpa harga
# --------------------------------------------------------------------------
def _header_lampiran(ws, last_col, lines, title_center=None):
    r = 1
    for i, line in enumerate(lines):
        _merge(ws, r, 1, last_col, line, font=F_SUB if i == 0 else F_NORM, align=LEFT_MID)
        ws.row_dimensions[r].height = 17
        r += 1
    if title_center:
        r += 1
        _merge(ws, r, 1, last_col, title_center, font=F_SUB, align=CENTER)
        ws.row_dimensions[r].height = 20
        r += 1
    return r + 1


def sheet_lampiran_polos(wb, paket, nama_sheet, header_lines, title_center=None,
                         keterangan="", ttd="pengadaan"):
    ws = wb.create_sheet(nama_sheet)
    last_col = 5
    widths = [5, 26, 58, 13, 24]
    _autosize(ws, widths)
    r = _header_lampiran(ws, last_col, header_lines, title_center)
    end = _tabel_tanpa_harga(ws, r, paket["items"], widths, keterangan=keterangan)
    r = end + 2
    if ttd == "pengadaan":
        atas, nm, nip = ["Pejabat Pengadaan Barang/Jasa", "BBPVP Makassar"], \
            config.PEJABAT_PENGADAAN["nama"], config.PEJABAT_PENGADAAN["nip"]
    else:
        atas, nm, nip = ["Pejabat Pembuat Komitmen", "BBPVP Makassar"], \
            config.PPK["nama"], config.PPK["nip"]
    _ttd_block(ws, r, 3, last_col, atas, nm, [f"NIP. {nip}"])
    _set_print(ws, last_col, landscape=True)
    return ws


# --------------------------------------------------------------------------
# Lampiran dengan harga
# --------------------------------------------------------------------------
def sheet_lampiran_harga(wb, paket, nama_sheet, header_lines, nilai_total, ttd_dua=False):
    ws = wb.create_sheet(nama_sheet)
    last_col = 6
    widths = [5, 24, 54, 12, 16, 17]
    _autosize(ws, widths)
    r = _header_lampiran(ws, last_col, header_lines)
    end, _ = _tabel_harga(ws, r, paket["items"], widths, nilai_total=nilai_total)
    r = end + 2
    if ttd_dua:
        _merge(ws, r, 1, 3, "Wakil Penyedia,", font=F_NORM)
        _merge(ws, r, 4, last_col, "Pejabat Pembuat Komitmen,", font=F_NORM)
        _merge(ws, r + 1, 1, 3, config.PENYEDIA["nama"], font=F_NORM)
        _merge(ws, r + 1, 4, last_col, "BBPVP Makassar", font=F_NORM)
        c = _merge(ws, r + 5, 1, 3, config.PENYEDIA["direktur"], font=F_NAME_UL); c.font = F_NAME_UL
        c = _merge(ws, r + 5, 4, last_col, config.PPK["nama"], font=F_NAME_UL); c.font = F_NAME_UL
        _merge(ws, r + 6, 1, 3, config.PENYEDIA["jabatan"], font=F_NORM)
        _merge(ws, r + 6, 4, last_col, f"NIP. {config.PPK['nip']}", font=F_NORM)
    else:
        _ttd_block(ws, r, 4, last_col, [config.PENYEDIA["nama"]],
                   config.PENYEDIA["direktur"], [config.PENYEDIA["jabatan"]])
    _set_print(ws, last_col, landscape=True)
    return ws


# --------------------------------------------------------------------------
# Berita Acara naratif (Pemeriksaan / Serah Terima / Pembayaran)
# --------------------------------------------------------------------------
def _ttd_dua_penyedia_ppk(ws, r, last_col):
    _merge(ws, r, 1, 3, "PENYEDIA", font=F_NORM)
    _merge(ws, r, 4, last_col, "BBPVP MAKASSAR", font=F_NORM)
    _merge(ws, r + 1, 1, 3, config.PENYEDIA["nama"].upper(), font=F_NORM)
    _merge(ws, r + 1, 4, last_col, "PEJABAT PEMBUAT KOMITMEN", font=F_NORM)
    c = _merge(ws, r + 5, 1, 3, config.PENYEDIA["direktur"], font=F_NAME_UL); c.font = F_NAME_UL
    c = _merge(ws, r + 5, 4, last_col, config.PPK["nama"], font=F_NAME_UL); c.font = F_NAME_UL
    _merge(ws, r + 6, 1, 3, "Direktur", font=F_NORM)
    _merge(ws, r + 6, 4, last_col, f"NIP. {config.PPK['nip']}", font=F_NORM)


def sheet_ba_pemeriksaan(wb):
    ws = wb.create_sheet("BA Pemeriksaan")
    last_col = 6
    _autosize(ws, [16, 4, 18, 18, 18, 18])
    D = config.DOKUMEN
    r = _kop_surat(ws, last_col)
    _merge(ws, r, 1, last_col, "BERITA ACARA", font=F_DOC)
    _merge(ws, r + 1, 1, last_col, "PENELITIAN DAN PEMERIKSAAN HASIL PEKERJAAN", font=F_SUB)
    _merge(ws, r + 2, 1, last_col, f"NOMOR : {D['no_ba_pemeriksaan']}", font=F_NORM)
    r += 4
    r = _para(ws, r, f"Pada hari ini, {D['hari_tanggal']}, selaku Pejabat Pembuat "
              "Komitmen BBPVP Makassar Tahun 2026 :", last_col)
    r = _field(ws, r, "Nama", config.PPK["nama"], last_col)
    r = _field(ws, r, "Jabatan", config.PPK["jabatan"], last_col)
    r = _field(ws, r, "Alamat", config.PPK["alamat"], last_col)
    r = _para(ws, r, "Yang diangkat dengan Surat Keputusan Kepala BBPVP Makassar "
              "No. 2.12/002/KU.02.01/III/2026 tanggal 02 Januari 2026, telah mengadakan "
              "penelitian dan pemeriksaan tahap akhir pada pekerjaan "
              "“PENGADAAN BAHAN PELATIHAN BERBASIS KOMPETENSI SEBANYAK 2 (DUA) PAKET "
              "KEJURUAN” Anggaran 2026, dengan rincian terlampir.", last_col)
    r = _field(ws, r, "Dilaksanakan oleh", config.PENYEDIA["nama"], last_col)
    r = _field(ws, r, "Alamat", config.PENYEDIA["alamat"], last_col)
    r += 1
    r = _para(ws, r, "1. Dengan ini menyatakan bahwa pekerjaan sebagaimana tersebut di atas, "
              "telah dilaksanakan dan diselesaikan dengan baik oleh CV. PONEGORO GROUP.", last_col)
    r = _para(ws, r, "2. Berpendapat bahwa seluruh pekerjaan sebagaimana dimaksud di atas, "
              "telah diselesaikan seluruh pekerjaannya dan harga dapat dibayarkan.", last_col)
    r = _para(ws, r, "Demikian Berita Acara Penelitian dan Pemeriksaan Hasil Pekerjaan ini "
              "dibuat untuk dapat dipergunakan sebagaimana mestinya.", last_col)
    r += 1
    _ttd_dua_penyedia_ppk(ws, r, last_col)
    _set_print(ws, last_col)
    return ws


def sheet_ba_serah_terima(wb):
    ws = wb.create_sheet("BA Serah Terima")
    last_col = 6
    _autosize(ws, [16, 4, 18, 18, 18, 18])
    D = config.DOKUMEN
    NK = config.NILAI_KONTRAK
    r = _kop_surat(ws, last_col)
    _merge(ws, r, 1, last_col, "BERITA ACARA", font=F_DOC)
    _merge(ws, r + 1, 1, last_col, "SERAH TERIMA HASIL PEKERJAAN", font=F_SUB)
    _merge(ws, r + 2, 1, last_col, f"NOMOR : {D['no_ba_serah_terima']}", font=F_NORM)
    r += 4
    r = _para(ws, r, f"Pada hari ini, {D['hari_tanggal']}, kami yang bertanda tangan "
              "di bawah ini masing-masing :", last_col)
    _merge(ws, r, 1, last_col, "1. PIHAK PERTAMA", font=F_SUB, align=LEFT_MID); r += 1
    r = _field(ws, r, "Nama", config.PPK["nama"], last_col)
    r = _field(ws, r, "Jabatan", config.PPK["jabatan"], last_col)
    r = _field(ws, r, "Alamat", config.PPK["alamat"], last_col)
    _merge(ws, r, 1, last_col, "2. PIHAK KEDUA", font=F_SUB, align=LEFT_MID); r += 1
    r = _field(ws, r, "Nama", config.PENYEDIA["direktur"], last_col)
    r = _field(ws, r, "Jabatan", f"Direktur {config.PENYEDIA['nama']}", last_col)
    r = _field(ws, r, "Alamat", config.PENYEDIA["alamat"], last_col)
    r = _field(ws, r, "Bank", config.PENYEDIA["bank"], last_col)
    r = _field(ws, r, "Rekening", config.PENYEDIA["rekening"], last_col)
    r = _field(ws, r, "NPWP", config.PENYEDIA["npwp"], last_col)
    r += 1
    r = _para(ws, r, "Berdasarkan Berita Acara Penelitian dan Pemeriksaan Hasil Pekerjaan "
              f"Nomor : {D['no_ba_pemeriksaan']} tanggal April 2026, dengan ini menyatakan "
              "telah mengadakan serah terima hasil pekerjaan sebagai berikut :", last_col)
    _merge(ws, r, 1, last_col, "Pasal 1", font=F_SUB); r += 1
    r = _para(ws, r, "PIHAK KEDUA telah menyerahkan kepada PIHAK PERTAMA pekerjaan "
              "“PENGADAAN BAHAN PELATIHAN BERBASIS KOMPETENSI SEBANYAK 2 (DUA) PAKET "
              "KEJURUAN” Tahun Anggaran 2026, dengan rincian terlampir. PIHAK PERTAMA "
              "telah menerima pekerjaan tersebut dan telah diselesaikan dengan baik oleh "
              "PIHAK KEDUA.", last_col)
    _merge(ws, r, 1, last_col, "Pasal 2", font=F_SUB); r += 1
    r = _para(ws, r, f"PIHAK KEDUA berhak menerima pembayaran uang sebesar "
              f"Rp {NK['total']:,.0f},- ({terbilang(NK['total']).replace(' Rupiah','')}).", last_col)
    r = _para(ws, r, "Demikian Berita Acara ini dibuat dengan sebenarnya untuk dipergunakan "
              "sebagaimana mestinya.", last_col)
    r += 1
    _ttd_dua_penyedia_ppk(ws, r, last_col)
    _set_print(ws, last_col)
    return ws


def sheet_ba_pembayaran(wb):
    ws = wb.create_sheet("BA Pembayaran")
    last_col = 6
    _autosize(ws, [16, 4, 18, 18, 18, 18])
    D = config.DOKUMEN
    NK = config.NILAI_KONTRAK
    r = _kop_surat(ws, last_col)
    _merge(ws, r, 1, last_col, "BERITA ACARA PEMBAYARAN", font=F_DOC)
    _merge(ws, r + 1, 1, last_col, f"Nomor : {D['no_ba_pembayaran']}", font=F_NORM)
    r += 3
    r = _para(ws, r, f"Pada hari ini, {D['hari_tanggal']}, kami yang bertanda tangan "
              "di bawah ini masing-masing :", last_col)
    _merge(ws, r, 1, last_col, "1. PIHAK PERTAMA", font=F_SUB, align=LEFT_MID); r += 1
    r = _field(ws, r, "Nama", config.PPK["nama"], last_col)
    r = _field(ws, r, "Jabatan", config.PPK["jabatan"], last_col)
    r = _field(ws, r, "Alamat", config.PPK["alamat"], last_col)
    _merge(ws, r, 1, last_col, "2. PIHAK KEDUA", font=F_SUB, align=LEFT_MID); r += 1
    r = _field(ws, r, "Nama", config.PENYEDIA["direktur"], last_col)
    r = _field(ws, r, "Jabatan", f"Direktur {config.PENYEDIA['nama']}", last_col)
    r = _field(ws, r, "Bank", config.PENYEDIA["bank"], last_col)
    r = _field(ws, r, "No. Rek", config.PENYEDIA["rekening"], last_col)
    r = _field(ws, r, "NPWP", config.PENYEDIA["npwp"], last_col)
    r = _field(ws, r, "Alamat", config.PENYEDIA["alamat"], last_col)
    r += 1
    r = _para(ws, r, "Kedua belah pihak telah mengadakan pemeriksaan/penelitian bersama dan "
              "menyatakan pekerjaan “PENGADAAN BAHAN PELATIHAN BERBASIS KOMPETENSI "
              "SEBANYAK 2 (DUA) PAKET KEJURUAN” yang dikerjakan oleh CV. PONEGORO GROUP "
              "dengan hasil pemeriksaan tersebut pekerjaan telah mencapai 100%, maka "
              "rekanan/perusahaan memenuhi syarat untuk menerima pembayaran lunas sebesar "
              f"Rp {NK['total']:,.0f},- ({terbilang(NK['total']).replace(' Rupiah','')}). "
              "Biaya dibebankan pada Anggaran DIPA BBPVP Makassar TA 2026.", last_col)
    r = _para(ws, r, "Demikian berita acara pembayaran ini kami buat dengan sebenarnya untuk "
              "dipergunakan sebagaimana mestinya.", last_col)
    r += 1
    _ttd_dua_penyedia_ppk(ws, r, last_col)
    _set_print(ws, last_col)
    return ws


# --------------------------------------------------------------------------
# 17. INVOICE TAGIHAN (tanpa kop instansi — surat penyedia)
# --------------------------------------------------------------------------
def sheet_invoice(wb):
    ws = wb.create_sheet("Invoice")
    last_col = 6
    _autosize(ws, [6, 28, 16, 16, 16, 14])
    D = config.DOKUMEN
    NK = config.NILAI_KONTRAK
    r = 1
    _merge(ws, r, 1, last_col, "INVOICE TAGIHAN", font=F_DOC)
    ws.row_dimensions[r].height = 22
    r += 2
    _merge(ws, r, 1, 3, f"Nomor   : {D['no_invoice']}", font=F_NORM, align=LEFT_MID)
    _merge(ws, r + 1, 1, 3, f"Tanggal : {D['tanggal_dokumen']}", font=F_NORM, align=LEFT_MID)
    r += 3
    _merge(ws, r, 1, last_col, "Kepada Yth.", font=F_NORM, align=LEFT_MID)
    _merge(ws, r + 1, 1, last_col, "Pejabat Pembuat Komitmen", font=F_NORM, align=LEFT_MID)
    _merge(ws, r + 2, 1, last_col, "Balai Besar Pelatihan Vokasi dan Produktivitas Makassar", font=F_NORM, align=LEFT_MID)
    _merge(ws, r + 3, 1, last_col, "di Tempat,", font=F_NORM, align=LEFT_MID)
    r += 5
    r = _para(ws, r, "Dengan hormat, melalui surat ini kami sampaikan tagihan atas "
              "pengadaan Barang Bahan Pelatihan sesuai rincian sebagai berikut :", last_col)
    # tabel ringkas
    for c, h in enumerate(["No", "Nama Barang", "Total (Rp)"], start=1):
        cols = {1: (1, 1), 2: (2, 4), 3: (5, 6)}[c]
        cell = _merge(ws, r, cols[0], cols[1], h, font=F_SUB, align=CENTER)
        for cc in range(cols[0], cols[1] + 1):
            ws.cell(row=r, column=cc).border = BORDER
    r += 1
    rows = [("1", "Bahan Pelatihan Kejuruan Peracikan Minuman Kopi", NK["kopi"]),
            ("2", "Bahan Pelatihan Junior Make Up Artist", NK["makeup"])]
    for no, nama, tot in rows:
        _merge(ws, r, 1, 1, no, font=F_NORM, align=CENTER)
        _merge(ws, r, 2, 4, nama, font=F_NORM, align=LEFT_MID)
        cell = _merge(ws, r, 5, 6, tot, font=F_NORM, align=RIGHT)
        cell.number_format = RP_FMT
        for cc in range(1, last_col + 1):
            ws.cell(row=r, column=cc).border = BORDER
        r += 1
    _merge(ws, r, 1, 4, "TOTAL", font=F_SUB, align=RIGHT)
    cell = _merge(ws, r, 5, 6, NK["total"], font=F_SUB, align=RIGHT)
    cell.number_format = RP_FMT
    for cc in range(1, last_col + 1):
        ws.cell(row=r, column=cc).border = BORDER
    r += 1
    _merge(ws, r, 1, last_col, f"Terbilang : {terbilang(NK['total'])}", font=F_ITALIC, align=LEFT_MID)
    r += 2
    _merge(ws, r, 1, last_col, "Mohon melakukan pembayaran melalui rekening berikut :", font=F_NORM, align=LEFT_MID)
    r = _field(ws, r + 1, "Bank", config.PENYEDIA["bank"], last_col)
    r = _field(ws, r, "No. Rek", config.PENYEDIA["rekening"], last_col)
    r = _field(ws, r, "a/n", config.PENYEDIA["direktur"], last_col)
    r += 1
    r = _para(ws, r, "Demikian invoice tagihan ini kami sampaikan untuk ditindaklanjuti. "
              "Terima kasih atas kerjasamanya.", last_col)
    r += 1
    _merge(ws, r, 4, last_col, "Mamuju, 13 April 2026", font=F_NORM)
    _ttd_block(ws, r + 1, 4, last_col, ["Hormat kami,", config.PENYEDIA["nama"].upper()],
               config.PENYEDIA["direktur"], ["Direktur"])
    _set_print(ws, last_col)
    return ws


# --------------------------------------------------------------------------
# Daftar Isi
# --------------------------------------------------------------------------
def sheet_daftar_isi(wb, daftar):
    ws = wb.create_sheet("Daftar Isi", 0)
    last_col = 3
    _autosize(ws, [6, 58, 20])
    r = _kop_surat(ws, last_col)
    _merge(ws, r, 1, last_col, "SURAT PERTANGGUNGJAWABAN (SPJ)", font=F_DOC)
    ws.row_dimensions[r].height = 20
    _merge(ws, r + 1, 1, last_col, config.DOKUMEN["kegiatan"], font=F_SUB)
    ws.row_dimensions[r + 1].height = 30
    _merge(ws, r + 2, 1, last_col, f"Tahun Anggaran {config.DOKUMEN['tahun_anggaran']}", font=F_NORM)
    r += 4
    for c, h in enumerate(["No", "Dokumen / Lampiran", "Sheet"], start=1):
        cell = ws.cell(row=r, column=c, value=h)
        cell.font = F_SUB
        cell.alignment = CENTER
        cell.border = BORDER
    r += 1
    for i, nama in enumerate(daftar, start=1):
        for c, v in enumerate([i, nama, nama], start=1):
            cell = ws.cell(row=r, column=c, value=v)
            cell.border = BORDER
            cell.font = F_NORM
            cell.alignment = CENTER if c in (1, 3) else LEFT_MID
        r += 1
    _set_print(ws, last_col)
    return ws


# --------------------------------------------------------------------------
# Orkestrasi (urutan persis PDF)
# --------------------------------------------------------------------------
def build_workbook():
    wb = Workbook()
    wb.remove(wb.active)
    D = config.DOKUMEN
    NK = config.NILAI_KONTRAK
    tgl = D["tanggal_dokumen"]

    sheet_kuitansi(wb)
    sheet_surat_perintah(wb)
    sheet_hps(wb, KOPI, "HPS - Kopi")
    sheet_hps(wb, MAKEUP, "HPS - Make Up")
    sheet_surat_pesanan(wb)

    # Lampiran Surat Pesanan
    for paket, sheet in ((KOPI, "Lamp. SP - Kopi"), (MAKEUP, "Lamp. SP - Make Up")):
        lines = ["LAMPIRAN : SURAT PESANAN",
                 f"NOMOR    : {D['no_surat_pesanan']}",
                 "TANGGAL  : April 2026"]
        title = f"DAFTAR PERMINTAAN BAHAN PELATIHAN KEJURUAN {paket['judul'].upper()}"
        sheet_lampiran_polos(wb, paket, sheet, lines, title_center=title, ttd="pengadaan")

    # BA Pemeriksaan + lampiran
    sheet_ba_pemeriksaan(wb)
    for paket, sheet in ((KOPI, "Lamp. BA Periksa - Kopi"), (MAKEUP, "Lamp. BA Periksa - MUA")):
        lines = ["LAMPIRAN : Berita Acara Penelitian dan Pemeriksaan Hasil Pekerjaan",
                 f"Pengadaan Bahan Pelatihan {paket['judul']}",
                 f"NOMOR    : {D['no_ba_pemeriksaan']}",
                 f"TANGGAL  : {tgl}"]
        sheet_lampiran_polos(wb, paket, sheet, lines, keterangan="Kondisi Baik dan Lengkap", ttd="ppk")

    # BA Serah Terima + lampiran
    sheet_ba_serah_terima(wb)
    for paket, sheet in ((KOPI, "Lamp. BA Terima - Kopi"), (MAKEUP, "Lamp. BA Terima - MUA")):
        lines = ["LAMPIRAN : Berita Acara Serah Terima Hasil Pekerjaan",
                 f"Pengadaan Bahan Pelatihan {paket['judul']}",
                 f"NOMOR    : {D['no_ba_serah_terima']}",
                 f"TANGGAL  : {tgl}"]
        sheet_lampiran_polos(wb, paket, sheet, lines, keterangan="Kondisi Baik dan Lengkap", ttd="ppk")

    # BA Pembayaran + lampiran
    sheet_ba_pembayaran(wb)
    for paket, sheet, nilai in ((KOPI, "Lamp. BA Bayar - Kopi", NK["kopi"]),
                                (MAKEUP, "Lamp. BA Bayar - MUA", NK["makeup"])):
        lines = ["LAMPIRAN : Berita Acara Pembayaran",
                 f"Pengadaan Bahan Pelatihan {paket['judul']}",
                 f"NOMOR    : {D['no_ba_pembayaran']}",
                 f"TANGGAL  : {tgl}"]
        sheet_lampiran_harga(wb, paket, sheet, lines, nilai, ttd_dua=True)

    # Invoice + lampiran
    sheet_invoice(wb)
    for paket, sheet, nilai in ((KOPI, "Lamp. Invoice - Kopi", NK["kopi"]),
                                (MAKEUP, "Lamp. Invoice - MUA", NK["makeup"])):
        lines = ["LAMPIRAN INVOICE TAGIHAN",
                 f"Nomor    : {D['no_invoice']}",
                 f"Tanggal  : {tgl}",
                 f"Kejuruan : {paket['judul']}"]
        sheet_lampiran_harga(wb, paket, sheet, lines, nilai, ttd_dua=False)

    daftar = [ws.title for ws in wb.worksheets]
    sheet_daftar_isi(wb, daftar)
    return wb


def generate(path="SPJ_BBPVP_Makassar.xlsx"):
    wb = build_workbook()
    wb.save(path)
    return path
