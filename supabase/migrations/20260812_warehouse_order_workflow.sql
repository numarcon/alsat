-- Warehouse fulfillment workflow for orders sent by a sales agent.
alter table public.orders add column if not exists warehouse_status text not null default 'new';
alter table public.orders add column if not exists accepted_at timestamptz;
alter table public.orders add column if not exists picking_started_at timestamptz;
alter table public.orders add column if not exists ready_at timestamptz;
alter table public.orders add column if not exists labeled_at timestamptz;
alter table public.orders add column if not exists shipped_at timestamptz;
alter table public.orders add column if not exists sticker_code text;
alter table public.orders add column if not exists waybill_number text;
create index if not exists orders_warehouse_status_idx on public.orders (company_id, warehouse_status, created_at desc);
