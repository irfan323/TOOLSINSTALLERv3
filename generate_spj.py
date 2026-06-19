#!/usr/bin/env python3
"""Aplikasi SPJ - generator lampiran Excel.

Pemakaian:
    python3 generate_spj.py                       # output default
    python3 generate_spj.py -o /path/Hasil.xlsx   # tentukan nama/lokasi file

Menghasilkan satu workbook Excel berisi seluruh dokumen & lampiran SPJ
Pengadaan Bahan Pelatihan (Peracikan Minuman Kopi & Junior Make Up Artist)
BBPVP Makassar.
"""

import argparse

from spj.excel import generate
from spj.items import KOPI, MAKEUP, hitung_total
from spj import config


def main():
    ap = argparse.ArgumentParser(description="Generator lampiran Excel SPJ BBPVP Makassar")
    ap.add_argument("-o", "--output", default="SPJ_BBPVP_Makassar.xlsx",
                    help="nama file Excel keluaran (default: SPJ_BBPVP_Makassar.xlsx)")
    args = ap.parse_args()

    path = generate(args.output)

    nk = config.NILAI_KONTRAK
    print("=" * 64)
    print("  APLIKASI SPJ - BBPVP MAKASSAR")
    print("=" * 64)
    print(f"  Kejuruan Kopi     : {len(KOPI['items'])} item | HPS Rp {hitung_total(KOPI):,}")
    print(f"  Kejuruan Make Up  : {len(MAKEUP['items'])} item | HPS Rp {hitung_total(MAKEUP):,}")
    print("-" * 64)
    print(f"  Nilai Kontrak Kopi    : Rp {nk['kopi']:,}")
    print(f"  Nilai Kontrak Make Up : Rp {nk['makeup']:,}")
    print(f"  TOTAL SPJ             : Rp {nk['total']:,}")
    print("-" * 64)
    print(f"  File Excel tersimpan  : {path}")
    print("=" * 64)


if __name__ == "__main__":
    main()
