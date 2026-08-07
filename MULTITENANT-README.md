# Multi-Tenant: Registrasi Akun, Lupa Password, Isolasi Data per Akun

Ringkasan implementasi sesuai master prompt. Baca ini sebelum deploy.

## Yang sudah dikerjakan

**1. Registrasi & isolasi data (multi-tenant)**
- Model `Project` baru di `prisma/schema.prisma` — 1 Project = 1 ruang kerja
  penelitian milik 1 akun.
- `Respondent`, `ResearchCode`, `Setting`, `AuditLog` sekarang punya kolom
  `projectId`. Kode responden & kode penelitian unik **per project**
  (bukan global lagi) — dua akun bisa sama-sama punya `RESP-0001`.
- Akun baru dibuat lewat `/register` → `POST /api/auth/register` →
  `supabase.auth.signUp()` (akun sungguhan di Supabase Auth) lalu langsung
  membuat 1 Project baru yang **kosong total** (0 responden, 0 kode, 0
  analisis) — tidak ada data yang disalin dari akun manapun.
- Semua endpoint `/api/admin/*` (respondents, stats, codes, export,
  export-sav, cleanup, settings, dan seluruh modul statistik: factor,
  regression, logistic, mediation, moderation, cluster, cohort, crosstab,
  reliability, partial-corr, compare, ai-analytics) sudah difilter
  `where: { projectId: <project milik akun yang login> }`.

**2. Login**
- Layar "Panel Peneliti" (`admin-login.tsx`) sekarang punya 2 tab:
  - **Akun Peneliti** — login Supabase Auth (email + password), akun baru
    hasil `/register`.
  - **Admin Lama** — form login lama (`admin` / `teenmind2025`), tetap
    berfungsi untuk kompatibilitas mundur. Semua data yang sudah ada
    sebelum fitur ini otomatis berada di Project **"Legacy / Default"**.
- Kedua jalur login menghasilkan cookie yang sama (`teenmind_admin`) yang
  langsung ter-resolve ke `projectId` masing-masing — jadi seluruh route API
  yang sudah ada tidak perlu ditulis ulang satu-satu.

**3. Lupa Password & Reset Password**
- `/forgot-password` → `supabase.auth.resetPasswordForEmail()` (client-side,
  persis seperti diminta di master prompt).
- `/reset-password` → menangkap sesi recovery dari link email lalu
  `supabase.auth.updateUser({ password })`.
- Menu **Ganti Password** ditambahkan di tab Pengaturan dashboard admin
  (`settings-panel.tsx`) → `POST /api/auth/change-password` (verifikasi
  password lama dengan re-auth, lalu update).

**4. Keamanan**
- Password akun baru divalidasi: minimal 8 karakter + huruf besar + huruf
  kecil + angka + karakter spesial (di client *dan* di server).
- Logout sekarang membersihkan cookie admin lama **dan** sesi Supabase
  sekaligus (`/api/auth/logout`).
- Setiap registrasi & login dicatat ke `AuditLog` (scoped ke `projectId`).

## Yang WAJIB dijalankan sebelum deploy

1. **Jalankan migrasi SQL** — buka Supabase Dashboard → SQL Editor, jalankan
   isi `prisma/migration-multitenant.sql`. File ini aman dijalankan di
   database yang sudah berisi data: semua data lama otomatis dipindahkan ke
   Project "Legacy / Default" tanpa ada yang hilang.
2. **Generate ulang Prisma Client** — sandbox tempat saya mengerjakan ini
   tidak punya akses ke `binaries.prisma.sh` (dibatasi jaringan), jadi saya
   **tidak bisa menjalankan `prisma generate` / `next build` di sini** untuk
   verifikasi akhir. Di komputer/CI Anda yang punya akses internet normal:
   ```bash
   bun install        # atau npm install
   bunx prisma generate
   bun run build       # atau npm run build — perbaiki jika ada error tipe yang tersisa
   ```
   Saya sudah mengecek dengan `tsc --noEmit` menggunakan Prisma Client stub
   (tanpa engine) dan memastikan **tidak ada error baru** dibanding kode
   aslinya, tapi ini bukan pengganti build sungguhan dengan client yang
   benar-benar ter-generate dari schema baru.
3. **Konfigurasi Supabase Auth** (Dashboard → Authentication → URL
   Configuration): set *Site URL* & *Redirect URLs* ke domain Anda
   (mis. `https://tesisku.vercel.app`) supaya link konfirmasi
   email/reset-password mengarah ke tempat yang benar
   (`/reset-password`). Kalau ingin akun langsung aktif tanpa klik email
   dulu, matikan "Confirm email" di Authentication → Providers → Email.

## Batasan yang perlu diketahui

- **Kode responden dicari lintas-project.** Responden hanya tahu kode
  mereka (mis. `SMP001001`), bukan project mana yang mengeluarkannya, jadi
  `/api/login` mencari kode itu di **semua** project lalu mengikuti
  project pemiliknya. Ini aman selama setiap peneliti memakai prefix/format
  kode yang berbeda satu sama lain (disarankan, karena `ResearchCode.code`
  sekarang hanya unik *per project* — dua project bisa punya kode yang
  identik). Kalau Anda butuh isolasi yang lebih ketat, tambahkan prefix
  unik per akun ke kode (mis. `<username>-SMP001001`).
- Sistem admin lama (`admin_users`, username/password SHA-256) **tetap
  dipertahankan** untuk kompatibilitas mundur, bukan dihapus — supaya data
  lama tidak perlu migrasi akun.
- Mirror tulis-saja ke Supabase `public` schema (`src/lib/supabase-sync.ts`,
  nonaktif secara default lewat `ENABLE_SUPABASE_SYNC`) **belum** diberi
  `project_id` karena tidak pernah dibaca aplikasi. Kalau suatu saat
  diaktifkan untuk keperluan BI eksternal, migrasikan juga
  `supabase-schema.sql` dengan pola yang sama seperti
  `migration-multitenant.sql`.
