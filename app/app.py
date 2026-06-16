"""Aplikasi Web Otomatisasi Cetak SPJ Dana BOS + Integrasi Arcas.

Jalankan:  python app.py    lalu buka http://127.0.0.1:5000
"""

from __future__ import annotations

import base64
import io
import mimetypes
import os
import zipfile

from flask import (
    Flask, render_template, request, redirect, url_for, flash,
    send_file, jsonify, abort,
)
from werkzeug.utils import secure_filename

from spjarcas import arcas, store, documents

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.join(BASE_DIR, "static", "uploads")
SAMPLE_DB = os.path.join(BASE_DIR, "data", "sample_arcas.db")

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "spj-bos-arcas-secret")
app.config["MAX_CONTENT_LENGTH"] = 8 * 1024 * 1024  # 8 MB untuk logo

DOC_TYPES = {
    "kuitansi": "Kuitansi",
    "pesanan": "Pesanan & Faktur",
    "bast": "Berita Acara Serah Terima (BAST)",
    "pemeriksaan": "Berita Acara Pemeriksaan Barang",
}


# --- Util -------------------------------------------------------------------
def logo_data_uri(filename: str) -> str:
    if not filename:
        return ""
    path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(path):
        return ""
    mime = mimetypes.guess_type(path)[0] or "image/png"
    with open(path, "rb") as fh:
        b64 = base64.b64encode(fh.read()).decode("ascii")
    return f"data:{mime};base64,{b64}"


@app.context_processor
def inject_globals():
    s = store.get_settings()
    return {
        "settings": s,
        "DOC_TYPES": DOC_TYPES,
        "logo_pemda_uri": logo_data_uri(s.get("logo_pemda", "")),
        "logo_sekolah_uri": logo_data_uri(s.get("logo_sekolah", "")),
        "rupiah": documents.rupiah,
    }


def current_filter():
    s = store.get_settings()
    bulan = request.args.get("bulan", type=int) or 0
    tahun = request.args.get("tahun", type=int) or int(s.get("tahun_anggaran", 2026))
    return bulan, tahun


def filtered_cache(bulan: int, tahun: int):
    out = []
    for t in store.get_cache():
        if tahun and int(t.get("tahun", 0)) != tahun:
            continue
        if bulan and int(t.get("bulan", 0)) != bulan:
            continue
        out.append(t)
    return out


# --- Dashboard --------------------------------------------------------------
@app.route("/")
def dashboard():
    bulan, tahun = current_filter()
    cache = store.get_cache()
    rows = filtered_cache(bulan, tahun)
    total = sum(documents.merge_transaksi(t)["total"] for t in rows)
    return render_template(
        "dashboard.html", bulan=bulan, tahun=tahun,
        jumlah_transaksi=len(rows), total=total,
        total_all=len(cache), bulan_id=documents.BULAN_ID,
    )


# --- Sinkronisasi -----------------------------------------------------------
@app.post("/sync/sample")
def sync_sample():
    arcas.build_sample_db(SAMPLE_DB)
    store.save_settings({"arcas_db_path": SAMPLE_DB})
    flash("Database contoh Arcas dibuat & dihubungkan.", "success")
    return redirect(url_for("settings_page"))


@app.post("/sync/test")
def sync_test():
    s = store.get_settings()
    reader = arcas.ArcasReader(s.get("arcas_db_path", ""), s.get("mapping"))
    ok, msg = reader.test_connection()
    return jsonify({"ok": ok, "message": msg})


@app.post("/sync")
def sync():
    s = store.get_settings()
    bulan = request.form.get("bulan", type=int) or 0
    tahun = request.form.get("tahun", type=int) or int(s.get("tahun_anggaran", 2026))
    path = s.get("arcas_db_path", "")
    if not path:
        flash("Database Arcas belum diatur. Buka Pengaturan atau buat data contoh.", "danger")
        return redirect(url_for("settings_page"))
    try:
        reader = arcas.ArcasReader(path, s.get("mapping"))
        data = reader.fetch(bulan or None, tahun or None)
    except Exception as exc:
        flash(f"Gagal sinkron: {exc}", "danger")
        return redirect(url_for("dashboard"))

    # gabung dengan cache lama (ganti yang seperiode, pertahankan lainnya)
    existing = {str(t["id"]): t for t in store.get_cache()}
    for t in data:
        existing[str(t.id)] = t.to_dict()
    store.save_cache(list(existing.values()))
    flash(f"Sinkron berhasil: {len(data)} transaksi ditarik dari Arcas.", "success")
    return redirect(url_for("transactions", bulan=bulan, tahun=tahun))


# --- Daftar transaksi -------------------------------------------------------
@app.route("/transactions")
def transactions():
    bulan, tahun = current_filter()
    rows = [documents.merge_transaksi(t) for t in filtered_cache(bulan, tahun)]
    return render_template(
        "transactions.html", rows=rows, bulan=bulan, tahun=tahun,
        bulan_id=documents.BULAN_ID,
    )


# --- Editor transaksi & narasi ---------------------------------------------
@app.route("/transaction/<tx_id>/edit", methods=["GET", "POST"])
def edit_transaction(tx_id):
    tx = store.get_transaksi(tx_id)
    if not tx:
        abort(404)
    if request.method == "POST":
        ov = {
            "nama_toko": request.form.get("nama_toko", "").strip(),
            "alamat": request.form.get("alamat", "").strip(),
            "telepon": request.form.get("telepon", "").strip(),
            "pemilik": request.form.get("pemilik", "").strip(),
            "narasi": request.form.get("narasi", "").strip(),
            "tanggal": request.form.get("tanggal", "").strip(),
        }
        store.save_override(tx_id, {k: v for k, v in ov.items() if v})
        flash("Perubahan disimpan.", "success")
        return redirect(url_for("edit_transaction", tx_id=tx_id))
    data = documents.merge_transaksi(tx)
    saran = documents.ringkas_narasi(data["items"])
    return render_template("edit.html", tx=data, saran=saran)


# --- Dokumen ----------------------------------------------------------------
@app.route("/transaction/<tx_id>/doc/<doctype>")
def view_doc(tx_id, doctype):
    if doctype not in DOC_TYPES:
        abort(404)
    ctx = documents.doc_context(tx_id)
    if not ctx:
        abort(404)
    ctx.update(logo_pemda_uri=logo_data_uri(ctx["s"].get("logo_pemda", "")),
               logo_sekolah_uri=logo_data_uri(ctx["s"].get("logo_sekolah", "")))
    return render_template(f"documents/{doctype}.html", standalone=True, **ctx)


@app.route("/transaction/<tx_id>/doc/<doctype>.pdf")
def doc_pdf(tx_id, doctype):
    if doctype not in DOC_TYPES:
        abort(404)
    ctx = documents.doc_context(tx_id)
    if not ctx:
        abort(404)
    ctx.update(logo_pemda_uri=logo_data_uri(ctx["s"].get("logo_pemda", "")),
               logo_sekolah_uri=logo_data_uri(ctx["s"].get("logo_sekolah", "")))
    html = render_template(f"documents/{doctype}.html", standalone=True, pdf=True, **ctx)
    pdf = documents.render_pdf(html, base_url=BASE_DIR)
    fname = f"{documents.safe_name(ctx['tx']['no_bpu'])}_{doctype}.pdf"
    return send_file(io.BytesIO(pdf), mimetype="application/pdf",
                     download_name=fname, as_attachment=False)


def _bundle_html(tx_id, pdf=False):
    ctx = documents.doc_context(tx_id)
    if not ctx:
        return None, None
    ctx.update(logo_pemda_uri=logo_data_uri(ctx["s"].get("logo_pemda", "")),
               logo_sekolah_uri=logo_data_uri(ctx["s"].get("logo_sekolah", "")))
    html = render_template("documents/bundle.html", pdf=pdf, **ctx)
    return html, ctx


@app.route("/transaction/<tx_id>/bundle")
def view_bundle(tx_id):
    html, ctx = _bundle_html(tx_id)
    if html is None:
        abort(404)
    return html


@app.route("/transaction/<tx_id>/bundle.pdf")
def bundle_pdf(tx_id):
    html, ctx = _bundle_html(tx_id, pdf=True)
    if html is None:
        abort(404)
    pdf = documents.render_pdf(html, base_url=BASE_DIR)
    no_bpu = ctx["tx"]["no_bpu"]
    # simpan rapi ke folder output/<BPU>/
    out = documents.output_path_for_bpu(no_bpu, f"SPJ_{documents.safe_name(no_bpu)}.pdf")
    with open(out, "wb") as fh:
        fh.write(pdf)
    return send_file(io.BytesIO(pdf), mimetype="application/pdf",
                     download_name=os.path.basename(out), as_attachment=False)


# --- Cetak Massal -----------------------------------------------------------
@app.route("/cetak-massal")
def cetak_massal():
    bulan, tahun = current_filter()
    rows = filtered_cache(bulan, tahun)
    if not rows:
        flash("Tidak ada transaksi pada periode terpilih.", "warning")
        return redirect(url_for("dashboard", bulan=bulan, tahun=tahun))

    mem = io.BytesIO()
    with zipfile.ZipFile(mem, "w", zipfile.ZIP_DEFLATED) as zf:
        for t in rows:
            html, ctx = _bundle_html(str(t["id"]), pdf=True)
            if html is None:
                continue
            pdf = documents.render_pdf(html, base_url=BASE_DIR)
            no_bpu = documents.safe_name(ctx["tx"]["no_bpu"])
            # tersusun dalam folder per nomor BPU
            zf.writestr(f"{no_bpu}/SPJ_{no_bpu}.pdf", pdf)
            # simpan juga ke disk output/
            with open(documents.output_path_for_bpu(ctx["tx"]["no_bpu"],
                      f"SPJ_{no_bpu}.pdf"), "wb") as fh:
                fh.write(pdf)
    mem.seek(0)
    label = f"{documents.BULAN_ID[bulan]+'_' if bulan else ''}{tahun}"
    return send_file(mem, mimetype="application/zip", as_attachment=True,
                     download_name=f"SPJ_BOS_{label}.zip")


# --- Honorarium & Transport -------------------------------------------------
@app.route("/honor", methods=["GET", "POST"])
def honor():
    saved = store.get_honor_list()
    result = None
    form = {
        "kegiatan": "Kegiatan Honor/Transport",
        "total": 0, "harga": 0, "tanggal": "",
        "penerima": saved or [{"nama": "", "jabatan": "", "nip": "", "satuan": "OK"}],
    }
    if request.method == "POST":
        names = request.form.getlist("nama")
        jabatan = request.form.getlist("jabatan")
        nip = request.form.getlist("nip")
        satuan = request.form.getlist("satuan")
        penerima = [
            {"nama": n, "jabatan": j, "nip": ni, "satuan": s or "OK"}
            for n, j, ni, s in zip(names, jabatan, nip, satuan) if n.strip()
        ]
        total = request.form.get("total", type=float) or 0
        harga = request.form.get("harga", type=float) or 0
        form.update({
            "kegiatan": request.form.get("kegiatan", "").strip(),
            "total": total, "harga": harga,
            "tanggal": request.form.get("tanggal", "").strip(),
            "penerima": penerima or form["penerima"],
        })
        store.save_honor_list(penerima)
        if "cetak" in request.form:
            ctx = _honor_ctx(form)
            html = render_template("documents/honor.html", standalone=True, pdf=True, **ctx)
            pdf = documents.render_pdf(html, base_url=BASE_DIR)
            return send_file(io.BytesIO(pdf), mimetype="application/pdf",
                             download_name="Dokumen_Honor.pdf")
        result = documents.hitung_honor(total, harga, penerima)
    return render_template("honor.html", form=form, result=result)


def _honor_ctx(form):
    s = store.get_settings()
    result = documents.hitung_honor(form["total"], form["harga"], form["penerima"])
    return {
        "s": s, "form": form, "result": result,
        "tanggal_indo": documents.tanggal_indo(form.get("tanggal", "")),
        "logo_pemda_uri": logo_data_uri(s.get("logo_pemda", "")),
        "logo_sekolah_uri": logo_data_uri(s.get("logo_sekolah", "")),
        "rupiah": documents.rupiah,
    }


@app.route("/honor/preview")
def honor_preview():
    # dipakai bila ingin melihat HTML honor terakhir tersimpan
    saved = store.get_honor_list()
    form = {
        "kegiatan": request.args.get("kegiatan", "Kegiatan Honor"),
        "total": request.args.get("total", 0, type=float),
        "harga": request.args.get("harga", 0, type=float),
        "tanggal": request.args.get("tanggal", ""),
        "penerima": saved,
    }
    return render_template("documents/honor.html", standalone=True, **_honor_ctx(form))


# --- Pengaturan -------------------------------------------------------------
@app.route("/settings", methods=["GET", "POST"])
def settings_page():
    if request.method == "POST":
        s = store.get_settings()
        fields = [
            "nama_pemda", "nama_dinas", "satuan_pendidikan", "npsn",
            "alamat_sekolah", "desa", "kecamatan", "kabupaten", "provinsi",
            "kepala_sekolah", "nip_kepala", "bendahara", "nip_bendahara",
            "arcas_db_path",
        ]
        updates = {f: request.form.get(f, s.get(f, "")) for f in fields}
        updates["tahun_anggaran"] = request.form.get("tahun_anggaran", type=int) or 2026

        # tim pemeriksa
        tnama = request.form.getlist("tp_nama")
        tjab = request.form.getlist("tp_jabatan")
        tnip = request.form.getlist("tp_nip")
        tim = [{"nama": n, "jabatan": j, "nip": ni}
               for n, j, ni in zip(tnama, tjab, tnip) if n.strip()]
        if tim:
            updates["tim_pemeriksa"] = tim

        # logo upload
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        for field in ("logo_pemda", "logo_sekolah"):
            file = request.files.get(field)
            if file and file.filename:
                ext = os.path.splitext(secure_filename(file.filename))[1].lower()
                if ext in (".png", ".jpg", ".jpeg", ".gif"):
                    fname = f"{field}{ext}"
                    file.save(os.path.join(UPLOAD_DIR, fname))
                    updates[field] = fname
        store.save_settings(updates)
        flash("Pengaturan disimpan.", "success")
        return redirect(url_for("settings_page"))
    return render_template("settings.html", sample_db=SAMPLE_DB)


# --- Smart Arcas (panduan kode) --------------------------------------------
@app.route("/smart-arcas")
def smart_arcas():
    return render_template("smart_arcas.html", panduan=SMART_ARCAS_GUIDE)


SMART_ARCAS_GUIDE = [
    {
        "program": "01 - Pengembangan Standar Kompetensi Lulusan",
        "kegiatan": "01.01 Penyusunan kompetensi lulusan",
        "rekening": "5.1.02.01.01.0024 Belanja Alat Tulis Kantor",
        "contoh": "Pembelian ATK untuk kegiatan ujian/penilaian.",
    },
    {
        "program": "02 - Pengembangan Standar Isi",
        "kegiatan": "02.05 Pengembangan sarana penunjang",
        "rekening": "5.1.02.01.01.0026 Belanja Alat/Bahan Kebersihan",
        "contoh": "Pembelian alat & bahan kebersihan sekolah.",
    },
    {
        "program": "03 - Pengembangan Pendidik & Tenaga Kependidikan",
        "kegiatan": "03.01 Peningkatan kompetensi PTK",
        "rekening": "5.1.02.02.01.0052 Belanja Penggandaan",
        "contoh": "Fotokopi/penggandaan materi pelatihan.",
    },
    {
        "program": "06 - Pengembangan Standar Pengelolaan",
        "kegiatan": "06.03 Kegiatan rapat & koordinasi",
        "rekening": "5.1.02.01.01.0052 Belanja Honorarium",
        "contoh": "Honor narasumber/panitia kegiatan.",
    },
]


if __name__ == "__main__":
    os.makedirs(os.path.join(BASE_DIR, "data"), exist_ok=True)
    port = int(os.environ.get("PORT", 5000))
    host = os.environ.get("HOST", "127.0.0.1")
    debug = os.environ.get("DEBUG", "1") == "1"
    app.run(host=host, port=port, debug=debug, threaded=True)
