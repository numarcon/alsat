-- Allow a sales agent to create or edit stores they work with.
-- Run this migration after 20260812_multiuser_workspace.sql.

alter table public.stores add column if not exists latitude double precision;
alter table public.stores add column if not exists longitude double precision;
alter table public.stores add column if not exists route_order integer not null default 0;
alter table public.stores add column if not exists visit_status text not null default 'planned';

drop policy if exists stores_owner_write on public.stores;
drop policy if exists stores_sales_insert on public.stores;
drop policy if exists stores_sales_update on public.stores;
drop policy if exists stores_owner_delete on public.stores;

create policy stores_sales_insert on public.stores
  for insert
  with check (public.has_company_role(company_id, array['owner','sales_agent']::public.workspace_role[]));

create policy stores_sales_update on public.stores
  for update
  using (public.has_company_role(company_id, array['owner','sales_agent']::public.workspace_role[]))
  with check (public.has_company_role(company_id, array['owner','sales_agent']::public.workspace_role[]));

create policy stores_owner_delete on public.stores
  for delete
  using (public.has_company_role(company_id, array['owner']::public.workspace_role[]));
