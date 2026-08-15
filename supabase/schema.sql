create extension if not exists pgcrypto;

create table if not exists public.hats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null,
  name text not null,
  cost_price integer not null default 0,
  stock_quantity integer not null default 1 check (stock_quantity >= 0),
  status text not null default 'AVAILABLE' check (status in ('AVAILABLE', 'SOLD')),
  sold_price integer,
  platform text,
  bought_at date not null default current_date,
  sold_at date,
  image_url text,
  inventory_hat_id uuid references public.hats(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.hats drop column if exists brand;
alter table public.hats drop column if exists condition;

-- Migrasi: jumlah stok bersifat opsional di UI dan bernilai 1 jika tidak diisi.
alter table public.hats add column if not exists stock_quantity integer not null default 1;
alter table public.hats alter column stock_quantity set default 1;
alter table public.hats add column if not exists inventory_hat_id uuid references public.hats(id) on delete set null;
alter table public.hats drop constraint if exists hats_stock_quantity_check;
alter table public.hats
  add constraint hats_stock_quantity_check check (stock_quantity >= 0);

alter table public.hats enable row level security;

drop policy if exists "Users can view own hats" on public.hats;
create policy "Users can view own hats"
  on public.hats for select
  using (
    auth.uid() = user_id
    or (auth.jwt() -> 'app_metadata' ->> 'created_by')::uuid = user_id
  );

drop policy if exists "Users can insert own hats" on public.hats;
create policy "Users can insert own hats"
  on public.hats for insert
  with check (
    auth.uid() = user_id
    or (auth.jwt() -> 'app_metadata' ->> 'created_by')::uuid = user_id
  );

drop policy if exists "Users can update own hats" on public.hats;
create policy "Users can update own hats"
  on public.hats for update
  using (
    auth.uid() = user_id
    or (auth.jwt() -> 'app_metadata' ->> 'created_by')::uuid = user_id
  )
  with check (
    auth.uid() = user_id
    or (auth.jwt() -> 'app_metadata' ->> 'created_by')::uuid = user_id
  );

drop policy if exists "Users can delete own hats" on public.hats;
create policy "Users can delete own hats"
  on public.hats for delete
  using (
    auth.uid() = user_id
    or (auth.jwt() -> 'app_metadata' ->> 'created_by')::uuid = user_id
  );

notify pgrst, 'reload schema';

-- Expenses table for tracking manual expenses (owner draw, operational costs)
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  amount integer not null default 0,
  type text not null default 'operational' check (type in ('owner_draw', 'operational', 'owner_capital', 'savings_deposit', 'savings_withdraw')),
  expense_date date not null default current_date,
  created_at timestamptz not null default now()
);

alter table public.expenses enable row level security;

-- Migrasi: perluas jenis transaksi (talangan owner + tabungan) untuk tabel yang sudah ada.
alter table public.expenses drop constraint if exists expenses_type_check;
alter table public.expenses
  add constraint expenses_type_check
  check (type in ('owner_draw', 'operational', 'owner_capital', 'savings_deposit', 'savings_withdraw'));

drop policy if exists "Users can view own expenses" on public.expenses;
create policy "Users can view own expenses"
  on public.expenses for select
  using (
    auth.uid() = user_id
    or (auth.jwt() -> 'app_metadata' ->> 'created_by')::uuid = user_id
  );

drop policy if exists "Users can insert own expenses" on public.expenses;
create policy "Users can insert own expenses"
  on public.expenses for insert
  with check (
    auth.uid() = user_id
    or (auth.jwt() -> 'app_metadata' ->> 'created_by')::uuid = user_id
  );

drop policy if exists "Users can delete own expenses" on public.expenses;
create policy "Users can delete own expenses"
  on public.expenses for delete
  using (
    auth.uid() = user_id
    or (auth.jwt() -> 'app_metadata' ->> 'created_by')::uuid = user_id
  );

notify pgrst, 'reload schema';

-- Tabel profil user: menyimpan username untuk login selain email
create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  workspace_owner_id uuid not null references auth.users(id) on delete cascade,
  username text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

-- Hanya service role yang mengakses tabel ini (diakses lewat API route, bukan client)
drop policy if exists "Service role only user_profiles" on public.user_profiles;

create index if not exists user_profiles_username_idx on public.user_profiles (username);
create index if not exists user_profiles_workspace_idx on public.user_profiles (workspace_owner_id);

notify pgrst, 'reload schema';
