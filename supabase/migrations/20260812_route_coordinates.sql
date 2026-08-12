-- Route-ready fields for the sales-agent map and visit workflow.
alter table public.stores add column if not exists latitude double precision;
alter table public.stores add column if not exists longitude double precision;
alter table public.stores add column if not exists route_order integer not null default 0;
alter table public.stores add column if not exists visit_status text not null default 'planned';
alter table public.stores add column if not exists visit_started_at timestamptz;
alter table public.stores add column if not exists visit_completed_at timestamptz;
