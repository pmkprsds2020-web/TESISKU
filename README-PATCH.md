# Patch TeenMind/TESISKU — v5: connection pool exhaustion di /api/save

## Bukti
Log Vercel menunjukkan `PATCH /api/save` gagal berulang-ulang (500) dengan:
```
PrismaClientKnownRequestError P2024
Timed out fetching a new connection from the connection pool.
Current connection pool timeout: 10, connection limit: 1
```
Ini murni beban konkuren nyata (banyak siswa mengisi kuesioner bersamaan)
menabrak `connection_limit=1` di DATABASE_URL Supabase pooler — sudah
diantisipasi sebagian lewat `withDbRetry`, tapi retry itu cuma dipasang di
query pertama (`findUnique`), dan cuma 1x percobaan. Query-query lain
(`upsert`, `$transaction`, `update` di akhir setiap request) tidak
dilindungi retry maupun try/catch sama sekali, jadi begitu koneksi habis di
query manapun setelah yang pertama, request langsung gagal 500 mentah.

## File yang diubah

### `src/lib/db.ts`
- `isTransientConnectionError` sekarang di-export (dipakai route handler
  untuk membedakan error transient vs bug asli).
- `withDbRetry` default retries dinaikkan dari 1 → 2.

### `src/app/api/save/route.ts`
- POST & PATCH sekarang dibungkus try/catch penuh.
- Update akhir (`db.respondent.update`, yang SELALU jalan di setiap
  request apa pun stage-nya) sekarang ikut lewat `withDbRetry`.
- Kalau error yang tertangkap transient (pool exhaustion), response
  sekarang **503** dengan pesan jelas (`"Server sedang sibuk, coba lagi
  sebentar lagi."`) — bukan 500 mentah. Frontend (`api-save.ts`,
  `submitStage()`) sudah lama menangani status non-2xx selain 401 sebagai
  `server_error` yang retryable, jadi ini otomatis terpakai tanpa ubah
  frontend.

## YANG TIDAK saya ubah, dan kenapa (soal dokumen prompt 19-poin Anda)
Beberapa poin di dokumen itu berdasarkan asumsi yang sudah tidak akurat
untuk kondisi project Anda saat ini — saya cek dulu sebelum eksekusi:
- "Pastikan hanya ada SATU instance PrismaClient" — sudah benar sejak awal
  (`globalForPrisma` singleton pattern di db.ts).
- "NextResponse.cookies.set() dipakai dengan benar" — sudah diperbaiki di
  patch v3 sebelumnya.
- "credentials: include di semua fetch" — sudah ditambahkan di titik yang
  relevan (v3); menambahkannya ke ~25 titik fetch lain tidak menambah
  proteksi untuk request same-origin (default browser sudah mengirim
  cookie), jadi saya lewati supaya diff tidak membengkak tanpa manfaat.
- Poin soal "ubah DATABASE_URL ke Session Pooler port 6543" — **ini yang
  perlu Anda cek sendiri**, karena nilainya ada di Environment Variables
  Vercel (bukan di kode/repo, sengaja tidak disimpan di git). Buka:
  Vercel Dashboard → Project → Settings → Environment Variables →
  `DATABASE_URL`. Pastikan formatnya:
  ```
  postgresql://...:6543/postgres?pgbouncer=true&connection_limit=1&pool_timeout=10
  ```
  Kalau port-nya 5432 (direct connection, bukan pooler), itu memang
  akar masalah tambahan yang HARUS diperbaiki manual di sana — kode tidak
  bisa memperbaiki ini karena nilainya rahasia/environment-specific.
  Kalau trafik memang ramai (banyak siswa bersamaan), pertimbangkan naikkan
  `connection_limit` dari 1 ke 3–5 (Supabase Transaction pooler mendukung
  lebih dari itu per project).

## Cara update ke GitHub
Copy semua file (akumulasi v1-v5) ke repo, commit, push.

## Verifikasi
1. Cek DATABASE_URL di Vercel (lihat catatan di atas).
2. Test dengan beberapa tab/device isi kuesioner bersamaan — kalau pool
   memang sempat penuh, sekarang harus retry otomatis dan/atau tampil
   pesan "Server sedang sibuk" yang jelas, bukan macet/500 tanpa keterangan.
3. Pantau log Vercel: P2024 seharusnya jauh berkurang; kalau masih sering
   muncul meski sudah retry 2x, itu tanda `connection_limit` di
   DATABASE_URL perlu dinaikkan.
