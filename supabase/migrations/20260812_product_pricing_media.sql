-- Product pricing and image storage for the Alsat Workspace catalog.

alter table public.products add column if not exists purchase_price numeric(12,2) not null default 0;
alter table public.products add column if not exists sale_price numeric(12,2) not null default 0;
alter table public.products add column if not exists wholesale_price numeric(12,2) not null default 0;
alter table public.products add column if not exists image_url text;

update public.products
set sale_price = price
where sale_price = 0 and price > 0;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists product_images_member_insert on storage.objects;
create policy product_images_member_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and public.has_company_role((storage.foldername(name))[1]::uuid, array['owner','sales_agent']::public.workspace_role[])
  );

drop policy if exists product_images_member_delete on storage.objects;
create policy product_images_member_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'product-images'
    and public.has_company_role((storage.foldername(name))[1]::uuid, array['owner']::public.workspace_role[])
  );
