# Patch TeenMind/TESISKU — v6: region mismatch Vercel ↔ Supabase

## Bukti
Setelah DATABASE_URL diganti ke pooler (format sudah benar, region cocok,
project aktif, tidak ada network restriction — semua sudah dicek satu-satu),
Prisma tetap gagal dengan "Can't reach database server". Log Vercel
sebelumnya menunjukkan function dieksekusi di **iad1 (Washington DC, AS)**,
sementara database ada di **ap-southeast-2 (Sydney, Australia)** — jarak
lintas benua untuk SETIAP query, sangat rawan timeout koneksi terutama
untuk handshake TCP/TLS ke pooler.

## File baru
`vercel.json` — mengunci region Serverless Function ke `syd1` (Sydney),
region Vercel terdekat dengan `ap-southeast-2`. Hobby plan bisa pilih satu
region lewat file ini (terkonfirmasi dari dokumentasi Vercel).

## PENTING — reset password database
Anda sempat menempel password asli database di percakapan ini. Sebelum
lanjut, WAJIB:
1. Supabase Dashboard → Project Settings → Database → Reset Database
   Password.
2. Update `DATABASE_URL` di Vercel dengan password baru.

## Cara update ke GitHub
Copy semua file (akumulasi v1-v6, termasuk `vercel.json` di root repo) ke
repo, commit, push.

## Verifikasi setelah deploy
1. Vercel Dashboard → Deployments → deployment terbaru → cek bagian
   "Functions" di build summary, pastikan region sekarang `syd1`.
2. Coba login admin & login responden lagi.
3. Kalau masih "Can't reach database server" setelah ini, kemungkinan
   besar bukan lagi soal jarak/region — kabari saya dengan log terbaru,
   karena berarti ada penyebab lain (mis. Supabase Pooler service sendiri
   sedang bermasalah, perlu dicek via status.supabase.com).
