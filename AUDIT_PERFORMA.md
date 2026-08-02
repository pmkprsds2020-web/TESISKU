# Audit & Optimasi Performa — TeenMind Research (TESISKU)

> Catatan penting: proyek di dalam zip ini bernama **TeenMind** (platform
> penelitian tesis biopsikososial depresi remaja — survei responden +
> dashboard statistik admin), bukan CareLivia. Audit ini murni berdasarkan
> kode di repo ini.

Stack: Next.js 16 (App Router, Turbopack) · React 19 · Prisma + Postgres ·
Supabase · Zustand.

---

## Ringkasan Temuan

| # | Masalah | Root cause | Status |
|---|---------|-----------|--------|
| 1 | Loading awal sangat lama | `page.tsx` mengimpor **seluruh** admin dashboard (recharts, framer-motion, react-markdown, 9 panel statistik) secara statis — dimuat oleh **setiap** pengunjung, termasuk responden yang tidak pernah membuka admin | ✅ Diperbaiki |
| 2 | Perpindahan halaman / klik jawaban tidak responsif | Setiap save (PATCH per klik jawaban) melakukan **dual-write** blocking ke Prisma **dan** Supabase — padahal tidak ada satupun route di app ini yang membaca dari Supabase | ✅ Diperbaiki |
| 3 | Banyak request API tidak efisien | Double-save per pertanyaan di CESD-R & Screen Time (klik jawaban + klik "Lanjut" = 2x request identik) | ✅ Diperbaiki |
| 4 | Dashboard lambat tampil | Query stats admin berjalan sekuensial (6 round-trip DB berurutan) + 1 query duplikat yang hasilnya tidak pernah dipakai + korelasi dihitung ulang 2x | ✅ Diperbaiki |
| 5 | Generate AI lambat | Response AI ditunggu penuh sebelum ditampilkan (tidak streaming) | ✅ Diperbaiki |
| 6 | Query database lambat / log berlebihan | Prisma mencatat **setiap** query SQL ke stdout, termasuk di production | ✅ Diperbaiki |
| 7 | **Bug kritis ditemukan** (bukan soal performa) | Template literal yang tidak ditutup di `crosstab/route.ts` — **membuat production build gagal total** | ✅ Diperbaiki |

---

## Detail Temuan & Perbaikan

### 1. Bundle JS raksasa dimuat oleh semua orang di halaman pertama
**File:** `src/app/page.tsx`

Sebelumnya, komponen ini (client component tunggal yang mengatur semua
"mode" — welcome/login/respondent/admin) mengimpor `AdminDashboard` secara
statis di baris paling atas. `AdminDashboard` sendiri menarik:
- `recharts`, `framer-motion`, `react-markdown`
- `CohortPanel`, yang lagi-lagi mengimpor 9 panel statistik lain
  (crosstab, regression, logistic, reliability, factor, cluster,
  mediation, moderation, partial-corr) — masing-masing juga memakai
  `recharts`.

Akibatnya: seorang siswa SMP yang cuma mau mengisi kuesioner tetap
mendownload & mem-parse seluruh mesin analitik statistik admin sebelum
melihat layar sambutan.

**Perbaikan:** semua layar (`RespondentApp`, `AdminLoginScreen`,
`AdminDashboard`) sekarang di-*code-split* dengan `next/dynamic`, dan di
dalam `AdminDashboard`, `CohortPanel` (+9 panelnya) juga dibuat lazy —
hanya dimuat ketika tab "Cohort" benar-benar diklik. Ini adalah perbaikan
dengan dampak terbesar untuk *Initial Load*.

### 2. Dual-write blocking ke Supabase pada setiap interaksi (temuan terbesar)
**File:** `src/lib/supabase-sync.ts`, `src/app/api/save/route.ts`

Setiap kali responden memilih jawaban atau berpindah pertanyaan, server
melakukan:
1. Write ke Postgres via Prisma (`db.xxxAnswer.upsert`)
2. **Ditunggu (await)** — lookup UUID responden di Supabase (1 request
   HTTP ke REST API Supabase)
3. **Ditunggu (await)** — upsert data yang sama ke Supabase (request HTTP
   ke-2)
4. Diulang lagi untuk update record `respondent` (2 request HTTP lagi)

Jadi satu klik jawaban = hingga **4 request HTTP tambahan ke Supabase**,
semuanya berurutan dan diblokir sebelum response balik ke browser — di
atas 2 round-trip Postgres yang sudah ada.

**Yang lebih penting:** diperiksa seluruh 21 route `/api/admin/*` — semua
membaca data lewat Prisma. **Tidak ada satupun yang membaca dari Supabase.**
Artinya seluruh mirror-write ini murni biaya, tanpa manfaat apapun di
dalam aplikasi ini sendiri (kecuali ada sistem eksternal di luar repo yang
mengonsumsinya).

**Perbaikan:**
- Ditambahkan flag `ENABLE_SUPABASE_SYNC` (default **off**) — lihat
  `.env.example`. Kode sync tetap ada (tidak dihapus), untuk berjaga-jaga
  bila ada konsumen eksternal.
- Bila diaktifkan pun, semua panggilan sync sekarang **fire-and-forget**
  (tidak `await` di jalur response) — response ke browser tidak lagi
  menunggu Supabase sama sekali.
- Logging verbose (`console.log` di setiap sync) dibuat dev-only.
- Beberapa write Prisma yang independen (mis. upsert jawaban + audit log)
  digabung dengan `Promise.all` alih-alih berurutan.

### 3. Double-save per pertanyaan (CESD-R & Screen Time)
**File:** `cesdr.tsx`, `screentime.tsx`

Memilih jawaban men-*schedule* autosave 100ms kemudian; klik tombol
"Lanjut"/"Kembali" segera setelahnya mengirim **request identik** lagi
(data jawaban sama, hanya index halaman beda). Setiap pertanyaan = 2x
POST/PATCH.

**Perbaikan:** autosave 100ms dijadikan cancelable; navigasi
(`goNext`/`goPrev`) membatalkan draft yang masih tertunda karena navigasi
itu sendiri sudah mengirim data terbaru. Ketahanan data (jawaban tidak
hilang bila tab ditutup) tetap sama seperti sebelumnya.

> Pola serupa (agak lebih kecil dampaknya) juga ada di `bullying.tsx`,
> tapi tidak diubah karena strukturnya sengaja dibuat berbeda (fetch
> langsung, bukan `setTimeout`) untuk menghindari bug *stale closure* yang
> sudah pernah diperbaiki — mengubahnya berisiko menghidupkan lagi bug
> lama tersebut. Prioritas lebih rendah karena dampak dual-write Supabase
> (temuan #2) jauh lebih besar.

### 4. Query dashboard admin sekuensial + query mati (dead code)
**File:** `src/app/api/admin/stats/route.ts`

- 6 query (`count` x5 + `setting.findUnique`) dijalankan satu-per-satu
  dengan `await` berurutan → total waktu = jumlah semua query.
- Ditemukan query `completedRespondents` (fetch semua responden selesai +
  join `demographic`+`cesdr`) yang **hasilnya tidak pernah dipakai** —
  langsung ditimpa oleh query `allWithScores` setelahnya yang mengambil
  data lebih lengkap. Query mati ini tetap jalan di setiap load dashboard.
- Korelasi antar-instrumen (`corr()`) dihitung dua kali untuk setiap
  pasangan — sekali untuk field flat, sekali lagi untuk matrix.

**Perbaikan:** semua query independen digabung `Promise.all`; query mati
dihapus; setiap pasangan korelasi dihitung sekali lalu dipakai ulang.

### 5. Generate AI menunggu penuh sebelum tampil
**File:** `src/app/api/admin/ai-analytics/route.ts`

Dikonfirmasi langsung dari source `z-ai-web-dev-sdk` (diperiksa via npm
registry) bahwa `stream: true` didukung dan mengembalikan `ReadableStream`
SSE mentah dari API upstream. Sebelumnya route ini tidak memakai opsi ini
— client menunggu seluruh narasi Bab IV selesai (bisa puluhan detik untuk
teks panjang) sebelum apapun muncul di layar.

**Perbaikan:** route sekarang memakai `stream: true`, mem-parse chunk SSE,
dan meneruskannya sebagai teks polos ke browser. Client
(`handleAiAnalytics`) membaca stream dan menampilkan teks secara
progresif, kata demi kata, sehingga sesuai target "AI response mulai
muncul < 1 detik". Ada fallback otomatis ke mode non-streaming bila
provider mengembalikan JSON biasa.

### 6. Prisma logging tiap query di production
**File:** `src/lib/db.ts`

`log: ['query']` aktif tanpa syarat — mencetak setiap statement SQL ke
stdout, termasuk di production. Ini menambah overhead I/O nyata di setiap
request dan membanjiri log.

**Perbaikan:** logging query hanya aktif saat `NODE_ENV === 'development'`;
di production hanya `error` yang dicatat.

### 7. Bug kritis (bukan performa): build production gagal total
**File:** `src/app/api/admin/crosstab/route.ts` baris 85

Ditemukan saat memverifikasi build: sebuah template literal yang dibuka
dengan backtick (`` ` ``) tapi ditutup dengan tanda kutip biasa (`"`).
Karena itu, parser JavaScript menganggap seluruh kode dari baris 85 sampai
backtick berikutnya (baris 109!) sebagai **satu string literal panjang**
— termasuk kode asli di antaranya — lalu gagal parse begitu keluar dari
"string" tersebut. Ini membuat **`npx next build` gagal total** dengan
error parse di `crosstab/route.ts`, bukan cuma soal lambat.

**Perbaikan:** backtick penutup yang hilang ditambahkan kembali. Sudah
diverifikasi lewat build ulang — error parse hilang sepenuhnya.

---

## Verifikasi

- Semua file yang diubah divalidasi sintaksnya lewat TypeScript compiler
  (`ts.transpileModule`) — semua OK.
- `npm install` + `npx next build` (Turbopack) dijalankan end-to-end.
  Setelah perbaikan bug crosstab, kompilasi **berhasil** ("Compiled
  successfully"). Dua hal yang *tidak* bisa diverifikasi penuh di sandbox
  ini karena keterbatasan akses jaringan (bukan masalah kode):
  - `next/font/google` perlu mengunduh font dari `fonts.googleapis.com`
    (diblokir di sandbox ini) — akan bekerja normal di lingkungan deploy
    sungguhan.
  - `prisma generate` perlu mengunduh query-engine binary dari
    `binaries.prisma.sh` (juga diblokir di sandbox) — client Prisma tetap
    ter-generate untuk keperluan tipe, hanya binary engine yang tidak
    terunduh. Jalankan `npx prisma generate` seperti biasa di mesin
    development/CI Anda yang punya akses internet penuh.

**Sebelum deploy:** jalankan `npm install && npx prisma generate && npm
run build` di lingkungan Anda sendiri untuk memastikan semuanya utuh
(sandbox audit ini tidak bisa menyelesaikan langkah itu karena firewall
jaringan-nya sendiri, bukan karena kode bermasalah).

---

## Perkiraan Dampak terhadap Target

| Target | Kondisi sebelumnya | Setelah perbaikan |
|---|---|---|
| Initial Load < 2 detik | Bundle awal memuat seluruh admin+9 panel statistik+recharts+framer-motion untuk semua orang | Bundle awal responden hanya berisi welcome/login/survey; admin dan panel statistik jadi chunk terpisah yang dimuat sesuai kebutuhan |
| Perpindahan halaman < 300ms | Setiap klik menunggu hingga 4 HTTP round-trip Supabase tambahan (blocking) | Response tidak lagi menunggu Supabase sama sekali (fire-and-forget) |
| Query Database < 200ms | 6 query sekuensial + 1 query mati di dashboard admin | Semua query paralel, query mati dihapus |
| AI Response muncul < 1 detik | Menunggu seluruh generation selesai | Streaming token-by-token |
| Tidak ada request berulang | Double-save per pertanyaan (CESD-R, Screen Time) | Debounced, navigasi membatalkan draft yang masih tertunda |

Catatan: karena aplikasi ini adalah SPA client-side (`page.tsx` bukan
route-based navigation Next.js, melainkan `switch(mode)`), skor Lighthouse
dan waktu pasti akan sangat bergantung pada environment production
(ukuran instance database, lokasi region Supabase/Postgres, dsb) —
angka-angka di atas adalah estimasi arah perbaikan, bukan jaminan angka
pasti. Untuk validasi akhir, jalankan Lighthouse di staging/production
setelah deploy.

---

## Rekomendasi Lanjutan (belum diimplementasikan, prioritas lebih rendah)

1. **Pertimbangkan menghapus total `supabase-sync.ts`** bila dikonfirmasi
   tidak ada konsumen eksternal — saat ini hanya dinonaktifkan lewat flag,
   bukan dihapus, demi keamanan.
2. Terapkan pola cancelable-debounce yang sama (temuan #3) ke
   `bullying.tsx`, dengan hati-hati terhadap bug stale-closure yang pernah
   ada di sana.
3. Tambahkan index database pada `Respondent.startedAt` (dipakai untuk
   filter 14-hari terakhir di dashboard) bila jumlah responden bertambah
   besar.
4. Pertimbangkan react-query/SWR untuk data admin agar tidak fetch ulang
   dari nol setiap kali berpindah tab dalam dashboard.
5. Bersihkan dependency yang terpasang tapi tidak dipakai di kode
   (`next-auth`, `next-intl`, `@dnd-kit/*`, `@mdxeditor/editor`,
   `@tanstack/react-table`, `react-syntax-highlighter`) — tidak berdampak
   ke bundle runtime (tidak pernah di-import), tapi memperlambat install
   dan menambah ukuran `node_modules`.

---

## Addendum — Perbaikan Setelah Deploy Pertama (tesisku.vercel.app)

Setelah deploy, ditemukan di console browser:
- `GET /api/progress 401` — **ini normal**, bukan bug. Artinya belum ada
  sesi responden aktif di browser tersebut (belum isi kode penelitian).
  Sudah ditangani lewat `catch{}` di `page.tsx`, tidak mengganggu apapun.
- `GET /api/admin/stats 500` + `Uncaught SyntaxError: Unexpected end of
  JSON input` — **ini bug nyata**, ditemukan & diperbaiki dua lapis:

  1. **Server (`admin/stats/route.ts`)**: sebelumnya bila ada error
     runtime (mis. koneksi DB gagal, env var belum diset, skema belum
     dimigrasikan), Next.js mengembalikan 500 dengan body kosong/HTML —
     bukan JSON. Sekarang seluruh handler dibungkus `try/catch`; error asli
     dicatat ke `console.error` (akan tampil di **Vercel → project Anda →
     tab Logs / Runtime Logs**) dan client menerima JSON error yang jelas.

  2. **Client (`admin-dashboard.tsx`)**: `loadData()` sebelumnya memanggil
     `.json()` langsung tanpa cek `res.ok`, dan tidak ada `catch` sama
     sekali — jadi begitu parsing gagal, `stats` tidak pernah ter-set dan
     dashboard **tersangkut selamanya di skeleton loading** tanpa pesan
     error apapun (persis seperti di screenshot). Sekarang ada state error
     khusus dengan tombol "Coba lagi", dan response di-parse secara aman.

### Untuk menemukan akar masalah 500 yang sebenarnya

Kode di atas membuat errornya *terlihat*, tapi penyebab aslinya spesifik
ke environment deploy Anda. Langkah cek:

1. **Vercel Dashboard → project → tab "Logs"** (atau "Runtime Logs") saat
   me-refresh halaman admin — akan ada baris `[admin/stats] failed: ...`
   dengan pesan error Prisma/Postgres yang sebenarnya.
2. Pastikan environment variables berikut sudah diset di
   **Vercel → Settings → Environment Variables** (lihat `.env.example`):
   `DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Pastikan skema Prisma sudah dijalankan ke database production:
   `npx prisma db push` (atau `prisma migrate deploy` bila pakai migration
   files) — kalau tabel belum ada di DB yang ditunjuk `DATABASE_URL`,
   semua query akan gagal dengan error "relation does not exist".
4. Kalau `DATABASE_URL` memakai pooler (pgbouncer) dari Supabase, pastikan
   formatnya benar (biasanya port `6543` + `?pgbouncer=true`), dan
   `DIRECT_URL` memakai port langsung (`5432`) — Prisma butuh keduanya
   sesuai `schema.prisma`.

Setelah dicoba ulang, kalau masih 500, salin pesan error dari Vercel Logs
(langkah 1) — dengan itu akar masalahnya bisa dipastikan persis, alih-alih
menebak.

---

## Addendum 2 — Root Cause 500 Ditemukan: Connection Pool Exhaustion

Dari Vercel Logs yang dibagikan, error sebenarnya adalah:

```
Error [PrismaClientUnknownRequestError]: Invalid `prisma.respondent.findUnique()` invocation:
Error in connector: Error querying the database: FATAL: (EMAXCONNSESSION) max clie...
```

**Ini bukan bug logika di kode** — ini database connection pooler
(Supabase Supavisor) kehabisan slot koneksi. Di Vercel, tiap API route
bisa jadi serverless function terpisah, dan tiap invocation yang
di-auto-scale (mis. banyak siswa submit bersamaan) bisa membuka koneksi
Postgres-nya sendiri. Kalau `DATABASE_URL` mengarah ke pooler mode
**session** (bukan **transaction**), jumlah slot sesi yang tersedia cepat
habis di bawah beban bersamaan.

**Perbaikan kode yang diterapkan:**
1. `src/lib/db.ts` — ditambahkan `withDbRetry()`: retry sekali dengan
   backoff, khusus untuk error yang polanya connection-pool-exhaustion
   (`EMAXCONNSESSION`, `P1001`, `P1017`, `P2024`, dll) — bukan error query
   biasa, yang tetap langsung gagal seperti sebelumnya.
2. Diterapkan di titik yang paling sering gagal di log: `db.respondent.
   findUnique()` di awal `/api/save` (read-only, aman diulang) dan seluruh
   `/api/admin/stats` (juga read-only).
3. Upsert/write (mis. `auditLog.create`) **sengaja tidak** ikut di-retry
   otomatis untuk menghindari risiko duplikasi data bila retry terjadi
   setelah write sebenarnya sempat berhasil.

**Perbaikan konfigurasi yang WAJIB dilakukan di sisi Anda** (kode saja
tidak cukup untuk root cause ini):
- Pastikan `DATABASE_URL` memakai **Transaction pooler** Supabase (port
  `6543`), bukan session/direct (port `5432`), dengan
  `?pgbouncer=true&connection_limit=1&pool_timeout=10`.
- Ambil connection string yang benar dari: **Supabase Dashboard → Project
  → Connect → "Transaction pooler"**.
- `DIRECT_URL` tetap pakai port `5432` (hanya dipakai untuk
  `prisma migrate`/`db push`, bukan runtime).
- Detail & contoh lengkap ada di `.env.example` yang sudah diperbarui.

Retry di kode akan membantu request yang gagal karena lonjakan sesaat,
tapi kalau `DATABASE_URL` masih memakai pooler mode yang salah, di bawah
beban tinggi errornya akan tetap muncul (hanya lebih jarang). Perbaikan
konfigurasi di atas adalah fix yang sebenarnya.

---

## Addendum 3 — P2024 (Connection Pool Timeout) Setelah Fix connection_limit

Setelah `DATABASE_URL` diperbaiki dengan `connection_limit=1`, error
`EMAXCONNSESSION` hilang — tapi muncul error baru:

```
Error [PrismaClientKnownRequestError]: Invalid `prisma.researchCode.count()` invocation:
Timed out fetching a new connection from the connection pool.
(Current connection pool timeout: 10, connection limit: 1)   [code: P2024]
```

**Ini disebabkan langsung oleh optimasi `Promise.all` yang diterapkan di
audit awal**, yang sekarang bentrok dengan `connection_limit=1`:
`/api/admin/stats` menjalankan 8 query Prisma sekaligus lewat
`Promise.all`, tapi dengan `connection_limit=1` hanya ada 1 slot koneksi
— 7 query lain harus antre, dan kalau antreannya melebihi `pool_timeout`,
gagal dengan P2024. Pola yang sama juga ada di beberapa cabang
`/api/save` (pasangan upsert + auditLog.create via `Promise.all`).

**Perbaikan:** kedua route sekarang memakai `db.$transaction([...])`
(bentuk batch) alih-alih `Promise.all([...])`. `$transaction` batch
mengirim beberapa query lewat **satu** koneksi secara efisien — sesuai
dengan batasan `connection_limit=1` — sekaligus membuat operasinya atomik
(khusus untuk pasangan upsert+audit-log di `/api/save`, ini juga
memperbaiki celah kecil: sebelumnya kalau salah satu dari 2 write gagal
di tengah jalan, yang lain bisa saja sudah ter-commit; sekarang
keduanya sukses bersama atau gagal bersama).

**Pelajaran untuk ke depan:** dengan `connection_limit=1` (wajib untuk
serverless + Supabase transaction pooler), jangan pakai `Promise.all`
untuk beberapa query Prisma sekaligus dalam satu request — pakai
`db.$transaction([...])` (bentuk array/batch, bukan bentuk callback
interaktif) sebagai gantinya.
