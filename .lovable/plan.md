# Focus Hub — Rencana Implementasi

## Hasil audit (ringkas)
- Semua data AWWAB disimpan sebagai satu state di perangkat dan disinkron ke akun (satu baris per user).
- Aktivitas terkait yang sudah ada: Deep Work (menit, 600/minggu), Study Session (5 sesi/minggu), Skill Development (harian).

## Keputusan utama
1. **Tanpa migrasi database.** Kategori dan sesi fokus disimpan di state yang sama (ikut sinkron, terisolasi per akun).
2. **Referensi saja, tidak masuk skor.** Sesi fokus tidak pernah mengisi Daily Tracker atau Life Score. Kategori boleh diberi "aktivitas terkait" (mis. Deep Work), dan di Daily Tracker muncul petunjuk kecil seperti "Focus Hub: 95 menit hari ini" di samping aktivitas itu — kamu yang tetap mengisi nilainya sendiri.
3. **Timer berbasis timestamp:** durasi = (selesai − mulai) − total jeda. Tetap akurat saat tab tidak aktif atau di-refresh. Hanya satu sesi aktif.
4. **Sesi terputus** (aktif > 12 jam): saat membuka app muncul pilihan Lanjutkan / Selesaikan dengan jam akhir pilihanmu / Buang. Tidak menebak jam akhir.
5. Link ke Planner/Goal/Project/Milestone hanya konteks, tidak menyelesaikan item otomatis. Mulai dari item Planner mengisi judul & kategori.

## Halaman /focus
- Timer besar, kategori, judul & catatan opsional; Mulai/Jeda/Lanjut/Selesai/Batal (konfirmasi saat batal).
- Quick start: Study Session, Deep Work, Skill Development (bisa diubah/diarsip).
- Riwayat sesi: lihat, edit, hapus.
- Ringkasan harian/mingguan/bulanan: total, per kategori, jumlah sesi, rata-rata, tren, progres target opsional.
- Kelola kategori: nama, deskripsi, warna, urutan, arsip (riwayat tetap ada), target default, aktivitas terkait.
- Masuk navigasi desktop & mobile, gaya cream/navy/dusty rose, tanpa gamifikasi.

## Technical details
- `src/lib/awwab/focus.ts`: pure duration/aggregation/interrupted detection; never imported by calc.ts.
- AppState: `focusCategories`, `focusSessions` (pauses array); idempotent start.
- Vitest for duration with pauses, aggregation, archive, duplicate start.
- AGENTS.md rule: Focus Hub is reference-only.
