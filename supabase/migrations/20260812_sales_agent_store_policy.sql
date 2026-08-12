-- Allow a sales agent to create or edit stores they work with.
-- Run this migration after 20260812_multiuser_workspace.sql.

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
