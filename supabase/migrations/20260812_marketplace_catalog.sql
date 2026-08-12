-- Alsat Marketplace catalog foundation.
-- Run this migration in Supabase SQL Editor before using the public catalog.

alter table public.products add column if not exists marketplace_title text;
alter table public.products add column if not exists marketplace_description text;
alter table public.products add column if not exists marketplace_category text not null default 'Электр тауарлары';
alter table public.products add column if not exists marketplace_image_url text;
alter table public.products add column if not exists marketplace_min_order integer not null default 1;
alter table public.products add column if not exists marketplace_updated_at timestamptz;

alter table public.products drop constraint if exists products_marketplace_min_order_check;
alter table public.products add constraint products_marketplace_min_order_check check (marketplace_min_order > 0);

create index if not exists products_marketplace_catalog_idx
  on public.products (marketplace_published, workspace_active, marketplace_category, created_at desc);

-- A product can be public only when the owner explicitly enabled both
-- Workspace availability and Marketplace publication.
drop policy if exists products_marketplace_public_select on public.products;
create policy products_marketplace_public_select on public.products
  for select to anon, authenticated
  using (workspace_active = true and marketplace_published = true);

-- Future checkout fields are added now so Marketplace orders can use the
-- existing warehouse/dispatcher pipeline without a second order table.
alter table public.orders add column if not exists source text not null default 'agent';
alter table public.orders add column if not exists buyer_user_id uuid references auth.users(id);
alter table public.orders add column if not exists marketplace_note text;

alter table public.orders drop constraint if exists orders_source_check;
alter table public.orders add constraint orders_source_check check (source in ('agent', 'marketplace', 'admin'));

create index if not exists orders_source_idx on public.orders (company_id, source, created_at desc);
