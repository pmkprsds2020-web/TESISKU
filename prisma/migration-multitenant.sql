-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  TeenMind Research — Multi-Tenant Migration (Registrasi Akun,      ║
-- ║  Lupa Password, Isolasi Data per Akun Peneliti)                    ║
-- ║                                                                    ║
-- ║  Jalankan di: Supabase Dashboard → SQL Editor → New Query          ║
-- ║  (schema target: prisma_app — schema yang dipakai Prisma, BUKAN    ║
-- ║   schema "public" yang dipakai supabase-schema.sql)                ║
-- ║                                                                    ║
-- ║  Aman dijalankan di database yang sudah berisi data: semua data    ║
-- ║  responden/kode/log yang sudah ada akan dipindahkan ke satu        ║
-- ║  Project bernama "Legacy / Default" (owner = admin lama), jadi     ║
-- ║  TIDAK ADA data yang hilang.                                       ║
-- ╚══════════════════════════════════════════════════════════════════╝

set search_path = prisma_app, public;

-- ─── 1. Tabel Project (workspace per akun peneliti) ────────────────────
create table if not exists prisma_app."Project" (
  id                  text primary key default gen_random_uuid()::text,
  "ownerId"           text unique not null,       -- supabase auth.users.id, atau 'legacy:<username>'
  "ownerEmail"        text,
  "ownerName"         text,
  username            text unique,
  name                text not null,
  "researchTitle"     text,
  institution         text,
  phone               text,
  "targetRespondents" integer not null default 100,
  status              text not null default 'active',
  "createdAt"         timestamptz not null default now(),
  "updatedAt"         timestamptz not null default now()
);

-- Idempotent safety net: kalau tabel Project sudah pernah dibuat oleh versi
-- migrasi sebelumnya tanpa kolom-kolom ini, tambahkan sekarang.
alter table prisma_app."Project" add column if not exists "ownerName" text;
alter table prisma_app."Project" add column if not exists username text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'Project_username_key') then
    alter table prisma_app."Project" add constraint "Project_username_key" unique (username);
  end if;
end $$;

-- ─── 2. Project "Legacy / Default" untuk menampung data yang sudah ada ─
-- Owner memakai id akun admin lama yang sudah ada di admin_users (kalau
-- ada beberapa, dipakai yang pertama dibuat). Kalau tabel AdminUser
-- kosong, tetap dibuat 1 project legacy supaya kolom project_id pada
-- data lama tidak pernah NULL.
insert into prisma_app."Project" (id, "ownerId", name, "researchTitle", "targetRespondents")
select
  'legacy-default-project',
  coalesce('legacy:' || (select username from prisma_app."AdminUser" order by "createdAt" asc limit 1), 'legacy:admin'),
  'Legacy / Default',
  (select value from prisma_app."Setting" where key = 'researchTitle' limit 1),
  coalesce((select (value::text)::int from prisma_app."Setting" where key = 'targetRespondents' limit 1), 100)
where not exists (select 1 from prisma_app."Project" where id = 'legacy-default-project');

-- ─── 3. Tambah kolom project_id ke tabel-tabel data penelitian ─────────
alter table prisma_app."Respondent"   add column if not exists "projectId" text;
alter table prisma_app."ResearchCode" add column if not exists "projectId" text;
alter table prisma_app."AuditLog"     add column if not exists "projectId" text;

-- Backfill semua baris lama ke Project legacy
update prisma_app."Respondent"   set "projectId" = 'legacy-default-project' where "projectId" is null;
update prisma_app."ResearchCode" set "projectId" = 'legacy-default-project' where "projectId" is null;
update prisma_app."AuditLog"     set "projectId" = 'legacy-default-project' where "projectId" is null;

-- Wajibkan project_id ke depan (bukan untuk AuditLog — tetap boleh NULL
-- untuk event yang belum tentu terikat 1 project, mis. percobaan login gagal)
alter table prisma_app."Respondent"   alter column "projectId" set not null;
alter table prisma_app."ResearchCode" alter column "projectId" set not null;

-- Foreign keys
alter table prisma_app."Respondent"
  drop constraint if exists "Respondent_projectId_fkey",
  add constraint "Respondent_projectId_fkey" foreign key ("projectId")
    references prisma_app."Project"(id) on delete cascade;

alter table prisma_app."ResearchCode"
  drop constraint if exists "ResearchCode_projectId_fkey",
  add constraint "ResearchCode_projectId_fkey" foreign key ("projectId")
    references prisma_app."Project"(id) on delete cascade;

alter table prisma_app."AuditLog"
  drop constraint if exists "AuditLog_projectId_fkey",
  add constraint "AuditLog_projectId_fkey" foreign key ("projectId")
    references prisma_app."Project"(id) on delete cascade;

-- ─── 4. Kode responden & kode penelitian: unik PER PROJECT, bukan global ─
-- Respondent.code sebelumnya @unique global -> sekarang @@unique([projectId, code])
alter table prisma_app."Respondent" drop constraint if exists "Respondent_code_key";
alter table prisma_app."Respondent"
  drop constraint if exists "Respondent_projectId_code_key",
  add constraint "Respondent_projectId_code_key" unique ("projectId", code);

-- ResearchCode.code sebelumnya primary key global -> sekarang id baru + unique per project
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'prisma_app' and table_name = 'ResearchCode' and column_name = 'id'
  ) then
    null; -- kolom id sudah ada (migrasi sudah pernah dijalankan)
  else
    alter table prisma_app."ResearchCode" add column id text;
    update prisma_app."ResearchCode" set id = gen_random_uuid()::text where id is null;
    alter table prisma_app."ResearchCode" drop constraint if exists "ResearchCode_pkey";
    alter table prisma_app."ResearchCode" alter column id set not null;
    alter table prisma_app."ResearchCode" add primary key (id);
  end if;
end $$;

alter table prisma_app."ResearchCode"
  drop constraint if exists "ResearchCode_projectId_code_key",
  add constraint "ResearchCode_projectId_code_key" unique ("projectId", code);

create index if not exists "Respondent_projectId_idx"   on prisma_app."Respondent" ("projectId");
create index if not exists "ResearchCode_projectId_idx" on prisma_app."ResearchCode" ("projectId");
create index if not exists "AuditLog_projectId_idx"     on prisma_app."AuditLog" ("projectId");

-- ─── 5. Settings: dari 1 baris per key -> 1 baris per (project, key) ───
alter table prisma_app."Setting" add column if not exists "projectId" text;
update prisma_app."Setting" set "projectId" = 'legacy-default-project' where "projectId" is null;
alter table prisma_app."Setting" alter column "projectId" set not null;
alter table prisma_app."Setting" drop constraint if exists "Setting_pkey";
alter table prisma_app."Setting" add primary key ("projectId", key);
alter table prisma_app."Setting"
  drop constraint if exists "Setting_projectId_fkey",
  add constraint "Setting_projectId_fkey" foreign key ("projectId")
    references prisma_app."Project"(id) on delete cascade;

-- ═════════════════════════════════════════════════════════════════════
-- SELESAI — Verifikasi dengan:
--   select id, name, "ownerId", "targetRespondents" from prisma_app."Project";
--   select "projectId", count(*) from prisma_app."Respondent" group by 1;
-- ═════════════════════════════════════════════════════════════════════
