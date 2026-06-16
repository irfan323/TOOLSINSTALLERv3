// Interaksi umum SPJ BOS Otomatis.
// Konfirmasi sebelum aksi cetak massal yang berat.
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('a[href*="cetak-massal"]').forEach(a => {
    a.addEventListener('click', (e) => {
      if (!confirm('Generate seluruh dokumen SPJ untuk periode ini menjadi ZIP per BPU?')) {
        e.preventDefault();
      }
    });
  });
});
