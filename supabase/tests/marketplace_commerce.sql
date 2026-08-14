begin;

select plan(20);

select has_table('public','marketplace_profiles','buyer profiles exist');
select has_table('public','marketplace_addresses','buyer addresses exist');
select has_table('public','marketplace_favorites','buyer favorites exist');
select has_table('public','inventory_reservations','inventory reservations exist');
select has_view('public','marketplace_catalog','safe public catalog exists');

select has_column('public','customers','marketplace_buyer_user_id','seller customer links to marketplace buyer');
select has_column('public','orders','checkout_group_id','multi-seller checkout group exists');
select has_column('public','orders','buyer_snapshot','buyer data snapshot exists');
select has_column('public','orders','delivery_snapshot','delivery data snapshot exists');
select has_column('public','orders','seller_snapshot','seller data snapshot exists');
select has_column('public','orders','payment_method','payment method exists');

select has_function('public','place_marketplace_order',array['jsonb','jsonb','jsonb','text','text'],'secure checkout RPC exists');
select function_lang_is('public','place_marketplace_order',array['jsonb','jsonb','jsonb','text','text'],'plpgsql','checkout uses plpgsql');
select function_privs_are('public','place_marketplace_order',array['jsonb','jsonb','jsonb','text','text'],'authenticated',array['EXECUTE'],'only authenticated buyer can execute checkout');
select has_function('public','get_marketplace_orders',array[]::text[],'safe buyer order RPC exists');
select has_function('public','cancel_marketplace_order',array['uuid'],'buyer cancellation RPC exists');
select has_trigger('public','orders','sync_inventory_reservation_after','orders synchronize reservations');

select policies_are('public','marketplace_profiles',array['marketplace_profiles_self'],'buyer profiles are self-scoped');
select policies_are('public','marketplace_addresses',array['marketplace_addresses_self'],'buyer addresses are self-scoped');
select policies_are('public','marketplace_favorites',array['marketplace_favorites_self'],'buyer favorites are self-scoped');

select * from finish();
rollback;
