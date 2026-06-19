"""Konversi angka ke huruf (Bahasa Indonesia)."""

_SATUAN = [
    "", "Satu", "Dua", "Tiga", "Empat", "Lima",
    "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas",
]


def _terbilang(n: int) -> str:
    n = int(n)
    if n < 12:
        return _SATUAN[n]
    if n < 20:
        return _terbilang(n - 10) + " Belas"
    if n < 100:
        return _terbilang(n // 10) + " Puluh" + (
            " " + _terbilang(n % 10) if n % 10 else "")
    if n < 200:
        return "Seratus" + (" " + _terbilang(n - 100) if n - 100 else "")
    if n < 1000:
        return _terbilang(n // 100) + " Ratus" + (
            " " + _terbilang(n % 100) if n % 100 else "")
    if n < 2000:
        return "Seribu" + (" " + _terbilang(n - 1000) if n - 1000 else "")
    if n < 1_000_000:
        return _terbilang(n // 1000) + " Ribu" + (
            " " + _terbilang(n % 1000) if n % 1000 else "")
    if n < 1_000_000_000:
        return _terbilang(n // 1_000_000) + " Juta" + (
            " " + _terbilang(n % 1_000_000) if n % 1_000_000 else "")
    if n < 1_000_000_000_000:
        return _terbilang(n // 1_000_000_000) + " Milyar" + (
            " " + _terbilang(n % 1_000_000_000) if n % 1_000_000_000 else "")
    return _terbilang(n // 1_000_000_000_000) + " Triliun" + (
        " " + _terbilang(n % 1_000_000_000_000) if n % 1_000_000_000_000 else "")


def terbilang(n: int) -> str:
    """Kembalikan teks terbilang dengan akhiran 'Rupiah'."""
    n = int(round(n))
    if n == 0:
        return "Nol Rupiah"
    teks = " ".join(_terbilang(n).split())
    return f"{teks} Rupiah"


if __name__ == "__main__":
    for x in (45970000, 29490000, 16480000, 100000, 1000):
        print(f"{x:>12,} -> {terbilang(x)}")
