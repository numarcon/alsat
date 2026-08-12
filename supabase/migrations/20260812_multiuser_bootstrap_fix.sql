-- Run this once if 20260812_multiuser_workspace.sql was already executed.
-- It allows a newly-created company owner to create the first owner membership.

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
