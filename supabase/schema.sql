create extension if not exists pgcrypto;

create table if not exists public.hats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null,
  name text not null,
  cost_price integer not null default 0,
  status text not null default 'AVAILABLE' check (status in ('AVAILABLE', 'SOLD')),
  sold_price integer,
  platform text,
  bought_at date not null default current_date,
  sold_at date,
  image_url text,
  created_at timestamptz not null default now()
);

alter table public.hats drop column if exists brand;
alter table public.hats drop column if exists condition;

alter table public.hats enable row level security;

drop policy if exists "Users can view own hats" on public.hats;
create policy "Users can view own hats"
  on public.hats for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own hats" on public.hats;
create policy "Users can insert own hats"
  on public.hats for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own hats" on public.hats;
create policy "Users can update own hats"
  on public.hats for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own hats" on public.hats;
create policy "Users can delete own hats"
  on public.hats for delete
  using (auth.uid() = user_id);

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  auth_user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text not null,
  role text not null default 'Staff',
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  created_at timestamptz not null default now()
);

alter table public.app_users add column if not exists auth_user_id uuid references auth.users(id) on delete set null;

alter table public.app_users enable row level security;

drop policy if exists "Users can view own app users" on public.app_users;
create policy "Users can view own app users"
  on public.app_users for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own app users" on public.app_users;
create policy "Users can insert own app users"
  on public.app_users for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own app users" on public.app_users;
create policy "Users can update own app users"
  on public.app_users for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own app users" on public.app_users;
create policy "Users can delete own app users"
  on public.app_users for delete
  using (auth.uid() = user_id);

notify pgrst, 'reload schema';
