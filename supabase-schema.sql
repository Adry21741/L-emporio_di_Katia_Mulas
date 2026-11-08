create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cat text not null,
  type text not null,
  price numeric(10, 2) not null check (price >= 0),
  color text not null,
  color_name text not null default '—',
  sizes text[] not null default '{}',
  description text not null default '',
  is_new boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Dopo la registrazione dal sito, recupera l'UUID dell'utente da Authentication > Users
-- e inseriscilo qui per abilitare la gestione del negozio:
-- insert into public.admin_users (user_id) values ('UUID-UTENTE');

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_number text not null unique,
  customer_name text not null,
  customer_email text not null,
  total numeric(10, 2) not null check (total >= 0),
  promo boolean not null default false,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.products enable row level security;
alter table public.admin_users enable row level security;
alter table public.orders enable row level security;

create or replace function public.is_store_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users
    where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_store_admin() from public;
grant execute on function public.is_store_admin() to authenticated;

drop policy if exists products_public_read on public.products;
create policy products_public_read on public.products
  for select to anon, authenticated using (true);

drop policy if exists products_admin_manage on public.products;
create policy products_admin_manage on public.products
  for all to authenticated
  using (public.is_store_admin())
  with check (public.is_store_admin());

drop policy if exists admins_read_own_membership on public.admin_users;
create policy admins_read_own_membership on public.admin_users
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists orders_read_own_or_admin on public.orders;
create policy orders_read_own_or_admin on public.orders
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_store_admin());

drop policy if exists orders_create_own on public.orders;
create policy orders_create_own on public.orders
  for insert to authenticated
  with check (user_id = (select auth.uid()));

grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;
grant select on public.admin_users to authenticated;
grant select, insert on public.orders to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'products'
  ) then
    alter publication supabase_realtime add table public.products;
  end if;
end;
$$;