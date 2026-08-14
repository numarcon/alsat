-- Universal Amazon-style product listing fields for Alsat Marketplace.
-- Non-destructive: current products and Architecture v1 visibility flags are preserved.

alter table public.products add column if not exists category text not null default 'Басқа тауарлар';
alter table public.products add column if not exists subcategory text not null default 'Өзге';
alter table public.products add column if not exists brand text;
alter table public.products add column if not exists manufacturer text;
alter table public.products add column if not exists model text;
alter table public.products add column if not exists barcode text;
alter table public.products add column if not exists barcode_type text not null default 'EAN-13';
alter table public.products add column if not exists description text;
alter table public.products add column if not exists bullet_points jsonb not null default '[]'::jsonb;
alter table public.products add column if not exists search_terms text;
alter table public.products add column if not exists country_of_origin text;
alter table public.products add column if not exists unit text not null default 'дана';
alter table public.products add column if not exists currency text not null default 'KZT';
alter table public.products add column if not exists vat_rate numeric(5,2) not null default 0;
alter table public.products add column if not exists max_order integer;
alter table public.products add column if not exists reorder_point integer not null default 0;
alter table public.products add column if not exists warehouse_location text;
alter table public.products add column if not exists weight_kg numeric(12,3);
alter table public.products add column if not exists length_cm numeric(12,2);
alter table public.products add column if not exists width_cm numeric(12,2);
alter table public.products add column if not exists height_cm numeric(12,2);
alter table public.products add column if not exists package_quantity integer not null default 1;
alter table public.products add column if not exists shipping_class text not null default 'standard';
alter table public.products add column if not exists warranty_months integer not null default 0;
alter table public.products add column if not exists condition text not null default 'new';
alter table public.products add column if not exists certification text;
alter table public.products add column if not exists dangerous_goods boolean not null default false;
alter table public.products add column if not exists has_variants boolean not null default false;
alter table public.products add column if not exists variant_options jsonb not null default '[]'::jsonb;
alter table public.products add column if not exists attributes jsonb not null default '{}'::jsonb;
alter table public.products add column if not exists image_urls jsonb not null default '[]'::jsonb;
alter table public.products add column if not exists marketplace_subcategory text not null default 'Өзге';

update public.products
set
  category = coalesce(nullif(marketplace_category, ''), category),
  subcategory = case
    when subcategory = 'Өзге' and marketplace_category is not null then marketplace_category
    else subcategory
  end,
  marketplace_subcategory = case
    when marketplace_subcategory = 'Өзге' and marketplace_category is not null then marketplace_category
    else marketplace_subcategory
  end,
  image_urls = case
    when jsonb_array_length(image_urls) = 0 and coalesce(image_url, marketplace_image_url) is not null
      then jsonb_build_array(coalesce(image_url, marketplace_image_url))
    else image_urls
  end;

alter table public.products drop constraint if exists products_barcode_type_check;
alter table public.products add constraint products_barcode_type_check
  check (barcode_type in ('EAN-13', 'UPC', 'GTIN', 'ISBN', 'QR', 'Баркод жоқ'));

alter table public.products drop constraint if exists products_condition_check;
alter table public.products add constraint products_condition_check
  check (condition in ('new', 'refurbished', 'used'));

alter table public.products drop constraint if exists products_currency_check;
alter table public.products add constraint products_currency_check
  check (currency in ('KZT', 'USD', 'EUR', 'CNY'));

alter table public.products drop constraint if exists products_catalog_numbers_check;
alter table public.products add constraint products_catalog_numbers_check check (
  vat_rate >= 0 and vat_rate <= 100
  and reorder_point >= 0
  and package_quantity > 0
  and warranty_months >= 0
  and (max_order is null or max_order > 0)
  and (weight_kg is null or weight_kg >= 0)
  and (length_cm is null or length_cm >= 0)
  and (width_cm is null or width_cm >= 0)
  and (height_cm is null or height_cm >= 0)
);

create index if not exists products_universal_catalog_idx
  on public.products (marketplace_published, workspace_active, category, subcategory, created_at desc);

create index if not exists products_company_barcode_idx
  on public.products (company_id, barcode)
  where barcode is not null and barcode <> '';
