-- Alsat platform-wide admin access.
-- Run once in Supabase SQL Editor after the existing workspace migrations.

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.platform_admins
    where user_id = auth.uid()
  );
$$;

revoke all on function public.is_platform_admin() from public;
grant execute on function public.is_platform_admin() to authenticated;
grant select on public.platform_admins to authenticated;

drop policy if exists platform_admins_self_select on public.platform_admins;
create policy platform_admins_self_select on public.platform_admins
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists platform_admin_companies_select on public.companies;
create policy platform_admin_companies_select on public.companies
  for select to authenticated using (public.is_platform_admin());

drop policy if exists platform_admin_members_select on public.company_members;
create policy platform_admin_members_select on public.company_members
  for select to authenticated using (public.is_platform_admin());

drop policy if exists platform_admin_products_select on public.products;
create policy platform_admin_products_select on public.products
  for select to authenticated using (public.is_platform_admin());

drop policy if exists platform_admin_stores_select on public.stores;
create policy platform_admin_stores_select on public.stores
  for select to authenticated using (public.is_platform_admin());

drop policy if exists platform_admin_sales_agents_select on public.sales_agents;
create policy platform_admin_sales_agents_select on public.sales_agents
  for select to authenticated using (public.is_platform_admin());

drop policy if exists platform_admin_company_agents_select on public.company_agents;
create policy platform_admin_company_agents_select on public.company_agents
  for select to authenticated using (public.is_platform_admin());

drop policy if exists platform_admin_orders_select on public.orders;
create policy platform_admin_orders_select on public.orders
  for select to authenticated using (public.is_platform_admin());

drop policy if exists platform_admin_order_items_select on public.order_items;
create policy platform_admin_order_items_select on public.order_items
  for select to authenticated using (public.is_platform_admin());

-- Bootstrap the existing Alsat owner account as the first platform admin.
insert into public.platform_admins (user_id, full_name)
select id, coalesce(raw_user_meta_data ->> 'full_name', 'Нұрлан')
from auth.users
where lower(email) = 'nurlanqyzy2@gmail.com'
on conflict (user_id) do update set full_name = excluded.full_name;
