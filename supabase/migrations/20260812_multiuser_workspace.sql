-- Alsat multi-user workspace foundation.
-- Run this migration in the Supabase SQL editor after the base schema.

do $$ begin
  create type public.workspace_role as enum ('owner', 'sales_agent', 'warehouse', 'dispatcher');
exception when duplicate_object then null;
end $$;

create table if not exists public.company_members (
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.workspace_role not null,
  full_name text,
  status text not null default 'active' check (status in ('invited', 'active', 'suspended')),
  created_at timestamptz not null default now(),
  primary key (company_id, user_id)
);

create index if not exists company_members_user_idx on public.company_members (user_id, status);
create index if not exists company_members_company_role_idx on public.company_members (company_id, role, status);

create or replace function public.is_company_member(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_members
    where company_id = target_company_id
      and user_id = auth.uid()
      and status = 'active'
  );
$$;

create or replace function public.has_company_role(target_company_id uuid, allowed_roles public.workspace_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_members
    where company_id = target_company_id
      and user_id = auth.uid()
      and status = 'active'
      and role = any(allowed_roles)
  );
$$;

alter table public.company_members enable row level security;
alter table public.companies enable row level security;
alter table public.products enable row level security;
alter table public.stores enable row level security;
alter table public.sales_agents enable row level security;
alter table public.company_agents enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists company_members_select_self on public.company_members;
create policy company_members_select_self on public.company_members
  for select using (user_id = auth.uid() or public.has_company_role(company_id, array['owner']::public.workspace_role[]));

drop policy if exists company_members_owner_manage on public.company_members;
create policy company_members_owner_manage on public.company_members
  for all using (
    public.has_company_role(company_id, array['owner']::public.workspace_role[])
    or exists (
      select 1 from public.companies c
      where c.id = company_members.company_id and c.owner_id = auth.uid()
    )
  )
  with check (
    public.has_company_role(company_id, array['owner']::public.workspace_role[])
    or exists (
      select 1 from public.companies c
      where c.id = company_members.company_id and c.owner_id = auth.uid()
    )
  );

drop policy if exists companies_member_select on public.companies;
create policy companies_member_select on public.companies
  for select using (owner_id = auth.uid() or public.is_company_member(id));

drop policy if exists companies_owner_insert on public.companies;
create policy companies_owner_insert on public.companies
  for insert with check (owner_id = auth.uid());

drop policy if exists companies_owner_update on public.companies;
create policy companies_owner_update on public.companies
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists products_member_access on public.products;
drop policy if exists products_member_select on public.products;
drop policy if exists products_owner_write on public.products;
create policy products_member_select on public.products
  for select using (public.is_company_member(company_id));
create policy products_owner_write on public.products
  for all using (public.has_company_role(company_id, array['owner']::public.workspace_role[]))
  with check (public.has_company_role(company_id, array['owner']::public.workspace_role[]));

drop policy if exists stores_member_access on public.stores;
drop policy if exists stores_member_select on public.stores;
drop policy if exists stores_owner_write on public.stores;
create policy stores_member_select on public.stores
  for select using (public.is_company_member(company_id));
create policy stores_owner_write on public.stores
  for all using (public.has_company_role(company_id, array['owner']::public.workspace_role[]))
  with check (public.has_company_role(company_id, array['owner']::public.workspace_role[]));

drop policy if exists sales_agents_member_select on public.sales_agents;
create policy sales_agents_member_select on public.sales_agents
  for select using (
    user_id = auth.uid() or exists (
      select 1 from public.company_agents ca
      where ca.agent_id = sales_agents.id
        and public.is_company_member(ca.company_id)
    )
  );

drop policy if exists company_agents_member_select on public.company_agents;
drop policy if exists company_agents_owner_write on public.company_agents;
create policy company_agents_member_select on public.company_agents
  for select using (public.is_company_member(company_id));
create policy company_agents_owner_write on public.company_agents
  for all using (public.has_company_role(company_id, array['owner']::public.workspace_role[]))
  with check (public.has_company_role(company_id, array['owner']::public.workspace_role[]));

drop policy if exists orders_member_access on public.orders;
drop policy if exists orders_member_select on public.orders;
drop policy if exists orders_create on public.orders;
drop policy if exists orders_operational_update on public.orders;
drop policy if exists orders_owner_delete on public.orders;
create policy orders_member_select on public.orders
  for select using (public.is_company_member(company_id));
create policy orders_create on public.orders
  for insert with check (public.has_company_role(company_id, array['owner','sales_agent']::public.workspace_role[]));
create policy orders_operational_update on public.orders
  for update using (public.has_company_role(company_id, array['owner','warehouse','dispatcher']::public.workspace_role[]))
  with check (public.has_company_role(company_id, array['owner','warehouse','dispatcher']::public.workspace_role[]));
create policy orders_owner_delete on public.orders
  for delete using (public.has_company_role(company_id, array['owner']::public.workspace_role[]));

drop policy if exists order_items_member_access on public.order_items;
drop policy if exists order_items_member_select on public.order_items;
drop policy if exists order_items_create on public.order_items;
drop policy if exists order_items_operational_update on public.order_items;
create policy order_items_member_select on public.order_items
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and public.is_company_member(o.company_id)
    )
  );
create policy order_items_create on public.order_items
  for insert with check (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and public.has_company_role(o.company_id, array['owner','sales_agent']::public.workspace_role[])
    )
  );
create policy order_items_operational_update on public.order_items
  for update using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and public.has_company_role(o.company_id, array['owner','warehouse']::public.workspace_role[])
    )
  ) with check (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and public.has_company_role(o.company_id, array['owner','warehouse']::public.workspace_role[])
    )
  );
