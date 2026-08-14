-- Alsat Workspace Architecture v1: non-destructive upgrade of the existing live foundation.
-- This migration preserves companies, members, products, orders, order items and platform admins.

begin;

-- Fail before changing anything when legacy and v1 names coexist unexpectedly.
do $$
begin
  if to_regclass('public.company_members') is not null and to_regclass('public.company_users') is not null then
    raise exception 'Both company_members and company_users exist; manual merge required';
  end if;
  if to_regclass('public.company_agents') is not null and to_regclass('public.company_sales_agents') is not null then
    raise exception 'Both company_agents and company_sales_agents exist; manual merge required';
  end if;
  if to_regclass('public.stores') is not null and to_regclass('public.customers') is not null then
    raise exception 'Both stores and customers exist; manual merge required';
  end if;
  if exists (
    select 1 from public.company_members
    where role::text not in ('owner', 'warehouse', 'dispatcher')
  ) then
    raise exception 'Legacy company_members contains a sales_agent or unknown role; migrate it to an independent sales agent first';
  end if;
  if exists (
    select 1
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    join public.products p on p.id = oi.product_id
    where o.company_id is distinct from p.company_id
  ) then
    raise exception 'Cross-company order item detected; migration stopped without changes';
  end if;
end $$;

do $$ begin
  create type public.company_role as enum ('owner','admin','manager','warehouse','forwarder');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.member_status as enum ('invited','active','disabled');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.relationship_status as enum ('pending','approved','rejected','suspended');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.payment_status as enum ('unpaid','partial','paid','refunded');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.commission_status as enum ('pending','earned','paid','void');
exception when duplicate_object then null; end $$;

-- Rename the legacy tables and fields to the approved Architecture v1 language.
do $$ begin
  if to_regclass('public.company_members') is not null and to_regclass('public.company_users') is null then
    alter table public.company_members rename to company_users;
  end if;
  if to_regclass('public.company_agents') is not null and to_regclass('public.company_sales_agents') is null then
    alter table public.company_agents rename to company_sales_agents;
  end if;
  if to_regclass('public.stores') is not null and to_regclass('public.customers') is null then
    alter table public.stores rename to customers;
  end if;
end $$;

do $$ begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='company_sales_agents' and column_name='agent_id')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='company_sales_agents' and column_name='sales_agent_id') then
    alter table public.company_sales_agents rename column agent_id to sales_agent_id;
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='products' and column_name='agent_visible')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='products' and column_name='sales_agent_visible') then
    alter table public.products rename column agent_visible to sales_agent_visible;
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='orders' and column_name='store_id')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='orders' and column_name='customer_id') then
    alter table public.orders rename column store_id to customer_id;
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='orders' and column_name='agent_id')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='orders' and column_name='sales_agent_id') then
    alter table public.orders rename column agent_id to sales_agent_id;
  end if;
end $$;

-- Policies/functions depend on legacy role and status types. They are replaced later
-- in this same transaction; any later failure rolls this removal back automatically.
do $$
declare r record;
begin
  for r in select schemaname,tablename,policyname from pg_policies
           where schemaname='public' and tablename in
           ('companies','company_users','sales_agents','company_sales_agents','products','customers','warehouses','forwarders','orders','order_items','commissions')
  loop
    execute format('drop policy %I on %I.%I',r.policyname,r.schemaname,r.tablename);
  end loop;
end $$;
-- Keep the legacy workspace_role overload because Storage policies depend on its
-- exact signature. It is replaced with a compatibility implementation below.
alter table public.company_users drop constraint if exists company_members_status_check;

-- Convert membership roles/statuses while preserving legacy values.
do $$
declare role_type text; status_type text;
begin
  select udt_name into role_type from information_schema.columns
  where table_schema='public' and table_name='company_users' and column_name='role';
  if role_type is distinct from 'company_role' then
    alter table public.company_users alter column role drop default;
    alter table public.company_users alter column role type public.company_role
      using (case role::text when 'dispatcher' then 'forwarder' else role::text end)::public.company_role;
  end if;

  select udt_name into status_type from information_schema.columns
  where table_schema='public' and table_name='company_users' and column_name='status';
  if status_type is distinct from 'member_status' then
    alter table public.company_users alter column status drop default;
    alter table public.company_users alter column status type public.member_status
      using (case status::text when 'suspended' then 'disabled' else status::text end)::public.member_status;
    alter table public.company_users alter column status set default 'active'::public.member_status;
  end if;
end $$;

-- Company identity additions. Existing owner data is retained.
alter table public.companies add column if not exists slug text;
alter table public.companies add column if not exists created_by uuid references auth.users(id);
update public.companies c
set created_by = coalesce(
  c.created_by,
  c.owner_id,
  (select cu.user_id from public.company_users cu
   where cu.company_id=c.id and cu.role='owner'::public.company_role limit 1)
)
where c.created_by is null;
update public.companies
set slug = 'company-' || left(replace(id::text,'-',''),12)
where slug is null or slug = '';
do $$ begin
  if exists(select 1 from public.companies where created_by is null) then
    raise exception 'A company has no owner/creator; migration stopped without changes';
  end if;
  alter table public.companies alter column created_by set not null;
  alter table public.companies alter column slug set not null;
exception when duplicate_object then null; end $$;
create unique index if not exists companies_slug_key on public.companies(slug);
do $$ begin
  if not exists(select 1 from pg_constraint where conname='companies_slug_format_check') then
    alter table public.companies add constraint companies_slug_format_check check(slug ~ '^[a-z0-9-]+$');
  end if;
end $$;

-- Independent sales agents and their per-company approval relationship.
do $$
declare status_type text;
begin
  select udt_name into status_type from information_schema.columns
  where table_schema='public' and table_name='company_sales_agents' and column_name='status';
  if status_type is distinct from 'relationship_status' then
    alter table public.company_sales_agents alter column status drop default;
    alter table public.company_sales_agents alter column status type public.relationship_status
      using status::text::public.relationship_status;
    alter table public.company_sales_agents alter column status set default 'pending'::public.relationship_status;
  end if;
end $$;
alter table public.company_sales_agents add column if not exists commission_rate numeric(5,2) not null default 0 check(commission_rate between 0 and 100);
alter table public.company_sales_agents add column if not exists approved_by uuid references auth.users(id);
alter table public.company_sales_agents add column if not exists approved_at timestamptz;
alter table public.company_sales_agents add column if not exists created_at timestamptz not null default now();

do $$ begin
  if exists(select 1 from public.sales_agents where user_id is null) then
    raise exception 'A legacy sales agent has no auth user; migration stopped without changes';
  end if;
  alter table public.sales_agents alter column user_id set not null;
exception when others then
  if sqlstate <> '23502' then raise; end if;
end $$;
create unique index if not exists sales_agents_user_id_key on public.sales_agents(user_id);

-- Product compatibility and tenant-safe composite keys.
alter table public.products add column if not exists description text;
alter table public.products add column if not exists updated_at timestamptz not null default now();
create unique index if not exists products_company_id_id_key on public.products(company_id,id);
create unique index if not exists products_company_sku_key on public.products(company_id,sku) where sku is not null;

-- Store/customer entity remains company-owned; existing rows are preserved.
alter table public.customers add column if not exists created_by_agent_id uuid references public.sales_agents(id);
create unique index if not exists customers_company_id_id_key on public.customers(company_id,id);

create table if not exists public.warehouses(
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  address text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(company_id,id)
);
create table if not exists public.forwarders(
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid references auth.users(id),
  full_name text not null,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(company_id,id)
);

-- Extend orders without removing the existing warehouse/delivery audit fields.
alter table public.orders add column if not exists warehouse_id uuid;
alter table public.orders add column if not exists forwarder_id uuid;
alter table public.orders add column if not exists payment_status public.payment_status not null default 'unpaid';
alter table public.orders add column if not exists paid_at timestamptz;
alter table public.orders add column if not exists updated_at timestamptz not null default now();
create unique index if not exists orders_company_id_id_key on public.orders(company_id,id);

-- Order items inherit their order tenant, then gain cross-tenant foreign keys.
alter table public.order_items add column if not exists company_id uuid;
update public.order_items oi set company_id=o.company_id
from public.orders o where o.id=oi.order_id and oi.company_id is null;
alter table public.order_items add column if not exists line_total numeric generated always as (quantity * unit_price) stored;

-- Preserve operational access to legacy non-marketplace orders that predate the
-- required customer relationship. One company-owned placeholder is created per
-- affected tenant; order totals, statuses and delivery history are unchanged.
insert into public.customers(company_id,name,address)
select distinct o.company_id,'Imported legacy customer','Automatically linked during Architecture v1 migration'
from public.orders o
where o.company_id is not null
  and o.customer_id is null
  and o.source <> 'marketplace'
  and not exists(
    select 1 from public.customers c
    where c.company_id=o.company_id and c.name='Imported legacy customer'
  );
update public.orders o
set customer_id=(
  select c.id from public.customers c
  where c.company_id=o.company_id and c.name='Imported legacy customer'
  order by c.created_at,c.id limit 1
)
where o.company_id is not null
  and o.customer_id is null
  and o.source <> 'marketplace';

do $$
begin
  if exists(select 1 from public.order_items where company_id is null) then
    raise exception 'An order item has no company; migration stopped without changes';
  end if;
  alter table public.order_items alter column company_id set not null;

  if not exists(select 1 from pg_constraint where conname='orders_company_customer_fkey') then
    alter table public.orders add constraint orders_company_customer_fkey
      foreign key(company_id,customer_id) references public.customers(company_id,id) not valid;
    alter table public.orders validate constraint orders_company_customer_fkey;
  end if;
  if not exists(select 1 from pg_constraint where conname='orders_company_warehouse_fkey') then
    alter table public.orders add constraint orders_company_warehouse_fkey
      foreign key(company_id,warehouse_id) references public.warehouses(company_id,id) not valid;
    alter table public.orders validate constraint orders_company_warehouse_fkey;
  end if;
  if not exists(select 1 from pg_constraint where conname='orders_company_forwarder_fkey') then
    alter table public.orders add constraint orders_company_forwarder_fkey
      foreign key(company_id,forwarder_id) references public.forwarders(company_id,id) not valid;
    alter table public.orders validate constraint orders_company_forwarder_fkey;
  end if;
  if not exists(select 1 from pg_constraint where conname='orders_company_agent_fkey') then
    alter table public.orders add constraint orders_company_agent_fkey
      foreign key(company_id,sales_agent_id) references public.company_sales_agents(company_id,sales_agent_id) not valid;
    alter table public.orders validate constraint orders_company_agent_fkey;
  end if;
  if not exists(select 1 from pg_constraint where conname='order_items_company_order_fkey') then
    alter table public.order_items add constraint order_items_company_order_fkey
      foreign key(company_id,order_id) references public.orders(company_id,id) not valid;
    alter table public.order_items validate constraint order_items_company_order_fkey;
  end if;
  if not exists(select 1 from pg_constraint where conname='order_items_company_product_fkey') then
    alter table public.order_items add constraint order_items_company_product_fkey
      foreign key(company_id,product_id) references public.products(company_id,id) not valid;
    alter table public.order_items validate constraint order_items_company_product_fkey;
  end if;
end $$;

-- New records must always respect the company/customer/order ownership boundary.
do $$ begin
  if not exists(select 1 from pg_constraint where conname='orders_company_required') then
    alter table public.orders add constraint orders_company_required check(company_id is not null) not valid;
  end if;
  if not exists(select 1 from pg_constraint where conname='orders_customer_required_for_workspace') then
    alter table public.orders add constraint orders_customer_required_for_workspace
      check(source='marketplace' or customer_id is not null);
  end if;
  if not exists(select 1 from pg_constraint where conname='order_items_order_required') then
    alter table public.order_items add constraint order_items_order_required check(order_id is not null) not valid;
  end if;
  if not exists(select 1 from pg_constraint where conname='order_items_product_required') then
    alter table public.order_items add constraint order_items_product_required check(product_id is not null) not valid;
  end if;
end $$;

create table if not exists public.commissions(
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  order_id uuid not null unique references public.orders(id),
  sales_agent_id uuid not null references public.sales_agents(id),
  rate numeric(5,2) not null check(rate between 0 and 100),
  amount numeric(14,2) not null check(amount>=0),
  status public.commission_status not null default 'earned',
  earned_at timestamptz not null default now(),
  paid_at timestamptz,
  unique(company_id,id)
);

-- Replace legacy policies atomically, after every table/constraint is ready.
do $$
declare r record;
begin
  for r in select schemaname,tablename,policyname from pg_policies
           where schemaname='public' and tablename in
           ('companies','company_users','sales_agents','company_sales_agents','products','customers','warehouses','forwarders','orders','order_items','commissions')
  loop
    execute format('drop policy %I on %I.%I',r.policyname,r.schemaname,r.tablename);
  end loop;
end $$;

create or replace function public.is_company_member(target_company_id uuid)
returns boolean language sql stable security definer set search_path=public
as $$select exists(select 1 from company_users where company_id=target_company_id and user_id=auth.uid() and status='active')$$;

create or replace function public.has_company_role(p_company uuid,p_roles public.company_role[])
returns boolean language sql stable security definer set search_path=public
as $$select exists(select 1 from company_users where company_id=p_company and user_id=auth.uid() and status='active' and role=any(p_roles))$$;

-- Compatibility overload for existing Storage policies. Legacy dispatcher maps
-- to the approved Architecture v1 forwarder role; sales_agent is independent and
-- therefore never matches a company employee role.
create or replace function public.has_company_role(
  target_company_id uuid,
  allowed_roles public.workspace_role[]
)
returns boolean language sql stable security definer set search_path=public
as $$
  select exists (
    select 1
    from public.company_users cu
    where cu.company_id = target_company_id
      and cu.user_id = auth.uid()
      and cu.status = 'active'
      and cu.role::text = any (
        array(
          select case legacy_role::text
            when 'dispatcher' then 'forwarder'
            when 'sales_agent' then '__independent_sales_agent__'
            else legacy_role::text
          end
          from unnest(allowed_roles) as legacy_role
        )
      )
  );
$$;

create or replace function public.current_sales_agent_id()
returns uuid language sql stable security definer set search_path=public
as $$select id from sales_agents where user_id=auth.uid()$$;

create or replace function public.is_approved_agent(p_company uuid)
returns boolean language sql stable security definer set search_path=public
as $$select exists(select 1 from company_sales_agents where company_id=p_company and sales_agent_id=current_sales_agent_id() and status='approved')$$;

create or replace function public.create_company(name text,slug text)
returns uuid language plpgsql security definer set search_path=public
as $$declare cid uuid; begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  insert into companies(name,slug,owner_id,created_by) values($1,$2,auth.uid(),auth.uid()) returning id into cid;
  insert into company_users(company_id,user_id,role,status) values(cid,auth.uid(),'owner','active');
  return cid;
end$$;
revoke all on function public.create_company(text,text) from public;
grant execute on function public.create_company(text,text) to authenticated;

create or replace function public.validate_order_agent()
returns trigger language plpgsql set search_path=public
as $$begin
  if new.sales_agent_id is not null and not exists(
    select 1 from company_sales_agents where company_id=new.company_id
    and sales_agent_id=new.sales_agent_id and status='approved'
  ) then raise exception 'sales agent is not approved for this company'; end if;
  return new;
end$$;
drop trigger if exists validate_order_agent_before on public.orders;
create trigger validate_order_agent_before before insert or update of company_id,sales_agent_id
on public.orders for each row execute function public.validate_order_agent();

create or replace function public.recalculate_order_total()
returns trigger language plpgsql set search_path=public
as $$declare target_order uuid; begin
  if tg_op='UPDATE' and old.order_id is distinct from new.order_id then
    update orders set total=(select coalesce(sum(line_total),0) from order_items where order_id=old.order_id),updated_at=now()
    where id=old.order_id;
  end if;
  target_order := case when tg_op='DELETE' then old.order_id else new.order_id end;
  update orders set total=(select coalesce(sum(line_total),0) from order_items where order_id=target_order),updated_at=now()
  where id=target_order;
  return null;
end$$;
drop trigger if exists order_total_after_item on public.order_items;
create trigger order_total_after_item after insert or update or delete on public.order_items
for each row execute function public.recalculate_order_total();

create or replace function public.earn_commission()
returns trigger language plpgsql security definer set search_path=public
as $$declare r numeric(5,2); begin
  if new.status='delivered' and new.payment_status='paid' and new.sales_agent_id is not null then
    select commission_rate into r from company_sales_agents where company_id=new.company_id
      and sales_agent_id=new.sales_agent_id and status='approved';
    if r is not null then
      insert into commissions(company_id,order_id,sales_agent_id,rate,amount)
      values(new.company_id,new.id,new.sales_agent_id,r,round(new.total*r/100,2))
      on conflict(order_id) do update set rate=excluded.rate,amount=excluded.amount,status='earned',earned_at=now();
    end if;
  end if;
  return new;
end$$;
drop trigger if exists earn_commission_after on public.orders;
create trigger earn_commission_after after insert or update of status,payment_status,total on public.orders
for each row execute function public.earn_commission();

alter table public.companies enable row level security;
alter table public.company_users enable row level security;
alter table public.sales_agents enable row level security;
alter table public.company_sales_agents enable row level security;
alter table public.products enable row level security;
alter table public.customers enable row level security;
alter table public.warehouses enable row level security;
alter table public.forwarders enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.commissions enable row level security;

create policy companies_read on public.companies for select using(is_company_member(id) or is_approved_agent(id) or is_platform_admin());
create policy companies_admin_update on public.companies for update using(has_company_role(id,array['owner','admin']::public.company_role[])) with check(has_company_role(id,array['owner','admin']::public.company_role[]));
create policy company_users_read on public.company_users for select using(user_id=auth.uid() or is_company_member(company_id) or is_platform_admin());
create policy company_users_admin_manage on public.company_users for all using(has_company_role(company_id,array['owner','admin']::public.company_role[])) with check(has_company_role(company_id,array['owner','admin']::public.company_role[]));
create policy sales_agents_self on public.sales_agents for all using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy sales_agents_company_read on public.sales_agents for select using(is_platform_admin() or exists(select 1 from company_sales_agents csa where csa.sales_agent_id=id and is_company_member(csa.company_id)));
create policy relationships_read on public.company_sales_agents for select using(is_platform_admin() or is_company_member(company_id) or sales_agent_id=current_sales_agent_id());
create policy relationships_agent_request on public.company_sales_agents for insert with check(sales_agent_id=current_sales_agent_id() and status='pending');
create policy relationships_admin_manage on public.company_sales_agents for all using(has_company_role(company_id,array['owner','admin','manager']::public.company_role[])) with check(has_company_role(company_id,array['owner','admin','manager']::public.company_role[]));
create policy products_company_read on public.products for select using(is_company_member(company_id) or is_platform_admin());
create policy products_company_manage on public.products for all using(has_company_role(company_id,array['owner','admin','manager']::public.company_role[])) with check(has_company_role(company_id,array['owner','admin','manager']::public.company_role[]));
create policy products_agent_read on public.products for select using(workspace_active and sales_agent_visible and is_approved_agent(company_id));
create policy customers_company_read on public.customers for select using(is_company_member(company_id) or is_platform_admin());
create policy customers_company_manage on public.customers for all using(has_company_role(company_id,array['owner','admin','manager']::public.company_role[])) with check(has_company_role(company_id,array['owner','admin','manager']::public.company_role[]));
create policy customers_agent_manage on public.customers for all using(is_approved_agent(company_id) and created_by_agent_id=current_sales_agent_id()) with check(is_approved_agent(company_id) and created_by_agent_id=current_sales_agent_id());
create policy warehouses_company_read on public.warehouses for select using(is_company_member(company_id) or is_platform_admin());
create policy warehouses_company_manage on public.warehouses for all using(has_company_role(company_id,array['owner','admin','manager','warehouse']::public.company_role[])) with check(has_company_role(company_id,array['owner','admin','manager','warehouse']::public.company_role[]));
create policy forwarders_company_read on public.forwarders for select using(is_company_member(company_id) or is_platform_admin());
create policy forwarders_company_manage on public.forwarders for all using(has_company_role(company_id,array['owner','admin','manager']::public.company_role[])) with check(has_company_role(company_id,array['owner','admin','manager']::public.company_role[]));
create policy orders_company_read on public.orders for select using(is_company_member(company_id) or is_platform_admin());
create policy orders_company_insert on public.orders for insert with check(has_company_role(company_id,array['owner','admin','manager']::public.company_role[]));
create policy orders_company_update on public.orders for update using(has_company_role(company_id,array['owner','admin','manager','warehouse','forwarder']::public.company_role[])) with check(has_company_role(company_id,array['owner','admin','manager','warehouse','forwarder']::public.company_role[]));
create policy orders_company_delete on public.orders for delete using(has_company_role(company_id,array['owner','admin']::public.company_role[]));
create policy orders_agent_read on public.orders for select using(is_approved_agent(company_id) and sales_agent_id=current_sales_agent_id());
create policy orders_agent_insert on public.orders for insert with check(is_approved_agent(company_id) and sales_agent_id=current_sales_agent_id() and status in('draft','submitted'));
create policy orders_agent_update on public.orders for update using(is_approved_agent(company_id) and sales_agent_id=current_sales_agent_id() and status in('draft','submitted')) with check(is_approved_agent(company_id) and sales_agent_id=current_sales_agent_id() and status in('draft','submitted'));
create policy items_company_read on public.order_items for select using(is_company_member(company_id) or is_platform_admin());
create policy items_company_manage on public.order_items for all using(has_company_role(company_id,array['owner','admin','manager','warehouse']::public.company_role[])) with check(has_company_role(company_id,array['owner','admin','manager','warehouse']::public.company_role[]));
create policy items_agent_read on public.order_items for select using(is_approved_agent(company_id) and exists(select 1 from orders o where o.id=order_id and o.sales_agent_id=current_sales_agent_id()));
create policy items_agent_insert on public.order_items for insert with check(is_approved_agent(company_id) and exists(select 1 from orders o where o.id=order_id and o.sales_agent_id=current_sales_agent_id() and o.status='draft'));
create policy commissions_company_read on public.commissions for select using(is_company_member(company_id) or is_platform_admin());
create policy commissions_agent_read on public.commissions for select using(sales_agent_id=current_sales_agent_id());

create index if not exists company_users_user_idx on public.company_users(user_id);
create index if not exists products_company_idx on public.products(company_id);
create index if not exists orders_company_idx on public.orders(company_id);
create index if not exists orders_agent_idx on public.orders(sales_agent_id);
create index if not exists relationships_agent_idx on public.company_sales_agents(sales_agent_id);

grant select,insert,update,delete on public.companies,public.company_users,public.sales_agents,
  public.company_sales_agents,public.products,public.customers,public.warehouses,public.forwarders,
  public.orders,public.order_items,public.commissions to authenticated;

commit;

select
  'architecture_v1_upgrade_complete' as status,
  (select count(*) from public.companies) as companies_preserved,
  (select count(*) from public.company_users) as company_users_preserved,
  (select count(*) from public.products) as products_preserved,
  (select count(*) from public.orders) as orders_preserved,
  (select count(*) from public.order_items) as order_items_preserved;
