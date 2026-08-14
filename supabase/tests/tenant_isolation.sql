begin;
-- Run with `supabase test db`. These assertions document the security boundary.
select plan(6);
select has_table('public','companies','companies exists');
select has_table('public','company_sales_agents','independent agent relationship exists');
select col_is_null('public','sales_agents','company_id','sales_agents have no company owner');
select has_column('public','products','workspace_active','workspace visibility exists');
select has_column('public','products','sales_agent_visible','agent visibility exists');
select has_column('public','products','marketplace_published','marketplace publication exists');
select * from finish();
rollback;
