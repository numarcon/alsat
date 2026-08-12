-- Alsat owner bootstrap/RLS fix.
-- Run after 20260812_multiuser_workspace.sql.

alter table public.company_members enable row level security;

-- Remove the recursive FOR ALL policy from the first version.
drop policy if exists company_members_owner_manage on public.company_members;
drop policy if exists company_members_select_self on public.company_members;
drop policy if exists company_members_bootstrap_owner on public.company_members;
drop policy if exists company_members_owner_update on public.company_members;
drop policy if exists company_members_owner_delete on public.company_members;

-- A member can see their own membership; the company owner can see all members.
create policy company_members_select_self on public.company_members
  for select using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.companies c
      where c.id = company_members.company_id
        and c.owner_id = auth.uid()
    )
  );

-- This is the only policy needed to create the first membership after company creation.
create policy company_members_bootstrap_owner on public.company_members
  for insert with check (
    user_id = auth.uid()
    and role = 'owner'::public.workspace_role
    and status = 'active'
    and exists (
      select 1
      from public.companies c
      where c.id = company_members.company_id
        and c.owner_id = auth.uid()
    )
  );

create policy company_members_owner_update on public.company_members
  for update using (
    exists (
      select 1
      from public.companies c
      where c.id = company_members.company_id
        and c.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.companies c
      where c.id = company_members.company_id
        and c.owner_id = auth.uid()
    )
  );

create policy company_members_owner_delete on public.company_members
  for delete using (
    exists (
      select 1
      from public.companies c
      where c.id = company_members.company_id
        and c.owner_id = auth.uid()
    )
  );
