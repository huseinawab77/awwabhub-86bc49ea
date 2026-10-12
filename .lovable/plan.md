# Focus Hub — Rencana Implementasi

## Hasil audit (ringkas)
- Semua data AWWAB (catatan harian, goals, projects, milestones, planner, routines) disimpan sebagai **satu state** di perangkat dan disinkron ke akun (satu baris per user). Tidak ada tabel terpisah per fitur.
- Aktivitas terkait yang sudah ada (tidak dibuat ulang):
  - **Deep Work** — menit, target 600 menit/**minggu**.
  - **Study Session** — checklist, target 5 sesi/minggu.
  - **Skill Development** — checklist harian.
- Life Score dihitung hanya dari catatan harian di satu tempat; Planner/Goals tidak pernah memengaruhi skor.

## Keputusan utama
1. **Tanpa migrasi database.** Kategori dan sesi fokus disimpan di state yang sama (ikut sinkron & terisolasi per akun lewat aturan akses yang sudah ada). Struktur field mengikuti spesifikasi (category, sesi, interval jeda, status RUNNING/PAUSED/COMPLETED/CANCELLED, link goal/project/milestone/planner).
2. **Kontribusi diturunkan, bukan ditulis.** Sesi fokus tidak membuat catatan harian baru. Sebuah lapisan rekonsiliasi menggabungkan catatan manual + kontribusi sesi selesai saat menghitung skor. Akibatnya:
   - Edit/hapus sesi otomatis memperbarui skor, tanpa duplikasi (idempoten by design).
   - Tiap sesi berkontribusi maksimal sekali ke satu aktivitas.
   - Daily Tracker menampilkan "dari Focus Hub" dan "manual" terpisah.
3. **Aturan pemetaan eksplisit per kategori:**
   - Aktivitas menit (Deep Work): durasi bersih dijumlah ke total harian, target mingguan tetap mingguan.
   - Aktivitas checklist (Study Session, Skill Dev): user memilih aturan "hitung selesai bila sesi ≥ X menit" (default mati sampai diatur). Satu hari dihitung maksimal satu kali.
   - Kategori tanpa pemetaan hanya untuk laporan waktu.
4. **Timer berbasis timestamp:** durasi = (selesai − mulai) − total jeda, dihitung ulang dari timestamp (tidak percaya angka durasi dari klien). Hanya satu sesi aktif; tombol mulai diabaikan bila sudah ada sesi aktif (cegah duplikat).
5. **Sesi terputus:** jika sesi aktif > 12 jam atau tidak terlihat sejak kunjungan terakhir, saat membuka app muncul dialog: Lanjutkan / Selesaikan dengan waktu akhir yang dipilih user / Buang. Tidak pernah menebak waktu akhir.
6. Link ke Planner/Goal/Project/Milestone hanya konteks — tidak pernah menyelesaikan item otomatis. Mulai dari item Planner mengisi judul & kategori, tanpa membuat item baru.

## Halaman /focus
- Timer besar + kategori + judul opsional, tombol Mulai/Jeda/Lanjut/Selesai/Batal (konfirmasi bila batal dengan waktu tercatat). Tombol utama mudah dijangkau di HP.
- Quick start: 3 kategori bawaan (bisa diubah/diarsip), pilih link opsional.
- Riwayat sesi: lihat, edit (waktu, kategori, judul, catatan, link), hapus.
- Ringkasan harian/mingguan/bulanan: total, per kategori, jumlah sesi, rata-rata durasi, tren, progres target.
- Kelola kategori: nama, deskripsi, warna (token AWWAB), urutan, arsip, target default, aktivitas terkait + aturan, link default goal/project.
- Masuk ke navigasi desktop & menu mobile. Desain mengikuti palet cream/navy/dusty rose yang ada, tanpa gamifikasi atau Pomodoro paksa.

## Keterbatasan yang akan dijelaskan jujur
- Timer tetap akurat saat tab tidak aktif/di-refresh karena berbasis timestamp, tapi tidak ada notifikasi latar belakang saat browser/HP mati.
- Sinkron antar perangkat mengikuti mekanisme yang ada (state akun menang saat login).

## Technical details
- New `src/lib/awwab/focus.ts`: pure functions — `sessionDuration`, `focusContributions(state)` → `Entries`-shaped overlay keyed by sessionId, `mergeEntries(manual, overlay)`, aggregations, interrupted-session detection.
- AppState gains `focusCategories`, `focusSessions` (with `pauses: {start,end|null}[]`); store actions with idempotent start (reject if active exists).
- calc.ts callers receive merged entries via a single helper so scoring formulas stay unchanged; weights/targets untouched.
- Vitest: duration with pauses, refresh/restore, aggregation by category/date, weekly vs daily target, edit/delete recalculation, duplicate start, checklist threshold rule, archive retains history.
- AGENTS.md rule added for Focus Hub derivation.
