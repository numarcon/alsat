-- Delivery proof: recipient signature, optional photo and payment confirmation.
alter table public.orders add column if not exists delivered_at timestamptz;
alter table public.orders add column if not exists delivered_by uuid references auth.users(id);
alter table public.orders add column if not exists delivery_payment_method text;
alter table public.orders add column if not exists delivery_payment_amount numeric(12,2);
alter table public.orders add column if not exists delivery_recipient_name text;
alter table public.orders add column if not exists delivery_signature_path text;
alter table public.orders add column if not exists delivery_photo_path text;
alter table public.orders add column if not exists delivery_note text;

do $$ begin
  alter table public.orders add constraint orders_delivery_payment_method_check
    check (delivery_payment_method is null or delivery_payment_method in ('cash', 'transfer', 'credit'));
exception when duplicate_object then null;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('delivery-proofs', 'delivery-proofs', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists delivery_proofs_member_select on storage.objects;
create policy delivery_proofs_member_select on storage.objects
  for select using (
    bucket_id = 'delivery-proofs'
    and public.is_company_member((storage.foldername(name))[1]::uuid)
  );

drop policy if exists delivery_proofs_dispatcher_insert on storage.objects;
create policy delivery_proofs_dispatcher_insert on storage.objects
  for insert with check (
    bucket_id = 'delivery-proofs'
    and public.has_company_role((storage.foldername(name))[1]::uuid, array['owner','dispatcher']::public.workspace_role[])
  );

drop policy if exists delivery_proofs_dispatcher_delete on storage.objects;
create policy delivery_proofs_dispatcher_delete on storage.objects
  for delete using (
    bucket_id = 'delivery-proofs'
    and public.has_company_role((storage.foldername(name))[1]::uuid, array['owner','dispatcher']::public.workspace_role[])
  );

