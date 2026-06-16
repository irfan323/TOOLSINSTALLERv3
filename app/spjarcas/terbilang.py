"""Konversi angka ke teks bahasa Indonesia (terbilang).

Dipakai pada Kuitansi untuk menuliskan nominal uang dalam huruf,
sesuai standar administrasi keuangan (mis. "Satu juta lima ratus ribu rupiah").
"""

_SATUAN = [
    "", "satu", "dua", "tiga", "empat", "lima",
    "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas",
]


def _terbilang(n: int) -> str:
    n = int(n)
    if n < 12:
        return _SATUAN[n]
    if n < 20:
        return _terbilang(n - 10).strip() + " belas"
    if n < 100:
        return (_terbilang(n // 10) + " puluh " + _terbilang(n % 10)).strip()
    if n < 200:
        return ("seratus " + _terbilang(n - 100)).strip()
    if n < 1000:
        return (_terbilang(n // 100) + " ratus " + _terbilang(n % 100)).strip()
    if n < 2000:
        return ("seribu " + _terbilang(n - 1000)).strip()
    if n < 1_000_000:
        return (_terbilang(n // 1000) + " ribu " + _terbilang(n % 1000)).strip()
    if n < 1_000_000_000:
        return (_terbilang(n // 1_000_000) + " juta " + _terbilang(n % 1_000_000)).strip()
    if n < 1_000_000_000_000:
        return (_terbilang(n // 1_000_000_000) + " milyar " + _terbilang(n % 1_000_000_000)).strip()
    return (_terbilang(n // 1_000_000_000_000) + " triliun "
            + _terbilang(n % 1_000_000_000_000)).strip()


def terbilang(n) -> str:
    """Mengembalikan terbilang rapi, kata depan kapital, diakhiri 'rupiah'."""
    n = int(round(float(n)))
    if n == 0:
        teks = "nol"
    else:
        teks = " ".join(_terbilang(n).split())
    teks = (teks + " rupiah").strip()
    return teks[0].upper() + teks[1:]


def rupiah(n) -> str:
    """Format angka menjadi 'Rp 1.500.000'."""
    try:
        n = int(round(float(n)))
    except (TypeError, ValueError):
        n = 0
    return "Rp " + f"{n:,}".replace(",", ".")
