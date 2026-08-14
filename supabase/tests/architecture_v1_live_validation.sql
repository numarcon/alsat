-- Safe live validation: every test record is rolled back at the end.
begin;

select set_config('test.owner_user',(
  select user_id::text from public.company_users
  where role='owner' and status='active' order by created_at limit 1
),true);
select set_config('test.company_a',(
  select company_id::text from public.company_users
  where user_id=current_setting('test.owner_user')::uuid and role='owner' and status='active'
  order by created_at limit 1
),true);
select set_config('test.company_b',gen_random_uuid()::text,true);
select set_config('test.product_b',gen_random_uuid()::text,true);
select set_config('test.warehouse_b',gen_random_uuid()::text,true);
select set_config('test.outsider',gen_random_uuid()::text,true);

do $$ begin
  if current_setting('test.owner_user',true) is null or current_setting('test.company_a',true) is null then
    raise exception 'An active company owner is required for validation';
  end if;
end $$;

insert into public.companies(id,name,slug,owner_id,created_by)
values(current_setting('test.company_b')::uuid,'RLS Test Company','rls-test-'||left(replace(current_setting('test.company_b'),'-',''),12),current_setting('test.owner_user')::uuid,current_setting('test.owner_user')::uuid);
insert into public.products(id,company_id,name,sku,price,workspace_active,sales_agent_visible,marketplace_published)
values(current_setting('test.product_b')::uuid,current_setting('test.company_b')::uuid,'Hidden cross-tenant product','RLS-TEST',100,true,true,false);
insert into public.warehouses(id,company_id,name)
values(current_setting('test.warehouse_b')::uuid,current_setting('test.company_b')::uuid,'Hidden cross-tenant warehouse');

-- Owner of company A must not see company B or its product.
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.owner_user'),true);
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('test.owner_hidden_company',(select (count(*)=0)::text from public.companies where id=current_setting('test.company_b')::uuid),true);
select set_config('test.owner_hidden_product',(select (count(*)=0)::text from public.products where id=current_setting('test.product_b')::uuid),true);

-- A random authenticated user must not see company A and cannot write into it.
select set_config('request.jwt.claim.sub',current_setting('test.outsider'),true);
select set_config('test.outsider_hidden_company',(select (count(*)=0)::text from public.companies where id=current_setting('test.company_a')::uuid),true);
select set_config('test.outsider_write_blocked','false',true);
do $$ begin
  begin
    insert into public.products(company_id,name,sku,price)
    values(current_setting('test.company_a')::uuid,'Forbidden product','FORBIDDEN-'||left(current_setting('test.outsider'),8),1);
  exception when insufficient_privilege then
    perform set_config('test.outsider_write_blocked','true',true);
  end;
end $$;

reset role;

-- Composite foreign keys must block cross-company warehouse and product links.
select set_config('test.cross_warehouse_blocked','false',true);
do $$ begin
  begin
    update public.orders set warehouse_id=current_setting('test.warehouse_b')::uuid
    where company_id=current_setting('test.company_a')::uuid
      and id=(select id from public.orders where company_id=current_setting('test.company_a')::uuid limit 1);
  exception when foreign_key_violation then
    perform set_config('test.cross_warehouse_blocked','true',true);
  end;
end $$;

select set_config('test.cross_product_blocked','false',true);
do $$ begin
  begin
    insert into public.order_items(company_id,order_id,product_id,quantity,unit_price)
    select current_setting('test.company_a')::uuid,o.id,current_setting('test.product_b')::uuid,1,100
    from public.orders o where o.company_id=current_setting('test.company_a')::uuid limit 1;
  exception when foreign_key_violation then
    perform set_config('test.cross_product_blocked','true',true);
  end;
end $$;

-- Delivered + paid must earn the approved agent's commission.
select set_config('test.agent',coalesce(
  (select id from public.sales_agents where user_id=current_setting('test.owner_user')::uuid),
  gen_random_uuid()
)::text,true);
select set_config('test.customer',gen_random_uuid()::text,true);
select set_config('test.order',gen_random_uuid()::text,true);
insert into public.sales_agents(id,user_id,full_name)
select current_setting('test.agent')::uuid,current_setting('test.owner_user')::uuid,'Temporary Commission Agent'
where not exists(select 1 from public.sales_agents where id=current_setting('test.agent')::uuid);
insert into public.company_sales_agents(company_id,sales_agent_id,status,commission_rate,approved_by,approved_at)
values(current_setting('test.company_a')::uuid,current_setting('test.agent')::uuid,'approved',7.5,current_setting('test.owner_user')::uuid,now())
on conflict(company_id,sales_agent_id) do update set status='approved',commission_rate=7.5,approved_by=excluded.approved_by,approved_at=now();
insert into public.customers(id,company_id,name,created_by_agent_id)
values(current_setting('test.customer')::uuid,current_setting('test.company_a')::uuid,'Temporary Commission Customer',current_setting('test.agent')::uuid);
insert into public.orders(id,company_id,customer_id,sales_agent_id,status,payment_status,total)
values(current_setting('test.order')::uuid,current_setting('test.company_a')::uuid,current_setting('test.customer')::uuid,current_setting('test.agent')::uuid,'draft','unpaid',1000);
update public.orders set status='delivered',payment_status='paid',delivered_at=now(),paid_at=now()
where id=current_setting('test.order')::uuid;
select set_config('test.commission_earned',(
  select (count(*)=1 and max(amount)=75.00 and bool_and(status='earned'))::text
  from public.commissions where order_id=current_setting('test.order')::uuid
),true);

select
  current_setting('test.owner_hidden_company')::boolean as owner_cannot_read_other_company,
  current_setting('test.owner_hidden_product')::boolean as owner_cannot_read_other_product,
  current_setting('test.outsider_hidden_company')::boolean as outsider_cannot_read_company,
  current_setting('test.outsider_write_blocked')::boolean as outsider_cannot_write_product,
  current_setting('test.cross_warehouse_blocked')::boolean as cross_company_warehouse_blocked,
  current_setting('test.cross_product_blocked')::boolean as cross_company_product_blocked,
  current_setting('test.commission_earned')::boolean as delivered_paid_commission_earned;

rollback;
