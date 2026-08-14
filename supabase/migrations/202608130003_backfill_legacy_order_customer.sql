-- Post-upgrade repair for legacy operational orders without a customer/store.
-- Idempotent: safe to run once or repeat. Existing order totals/statuses are untouched.
begin;

insert into public.customers(company_id,name,address)
select distinct o.company_id,'Imported legacy customer','Automatically linked during Architecture v1 migration'
from public.orders o
where o.company_id is not null
  and o.customer_id is null
  and o.source <> 'marketplace'
  and not exists(
    select 1 from public.customers c
    where c.company_id=o.company_id and c.name='Imported legacy customer'
  );

update public.orders o
set customer_id=(
  select c.id from public.customers c
  where c.company_id=o.company_id and c.name='Imported legacy customer'
  order by c.created_at,c.id limit 1
)
where o.company_id is not null
  and o.customer_id is null
  and o.source <> 'marketplace';

do $$ begin
  if exists(
    select 1 from public.orders
    where source <> 'marketplace' and customer_id is null
  ) then
    raise exception 'A non-marketplace order still has no customer; transaction rolled back';
  end if;
end $$;

alter table public.orders validate constraint orders_customer_required_for_workspace;

commit;

select
  'legacy_order_customer_backfill_complete' as status,
  count(*) filter(where name='Imported legacy customer') as imported_customers,
  (select count(*) from public.orders where source <> 'marketplace' and customer_id is null) as operational_orders_without_customer
from public.customers;
