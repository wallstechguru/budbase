-- BudBase Postgres schema for Supabase.
-- Paste this whole file into the Supabase SQL Editor and click "Run".
-- Safe to re-run: tables use IF NOT EXISTS, functions use CREATE OR REPLACE.

create table if not exists brands (
  id bigserial primary key,
  name text not null unique,
  slug text not null unique
);

create table if not exists categories (
  id bigserial primary key,
  name text not null unique,
  slug text not null unique,
  tile_image text
);

create table if not exists products (
  id bigserial primary key,
  name text not null,
  slug text not null unique,
  brand_id bigint references brands(id),
  category_id bigint references categories(id),
  consumption_method text,
  cultivar_type text,
  dominant_effect text,
  form text,
  thc_min numeric(4,1),
  thc_max numeric(4,1),
  cbd_min numeric(4,1),
  cbd_max numeric(4,1),
  description text,
  image text,
  featured boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_products_category on products(category_id);
create index if not exists idx_products_brand on products(brand_id);

create table if not exists variants (
  id bigserial primary key,
  product_id bigint not null references products(id) on delete cascade,
  size_label text not null,
  price numeric(10,2) not null,
  compare_at_price numeric(10,2),
  sku text,
  in_stock boolean not null default true
);

create index if not exists idx_variants_product on variants(product_id);

create table if not exists users (
  id bigserial primary key,
  email text not null unique,
  password_hash text not null,
  first_name text,
  last_name text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists cart_items (
  id bigserial primary key,
  session_id text not null,
  variant_id bigint not null references variants(id),
  quantity integer not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists idx_cart_items_session on cart_items(session_id);

create table if not exists orders (
  id bigserial primary key,
  user_id bigint references users(id),
  email text not null,
  full_name text not null,
  phone text,
  fulfillment_method text,
  address text,
  payment_method text not null,
  crypto_network text,
  status text not null default 'pending_manual_processing',
  subtotal numeric(10,2) not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_orders_user on orders(user_id);

create table if not exists order_items (
  id bigserial primary key,
  order_id bigint not null references orders(id) on delete cascade,
  variant_id bigint not null references variants(id),
  product_name text not null,
  size_label text not null,
  unit_price numeric(10,2) not null,
  quantity integer not null
);

create index if not exists idx_order_items_order on order_items(order_id);

-- ============================================================
-- create_order: atomically inserts an order + its line items
-- from the caller's cart, then clears that cart. Raises an
-- exception (and rolls back) if the cart is empty.
-- ============================================================
create or replace function create_order(
  p_session_id text,
  p_user_id bigint,
  p_email text,
  p_full_name text,
  p_phone text,
  p_fulfillment_method text,
  p_address text,
  p_payment_method text,
  p_crypto_network text
) returns bigint
language plpgsql
as $$
declare
  v_subtotal numeric(10,2);
  v_order_id bigint;
begin
  if not exists (select 1 from cart_items where session_id = p_session_id) then
    raise exception 'Cannot create an order from an empty cart';
  end if;

  select coalesce(sum(v.price * ci.quantity), 0)
  into v_subtotal
  from cart_items ci
  join variants v on v.id = ci.variant_id
  where ci.session_id = p_session_id;

  insert into orders (user_id, email, full_name, phone, fulfillment_method, address, payment_method, crypto_network, status, subtotal)
  values (p_user_id, p_email, p_full_name, p_phone, p_fulfillment_method, p_address, p_payment_method, p_crypto_network, 'pending_manual_processing', v_subtotal)
  returning id into v_order_id;

  insert into order_items (order_id, variant_id, product_name, size_label, unit_price, quantity)
  select v_order_id, v.id, p.name, v.size_label, v.price, ci.quantity
  from cart_items ci
  join variants v on v.id = ci.variant_id
  join products p on p.id = v.product_id
  where ci.session_id = p_session_id;

  delete from cart_items where session_id = p_session_id;

  return v_order_id;
end;
$$;

-- ============================================================
-- search_products: powers both the collection pages (filters,
-- sort, pagination) and the search results page (p_query).
-- Pass NULL (not an empty array) for any facet that isn't
-- active. Every row includes total_count (window function) so
-- one call gets both the page of results and the total.
-- ============================================================
create or replace function search_products(
  p_category_id bigint default null,
  p_category_slugs text[] default null,
  p_brand_slugs text[] default null,
  p_consumption text[] default null,
  p_cultivar text[] default null,
  p_effect text[] default null,
  p_form text[] default null,
  p_price_min numeric default null,
  p_price_max numeric default null,
  p_query text default null,
  p_sort text default 'featured',
  p_limit int default 12,
  p_offset int default 0
) returns table (
  id bigint,
  name text,
  slug text,
  image text,
  thc_min numeric,
  thc_max numeric,
  brand_name text,
  category_name text,
  category_slug text,
  featured boolean,
  created_at timestamptz,
  price_from numeric,
  total_count bigint
)
language sql
stable
as $$
  with base as (
    select
      p.id, p.name, p.slug, p.image, p.thc_min, p.thc_max,
      b.name as brand_name, c.name as category_name, c.slug as category_slug,
      p.featured, p.created_at,
      (select min(v.price) from variants v where v.product_id = p.id) as price_from
    from products p
    left join brands b on b.id = p.brand_id
    left join categories c on c.id = p.category_id
    where (p_category_id is null or p.category_id = p_category_id)
      and (p_category_slugs is null or c.slug = any(p_category_slugs))
      and (p_brand_slugs is null or b.slug = any(p_brand_slugs))
      and (p_consumption is null or p.consumption_method = any(p_consumption))
      and (p_cultivar is null or p.cultivar_type = any(p_cultivar))
      and (p_effect is null or p.dominant_effect = any(p_effect))
      and (p_form is null or p.form = any(p_form))
      and (
        p_query is null
        or p.name ilike '%' || p_query || '%'
        or b.name ilike '%' || p_query || '%'
        or c.name ilike '%' || p_query || '%'
      )
  )
  select base.*, count(*) over() as total_count
  from base
  where (p_price_min is null or price_from >= p_price_min)
    and (p_price_max is null or price_from <= p_price_max)
  order by
    case when p_sort = 'featured' then featured end desc,
    case when p_sort = 'featured' then name end asc,
    case when p_sort = 'az' then name end asc,
    case when p_sort = 'za' then name end desc,
    case when p_sort = 'price-asc' then price_from end asc,
    case when p_sort = 'price-desc' then price_from end desc,
    case when p_sort = 'date-new' then created_at end desc,
    case when p_sort = 'date-old' then created_at end asc,
    name asc
  limit p_limit offset p_offset;
$$;

-- ============================================================
-- get_shop_facets: filter-sidebar option lists + counts + price
-- bounds, scoped to a category (or the whole catalog when NULL).
-- ============================================================
create or replace function get_shop_facets(p_category_id bigint default null)
returns jsonb
language plpgsql
stable
as $$
declare
  v_brands jsonb;
  v_consumption jsonb;
  v_cultivars jsonb;
  v_effects jsonb;
  v_forms jsonb;
  v_categories jsonb;
  v_price_min numeric;
  v_price_max numeric;
begin
  select coalesce(jsonb_agg(jsonb_build_object('slug', slug, 'name', name, 'count', cnt) order by name), '[]'::jsonb)
  into v_brands
  from (
    select b.slug, b.name, count(*) as cnt
    from products p join brands b on b.id = p.brand_id
    where p_category_id is null or p.category_id = p_category_id
    group by b.slug, b.name
  ) t;

  select coalesce(jsonb_agg(jsonb_build_object('value', value, 'count', cnt) order by value), '[]'::jsonb)
  into v_consumption
  from (
    select p.consumption_method as value, count(*) as cnt
    from products p
    where (p_category_id is null or p.category_id = p_category_id) and p.consumption_method is not null
    group by p.consumption_method
  ) t;

  select coalesce(jsonb_agg(jsonb_build_object('value', value, 'count', cnt) order by value), '[]'::jsonb)
  into v_cultivars
  from (
    select p.cultivar_type as value, count(*) as cnt
    from products p
    where (p_category_id is null or p.category_id = p_category_id) and p.cultivar_type is not null
    group by p.cultivar_type
  ) t;

  select coalesce(jsonb_agg(jsonb_build_object('value', value, 'count', cnt) order by value), '[]'::jsonb)
  into v_effects
  from (
    select p.dominant_effect as value, count(*) as cnt
    from products p
    where (p_category_id is null or p.category_id = p_category_id) and p.dominant_effect is not null
    group by p.dominant_effect
  ) t;

  select coalesce(jsonb_agg(jsonb_build_object('value', value, 'count', cnt) order by value), '[]'::jsonb)
  into v_forms
  from (
    select p.form as value, count(*) as cnt
    from products p
    where (p_category_id is null or p.category_id = p_category_id) and p.form is not null
    group by p.form
  ) t;

  if p_category_id is null then
    select coalesce(jsonb_agg(jsonb_build_object('slug', slug, 'name', name, 'count', cnt) order by name), '[]'::jsonb)
    into v_categories
    from (
      select c.slug, c.name, count(p.id) as cnt
      from categories c left join products p on p.category_id = c.id
      group by c.slug, c.name
    ) t;
  else
    v_categories := '[]'::jsonb;
  end if;

  select min(price_from), max(price_from)
  into v_price_min, v_price_max
  from (
    select (select min(v.price) from variants v where v.product_id = p.id) as price_from
    from products p
    where p_category_id is null or p.category_id = p_category_id
  ) t;

  return jsonb_build_object(
    'brands', v_brands,
    'consumption', v_consumption,
    'cultivars', v_cultivars,
    'effects', v_effects,
    'forms', v_forms,
    'categories', v_categories,
    'priceBounds', jsonb_build_object('min', v_price_min, 'max', v_price_max)
  );
end;
$$;
