-- Safe live validation for multi-seller checkout. Every fixture is rolled back.
begin;

select set_config('test.buyer_user',(
  select user_id::text from public.company_users
  where role='owner' and status='active' order by created_at limit 1
),true);
select set_config('test.company_a',(
  select company_id::text from public.company_users
  where user_id=current_setting('test.buyer_user')::uuid and role='owner' and status='active'
  order by created_at limit 1
),true);
select set_config('test.company_b',gen_random_uuid()::text,true);
select set_config('test.product_a',gen_random_uuid()::text,true);
select set_config('test.product_b',gen_random_uuid()::text,true);
select set_config('test.warehouse_b',gen_random_uuid()::text,true);

do $$ begin
  if current_setting('test.buyer_user',true) is null or current_setting('test.company_a',true) is null then
    raise exception 'An active owner is required for marketplace validation';
  end if;
end $$;

insert into public.companies(id,name,slug,owner_id,created_by)
values(
  current_setting('test.company_b')::uuid,'Marketplace Test Seller B',
  'market-test-'||left(replace(current_setting('test.company_b'),'-',''),12),
  current_setting('test.buyer_user')::uuid,current_setting('test.buyer_user')::uuid
);
insert into public.products(id,company_id,name,sku,price,stock,workspace_active,marketplace_published,marketplace_min_order)
values
  (current_setting('test.product_a')::uuid,current_setting('test.company_a')::uuid,'Marketplace Test Product A','MKT-A-'||left(current_setting('test.product_a'),8),1000,20,true,true,2),
  (current_setting('test.product_b')::uuid,current_setting('test.company_b')::uuid,'Marketplace Test Product B','MKT-B-'||left(current_setting('test.product_b'),8),2500,20,true,true,1);
insert into public.warehouses(id,company_id,name)
values(current_setting('test.warehouse_b')::uuid,current_setting('test.company_b')::uuid,'Marketplace Test Warehouse B');

set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.buyer_user'),true);
select set_config('request.jwt.claim.role','authenticated',true);

select set_config('test.checkout_result',public.place_marketplace_order(
  jsonb_build_object('business_name','Marketplace Test Buyer','contact_name','Test Buyer','phone','+77000000000','email','test@example.kz'),
  jsonb_build_object('label','Test address','city','Алматы','address','Тест көшесі, 1','contact_name','Test Buyer','phone','+77000000000','save',false),
  jsonb_build_array(
    jsonb_build_object('product_id',current_setting('test.product_a'),'quantity',2),
    jsonb_build_object('product_id',current_setting('test.product_b'),'quantity',3)
  ),
  'transaction rollback validation','invoice'
)::text,true);

select set_config('test.buyer_order_count',(
  select count(*)::text from public.orders
  where checkout_group_id=(current_setting('test.checkout_result')::jsonb->>'checkout_group_id')::uuid
),true);

reset role;

select set_config('test.seller_split_valid',(
  select (count(*)=2 and count(distinct o.company_id)=2 and bool_and(oi.company_id=o.company_id and p.company_id=o.company_id))::text
  from public.orders o
  join public.order_items oi on oi.order_id=o.id and oi.company_id=o.company_id
  join public.products p on p.id=oi.product_id and p.company_id=oi.company_id
  where o.checkout_group_id=(current_setting('test.checkout_result')::jsonb->>'checkout_group_id')::uuid
),true);

select set_config('test.totals_valid',(
  select (sum(total)=9500)::text from public.orders
  where checkout_group_id=(current_setting('test.checkout_result')::jsonb->>'checkout_group_id')::uuid
),true);

select set_config('test.cross_warehouse_blocked','false',true);
do $$ begin
  begin
    update public.orders set warehouse_id=current_setting('test.warehouse_b')::uuid
    where checkout_group_id=(current_setting('test.checkout_result')::jsonb->>'checkout_group_id')::uuid
      and company_id=current_setting('test.company_a')::uuid;
  exception when foreign_key_violation then
    perform set_config('test.cross_warehouse_blocked','true',true);
  end;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.buyer_user'),true);
select set_config('request.jwt.claim.role','authenticated',true);
select public.cancel_marketplace_order(value::uuid)
from jsonb_array_elements(current_setting('test.checkout_result')::jsonb->'orders') item,
lateral (select item->>'order_id' as value) order_id;
reset role;

select set_config('test.reservations_released',(
  select bool_and(status='released')::text from public.inventory_reservations
  where order_id in (
    select id from public.orders
    where checkout_group_id=(current_setting('test.checkout_result')::jsonb->>'checkout_group_id')::uuid
  )
),true);

select
  current_setting('test.buyer_order_count')::integer=2 as buyer_sees_two_seller_orders,
  current_setting('test.seller_split_valid')::boolean as items_stay_inside_seller_tenant,
  current_setting('test.totals_valid')::boolean as server_recalculates_totals,
  current_setting('test.cross_warehouse_blocked')::boolean as cross_company_warehouse_blocked,
  current_setting('test.reservations_released')::boolean as cancellation_releases_inventory;

rollback;
