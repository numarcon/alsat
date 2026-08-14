-- Alsat Marketplace commerce core.
-- Keeps Architecture v1 seller tenancy intact while allowing authenticated B2B buyers
-- to place one multi-seller cart. The RPC splits it into one order per seller company.

begin;

create table if not exists public.marketplace_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  buyer_company_id uuid references public.companies(id) on delete set null,
  business_name text not null,
  bin text,
  contact_name text not null,
  phone text not null,
  email text,
  city text,
  default_address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketplace_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null default 'Негізгі мекенжай',
  city text not null,
  address text not null,
  contact_name text not null,
  phone text not null,
  latitude numeric(10,7),
  longitude numeric(10,7),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketplace_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

alter table public.customers add column if not exists marketplace_buyer_user_id uuid references auth.users(id) on delete set null;
create unique index if not exists customers_marketplace_buyer_key
  on public.customers(company_id, marketplace_buyer_user_id)
  where marketplace_buyer_user_id is not null;

alter table public.orders add column if not exists buyer_workspace_company_id uuid references public.companies(id) on delete set null;
alter table public.orders add column if not exists checkout_group_id uuid;
alter table public.orders add column if not exists buyer_snapshot jsonb not null default '{}'::jsonb;
alter table public.orders add column if not exists delivery_snapshot jsonb not null default '{}'::jsonb;
alter table public.orders add column if not exists payment_method text not null default 'invoice';
alter table public.orders add column if not exists seller_snapshot jsonb not null default '{}'::jsonb;

create index if not exists orders_buyer_user_idx on public.orders(buyer_user_id, created_at desc)
  where source='marketplace';
create index if not exists orders_checkout_group_idx on public.orders(checkout_group_id)
  where checkout_group_id is not null;

create table if not exists public.inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  order_id uuid not null,
  product_id uuid not null,
  buyer_user_id uuid not null references auth.users(id) on delete restrict,
  quantity integer not null check(quantity > 0),
  status text not null default 'reserved' check(status in ('reserved','committed','released')),
  created_at timestamptz not null default now(),
  committed_at timestamptz,
  released_at timestamptz,
  unique(order_id, product_id),
  foreign key(company_id, order_id) references public.orders(company_id, id) on delete cascade,
  foreign key(company_id, product_id) references public.products(company_id, id) on delete restrict
);

create index if not exists inventory_reservations_product_idx
  on public.inventory_reservations(product_id, status);
create index if not exists inventory_reservations_buyer_idx
  on public.inventory_reservations(buyer_user_id, created_at desc);

-- Public catalog exposes only marketplace-safe fields and subtracts active reservations.
-- The underlying products table keeps its company-only fields and RLS contract.
drop view if exists public.marketplace_catalog;
create view public.marketplace_catalog with (security_barrier=true) as
select
  p.id,
  p.company_id,
  c.name as seller_name,
  p.name,
  p.sku,
  p.price,
  greatest(p.stock - coalesce(r.reserved_quantity,0),0)::integer as stock,
  p.category,
  p.subcategory,
  p.brand,
  p.manufacturer,
  p.model,
  p.barcode,
  p.description,
  p.bullet_points,
  p.search_terms,
  p.country_of_origin,
  p.unit,
  p.currency,
  p.vat_rate,
  p.max_order,
  p.weight_kg,
  p.length_cm,
  p.width_cm,
  p.height_cm,
  p.package_quantity,
  p.shipping_class,
  p.warranty_months,
  p.condition,
  p.certification,
  p.has_variants,
  p.variant_options,
  p.attributes,
  p.image_urls,
  p.marketplace_title,
  p.marketplace_description,
  p.marketplace_category,
  p.marketplace_subcategory,
  p.marketplace_image_url,
  p.image_url,
  p.marketplace_min_order,
  p.marketplace_updated_at,
  p.created_at
from public.products p
join public.companies c on c.id=p.company_id
left join (
  select product_id, sum(quantity)::integer as reserved_quantity
  from public.inventory_reservations
  where status='reserved'
  group by product_id
) r on r.product_id=p.id
where p.workspace_active=true and p.marketplace_published=true;

revoke all on public.marketplace_catalog from public;
grant select on public.marketplace_catalog to anon, authenticated;

-- Anonymous users must never see purchase price, commission or internal inventory fields.
revoke select on public.products from anon;
drop policy if exists products_marketplace_public_select on public.products;

alter table public.marketplace_profiles enable row level security;
alter table public.marketplace_addresses enable row level security;
alter table public.marketplace_favorites enable row level security;
alter table public.inventory_reservations enable row level security;

drop policy if exists marketplace_profiles_self on public.marketplace_profiles;
create policy marketplace_profiles_self on public.marketplace_profiles
  for all to authenticated
  using(user_id=auth.uid() or public.is_platform_admin())
  with check(user_id=auth.uid() or public.is_platform_admin());

drop policy if exists marketplace_addresses_self on public.marketplace_addresses;
create policy marketplace_addresses_self on public.marketplace_addresses
  for all to authenticated
  using(user_id=auth.uid() or public.is_platform_admin())
  with check(user_id=auth.uid() or public.is_platform_admin());

drop policy if exists marketplace_favorites_self on public.marketplace_favorites;
create policy marketplace_favorites_self on public.marketplace_favorites
  for all to authenticated
  using(user_id=auth.uid() or public.is_platform_admin())
  with check(user_id=auth.uid() or public.is_platform_admin());

drop policy if exists inventory_reservations_company_read on public.inventory_reservations;
create policy inventory_reservations_company_read on public.inventory_reservations
  for select to authenticated
  using(public.is_company_member(company_id) or buyer_user_id=auth.uid() or public.is_platform_admin());

drop policy if exists orders_marketplace_buyer_read on public.orders;
create policy orders_marketplace_buyer_read on public.orders
  for select to authenticated
  using(source='marketplace' and buyer_user_id=auth.uid());

drop policy if exists items_marketplace_buyer_read on public.order_items;
create policy items_marketplace_buyer_read on public.order_items
  for select to authenticated
  using(exists(
    select 1 from public.orders o
    where o.id=order_id and o.source='marketplace' and o.buyer_user_id=auth.uid()
  ));

grant select,insert,update,delete on public.marketplace_profiles,public.marketplace_addresses,public.marketplace_favorites to authenticated;
grant select on public.inventory_reservations to authenticated;

create or replace function public.place_marketplace_order(
  p_profile jsonb,
  p_address jsonb,
  p_items jsonb,
  p_note text default null,
  p_payment_method text default 'invoice'
)
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_user uuid := auth.uid();
  v_checkout_group uuid := gen_random_uuid();
  v_buyer_company uuid;
  v_business_name text := nullif(trim(p_profile->>'business_name'),'');
  v_contact_name text := nullif(trim(p_profile->>'contact_name'),'');
  v_phone text := nullif(trim(p_profile->>'phone'),'');
  v_email text := nullif(trim(p_profile->>'email'),'');
  v_city text := nullif(trim(p_address->>'city'),'');
  v_address text := nullif(trim(p_address->>'address'),'');
  v_customer uuid;
  v_order uuid;
  v_seller record;
  v_order_ids jsonb := '[]'::jsonb;
  v_total numeric(14,2) := 0;
  v_item_count integer;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' then raise exception 'items must be an array'; end if;
  v_item_count := jsonb_array_length(p_items);
  if v_item_count < 1 or v_item_count > 100 then raise exception 'cart must contain 1 to 100 lines'; end if;
  if (select count(distinct x.product_id) from jsonb_to_recordset(p_items) as x(product_id uuid,quantity integer)) <> v_item_count then
    raise exception 'duplicate product lines are not allowed';
  end if;
  if v_business_name is null or v_contact_name is null or v_phone is null then
    raise exception 'business_name, contact_name and phone are required';
  end if;
  if v_city is null or v_address is null then raise exception 'city and address are required'; end if;
  if p_payment_method not in ('invoice','cashless') then raise exception 'unsupported or inactive payment method'; end if;

  if nullif(p_profile->>'buyer_company_id','') is not null then
    v_buyer_company := (p_profile->>'buyer_company_id')::uuid;
    if not exists(
      select 1 from public.company_users cu
      where cu.company_id=v_buyer_company and cu.user_id=v_user and cu.status='active'
    ) then raise exception 'buyer company access denied'; end if;
  end if;

  -- Lock every product before checking availability so simultaneous checkouts cannot oversell.
  perform p.id
  from public.products p
  join jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer) on x.product_id=p.id
  order by p.id
  for update;

  if exists(
    select 1
    from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer)
    left join public.products p on p.id=x.product_id
    left join lateral (
      select coalesce(sum(ir.quantity),0)::integer as reserved
      from public.inventory_reservations ir
      where ir.product_id=x.product_id and ir.status='reserved'
    ) r on true
    where p.id is null
      or p.workspace_active is distinct from true
      or p.marketplace_published is distinct from true
      or x.quantity is null
      or x.quantity < p.marketplace_min_order
      or (p.max_order is not null and x.quantity > p.max_order)
      or x.quantity > greatest(p.stock-r.reserved,0)
  ) then raise exception 'one or more cart lines are invalid or unavailable'; end if;

  insert into public.marketplace_profiles(
    user_id,buyer_company_id,business_name,bin,contact_name,phone,email,city,default_address,updated_at
  ) values(
    v_user,v_buyer_company,v_business_name,nullif(trim(p_profile->>'bin'),''),v_contact_name,v_phone,v_email,v_city,v_address,now()
  ) on conflict(user_id) do update set
    buyer_company_id=excluded.buyer_company_id,
    business_name=excluded.business_name,
    bin=excluded.bin,
    contact_name=excluded.contact_name,
    phone=excluded.phone,
    email=excluded.email,
    city=excluded.city,
    default_address=excluded.default_address,
    updated_at=now();

  if coalesce((p_address->>'save')::boolean,true) then
    update public.marketplace_addresses set is_default=false,updated_at=now()
    where user_id=v_user and is_default=true;
    insert into public.marketplace_addresses(user_id,label,city,address,contact_name,phone,latitude,longitude,is_default)
    values(
      v_user,coalesce(nullif(trim(p_address->>'label'),''),'Негізгі мекенжай'),v_city,v_address,v_contact_name,v_phone,
      nullif(p_address->>'latitude','')::numeric,nullif(p_address->>'longitude','')::numeric,true
    );
  end if;

  for v_seller in
    select p.company_id, round(sum(p.price*x.quantity),2) as seller_total
    from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer)
    join public.products p on p.id=x.product_id
    group by p.company_id
    order by p.company_id
  loop
    insert into public.customers(company_id,name,address,contact_name,phone,marketplace_buyer_user_id)
    values(v_seller.company_id,v_business_name,v_city||', '||v_address,v_contact_name,v_phone,v_user)
    on conflict(company_id,marketplace_buyer_user_id) where marketplace_buyer_user_id is not null
    do update set name=excluded.name,address=excluded.address,contact_name=excluded.contact_name,phone=excluded.phone
    returning id into v_customer;

    insert into public.orders(
      company_id,customer_id,status,warehouse_status,total,source,buyer_user_id,buyer_workspace_company_id,
      checkout_group_id,buyer_snapshot,delivery_snapshot,payment_method,seller_snapshot,marketplace_note
    ) values(
      v_seller.company_id,v_customer,'new','new',0,'marketplace',v_user,v_buyer_company,
      v_checkout_group,
      jsonb_build_object('business_name',v_business_name,'bin',nullif(trim(p_profile->>'bin'),''),'contact_name',v_contact_name,'phone',v_phone,'email',v_email),
      jsonb_build_object('label',coalesce(nullif(trim(p_address->>'label'),''),'Негізгі мекенжай'),'city',v_city,'address',v_address,'contact_name',v_contact_name,'phone',v_phone),
      p_payment_method,(select jsonb_build_object('name',name) from public.companies where id=v_seller.company_id),nullif(trim(p_note),'')
    ) returning id into v_order;

    insert into public.order_items(company_id,order_id,product_id,quantity,unit_price,commission_amount)
    select p.company_id,v_order,p.id,x.quantity,p.price,0
    from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer)
    join public.products p on p.id=x.product_id
    where p.company_id=v_seller.company_id;

    insert into public.inventory_reservations(company_id,order_id,product_id,buyer_user_id,quantity)
    select p.company_id,v_order,p.id,v_user,x.quantity
    from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer)
    join public.products p on p.id=x.product_id
    where p.company_id=v_seller.company_id;

    v_order_ids := v_order_ids || jsonb_build_array(jsonb_build_object(
      'order_id',v_order,'seller_company_id',v_seller.company_id,'total',v_seller.seller_total
    ));
    v_total := v_total + v_seller.seller_total;
  end loop;

  return jsonb_build_object('checkout_group_id',v_checkout_group,'orders',v_order_ids,'total',v_total);
end;
$$;

revoke all on function public.place_marketplace_order(jsonb,jsonb,jsonb,text,text) from public;
grant execute on function public.place_marketplace_order(jsonb,jsonb,jsonb,text,text) to authenticated;

create or replace function public.cancel_marketplace_order(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path=public,auth
as $$
begin
  update public.orders
  set status='cancelled',updated_at=now()
  where id=p_order_id
    and source='marketplace'
    and buyer_user_id=auth.uid()
    and status in ('new','draft','submitted')
    and warehouse_status='new';
  return found;
end;
$$;

revoke all on function public.cancel_marketplace_order(uuid) from public;
grant execute on function public.cancel_marketplace_order(uuid) to authenticated;

create or replace function public.get_marketplace_orders()
returns jsonb
language sql
stable
security definer
set search_path=public,auth
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',o.id,
    'checkout_group_id',o.checkout_group_id,
    'company_id',o.company_id,
    'seller_name',coalesce(o.seller_snapshot->>'name',c.name,'Жеткізуші'),
    'status',o.status,
    'warehouse_status',o.warehouse_status,
    'payment_status',o.payment_status,
    'payment_method',o.payment_method,
    'total',o.total,
    'created_at',o.created_at,
    'delivery',o.delivery_snapshot,
    'items',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',oi.id,'product_id',oi.product_id,'name',p.name,'sku',p.sku,
        'quantity',oi.quantity,'unit_price',oi.unit_price,'line_total',oi.line_total
      ) order by p.name)
      from public.order_items oi
      join public.products p on p.id=oi.product_id and p.company_id=oi.company_id
      where oi.order_id=o.id and oi.company_id=o.company_id
    ),'[]'::jsonb)
  ) order by o.created_at desc),'[]'::jsonb)
  from public.orders o
  join public.companies c on c.id=o.company_id
  where o.source='marketplace' and o.buyer_user_id=auth.uid();
$$;

revoke all on function public.get_marketplace_orders() from public;
grant execute on function public.get_marketplace_orders() to authenticated;

create or replace function public.sync_inventory_reservation()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare r record;
begin
  if new.warehouse_status='picking' and old.warehouse_status is distinct from 'picking' then
    for r in select * from public.inventory_reservations where order_id=new.id and status='reserved' for update
    loop
      update public.products set stock=stock-r.quantity,updated_at=now()
      where id=r.product_id and company_id=r.company_id and stock>=r.quantity;
      if not found then raise exception 'insufficient stock while committing reservation'; end if;
      update public.inventory_reservations set status='committed',committed_at=now() where id=r.id;
    end loop;
  end if;

  if new.status in ('cancelled','canceled','rejected','returned') and old.status is distinct from new.status then
    for r in select * from public.inventory_reservations where order_id=new.id and status in ('reserved','committed') for update
    loop
      if r.status='committed' then
        update public.products set stock=stock+r.quantity,updated_at=now()
        where id=r.product_id and company_id=r.company_id;
      end if;
      update public.inventory_reservations set status='released',released_at=now() where id=r.id;
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_inventory_reservation_after on public.orders;
create trigger sync_inventory_reservation_after
after update of status,warehouse_status on public.orders
for each row execute function public.sync_inventory_reservation();

commit;

select 'marketplace_commerce_core_ready' as status;
