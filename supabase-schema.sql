-- Grihini Apna Bazaar: Supabase setup SQL
-- Run once in Supabase Dashboard > SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin')),
  created_at timestamptz not null default now()
);
create table if not exists public.orders (
  tracking_code text primary key,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.products (
  id text primary key,
  name text not null default '',
  active boolean not null default true,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

-- Seed starter catalogue so initial customer orders can be price/stock-validated server-side.
insert into public.products(id, name, active, payload) values
('atta-01','Aashirvaad Whole Wheat Atta',true,'{"id":"atta-01","name":"Aashirvaad Whole Wheat Atta","category":"Atta & Rice","size":"5 kg","price":285,"mrp":310,"image":"https://images.unsplash.com/photo-1627485937980-221c88ac04f9?auto=format&fit=crop&w=700&q=85","tag":"Daily essential","active":true,"stock":50}'::jsonb),
('rice-01','Premium Basmati Rice',true,'{"id":"rice-01","name":"Premium Basmati Rice","category":"Atta & Rice","size":"1 kg","price":119,"mrp":145,"image":"https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=700&q=85","tag":"Popular","active":true,"stock":50}'::jsonb),
('oil-01','Saffola Gold Oil',true,'{"id":"oil-01","name":"Saffola Gold Oil","category":"Oil & Ghee","size":"1 L","price":175,"mrp":195,"image":"https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=700&q=85","tag":"Heart smart","active":true,"stock":50}'::jsonb),
('ghee-01','Pure Desi Ghee',true,'{"id":"ghee-01","name":"Pure Desi Ghee","category":"Oil & Ghee","size":"500 ml","price":315,"mrp":340,"image":"https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=700&q=85","tag":"Kitchen staple","active":true,"stock":50}'::jsonb),
('dal-01','Toor / Rahar Dal',true,'{"id":"dal-01","name":"Toor / Rahar Dal","category":"Pulses & Dal","size":"1 kg","price":165,"mrp":185,"image":"https://images.unsplash.com/photo-1515543904379-3d757987c4b0?auto=format&fit=crop&w=700&q=85","tag":"Protein rich","active":true,"stock":50}'::jsonb),
('dal-02','Moong Dal',true,'{"id":"dal-02","name":"Moong Dal","category":"Pulses & Dal","size":"500 g","price":68,"mrp":78,"image":"https://images.unsplash.com/photo-1515543904379-3d757987c4b0?auto=format&fit=crop&w=700&q=85","tag":"Everyday value","active":true,"stock":50}'::jsonb),
('spice-01','Red Chilli Powder',true,'{"id":"spice-01","name":"Red Chilli Powder","category":"Spices","size":"200 g","price":72,"mrp":85,"image":"https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=700&q=85","tag":"Bold flavour","active":true,"stock":50}'::jsonb),
('spice-02','Cumin Seeds (Jeera)',true,'{"id":"spice-02","name":"Cumin Seeds (Jeera)","category":"Spices","size":"100 g","price":48,"mrp":55,"image":"https://images.unsplash.com/photo-1509358271058-acd22cc93898?auto=format&fit=crop&w=700&q=85","tag":"Aromatic","active":true,"stock":50}'::jsonb),
('snack-01','Tomato Ketchup',true,'{"id":"snack-01","name":"Tomato Ketchup","category":"Snacks & Packaged","size":"200 g","price":42,"mrp":48,"image":"https://images.unsplash.com/photo-1472476443507-c7a5948772fc?auto=format&fit=crop&w=700&q=85","tag":"Family favourite","active":true,"stock":50}'::jsonb),
('snack-02','Pani Puri Kit',true,'{"id":"snack-02","name":"Pani Puri Kit","category":"Snacks & Packaged","size":"1 pack","price":35,"mrp":40,"image":"https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=700&q=85","tag":"Snack time","active":true,"stock":50}'::jsonb),
('sugar-01','Fine Crystal Sugar',true,'{"id":"sugar-01","name":"Fine Crystal Sugar","category":"Atta & Rice","size":"1 kg","price":48,"mrp":52,"image":"https://images.unsplash.com/photo-1581441363689-1f3c3c414635?auto=format&fit=crop&w=700&q=85","tag":"Pantry basic","active":true,"stock":50}'::jsonb),
('maida-01','Fine Maida',true,'{"id":"maida-01","name":"Fine Maida","category":"Atta & Rice","size":"500 g","price":28,"mrp":32,"image":"https://images.unsplash.com/photo-1627485937980-221c88ac04f9?auto=format&fit=crop&w=700&q=85","tag":"Baking essential","active":true,"stock":50}'::jsonb)
on conflict (id) do nothing;

alter table public.user_roles enable row level security;
alter table public.orders enable row level security;
alter table public.products enable row level security;

create or replace function public.is_current_user_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'); $$;
revoke all on function public.is_current_user_admin() from public;
grant execute on function public.is_current_user_admin() to anon, authenticated;

-- Customers can submit only valid COD orders through the RPC; they cannot read the orders table directly.
create or replace function public.place_customer_order(order_data jsonb)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare code text;
declare saved jsonb;
declare item jsonb;
declare product_payload jsonb;
declare line_total numeric := 0;
declare expected_fee numeric := 25;
declare qty integer;
declare item_price numeric;
begin
  if coalesce(trim(order_data->'customer'->>'name'), '') = '' then raise exception 'Customer name is required'; end if;
  if length(regexp_replace(coalesce(order_data->'customer'->>'phone',''), '[^0-9]', '', 'g')) < 10 then raise exception 'A valid customer phone is required'; end if;
  if coalesce(trim(order_data->'customer'->>'address'), '') = '' then raise exception 'Delivery address is required'; end if;
  if jsonb_typeof(order_data->'items') <> 'array' or jsonb_array_length(order_data->'items') < 1 then raise exception 'Order must contain items'; end if;
  if order_data->>'paymentMethod' <> 'COD' then raise exception 'Only Cash on Delivery is supported'; end if;
  code := upper(trim(order_data->>'trackingCode'));
  if code !~ '^GPB-[A-Z0-9]{4,12}$' then raise exception 'Invalid tracking code'; end if;
  -- Validate prices and stock against database values, not browser-supplied totals.
  for item in select value from jsonb_array_elements(order_data->'items') loop
    qty := (item->>'quantity')::integer;
    if qty < 1 then raise exception 'Invalid quantity'; end if;
    select payload into product_payload from public.products where id = item->>'id' and active = true for update;
    if not found then raise exception 'Product is unavailable: %', item->>'name'; end if;
    item_price := (product_payload->>'price')::numeric;
    if abs(item_price - (item->>'price')::numeric) > 0.01 then raise exception 'Price changed for %. Refresh the page and try again.', product_payload->>'name'; end if;
    if coalesce((product_payload->>'stock')::integer, 0) < qty then raise exception 'Not enough stock for %', product_payload->>'name'; end if;
    line_total := line_total + item_price * qty;
    product_payload := jsonb_set(product_payload, '{stock}', to_jsonb((product_payload->>'stock')::integer - qty), true);
    update public.products set payload = product_payload, updated_at = now() where id = item->>'id';
  end loop;
  if line_total >= 499 then expected_fee := 0; end if;
  if abs(line_total - (order_data->>'subtotal')::numeric) > 0.01 then raise exception 'Order subtotal does not match current product prices'; end if;
  if abs(expected_fee - (order_data->>'deliveryFee')::numeric) > 0.01 then raise exception 'Delivery fee changed. Refresh the cart and try again.'; end if;
  if abs(line_total + expected_fee - (order_data->>'total')::numeric) > 0.01 then raise exception 'Order total does not match current prices'; end if;
  saved := order_data || jsonb_build_object('trackingCode', code, 'status', 'Placed', 'paymentMethod', 'COD', 'subtotal', line_total, 'deliveryFee', expected_fee, 'total', line_total + expected_fee, 'createdAt', now(), 'updatedAt', now());
  insert into public.orders(tracking_code, payload, created_at, updated_at) values (code, saved, now(), now());
  return saved;
end; $$;
revoke all on function public.place_customer_order(jsonb) from public;
grant execute on function public.place_customer_order(jsonb) to anon, authenticated;

-- Tracking function returns only the order matching the unguessable tracking code.
create or replace function public.get_order_for_tracking(tracking_code_input text)
returns jsonb language sql stable security definer set search_path = public
as $$ select payload from public.orders where tracking_code = upper(trim(tracking_code_input)) limit 1; $$;
revoke all on function public.get_order_for_tracking(text) from public;
grant execute on function public.get_order_for_tracking(text) to anon, authenticated;

-- Admin can view/change all orders. Public users have no direct SELECT/UPDATE/DELETE access.
drop policy if exists "admin reads orders" on public.orders;
create policy "admin reads orders" on public.orders for select to authenticated using (public.is_current_user_admin());
drop policy if exists "admin updates orders" on public.orders;
create policy "admin updates orders" on public.orders for update to authenticated using (public.is_current_user_admin()) with check (public.is_current_user_admin());
drop policy if exists "admin reads all products" on public.products;
create policy "admin reads all products" on public.products for select to authenticated using (public.is_current_user_admin());
drop policy if exists "public reads active products" on public.products;
create policy "public reads active products" on public.products for select to anon, authenticated using (true);
drop policy if exists "admin inserts products" on public.products;
create policy "admin inserts products" on public.products for insert to authenticated with check (public.is_current_user_admin());
drop policy if exists "admin updates products" on public.products;
create policy "admin updates products" on public.products for update to authenticated using (public.is_current_user_admin()) with check (public.is_current_user_admin());
drop policy if exists "admin deletes products" on public.products;
create policy "admin deletes products" on public.products for delete to authenticated using (public.is_current_user_admin());
drop policy if exists "users can read own role" on public.user_roles;
create policy "users can read own role" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.is_current_user_admin());

-- Product media bucket: create it once in Storage if this insert is unavailable in your dashboard.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-media', 'product-media', true, 12582912, array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm'])
on conflict (id) do update set public = true, file_size_limit = 12582912;

drop policy if exists "public reads product media" on storage.objects;
create policy "public reads product media" on storage.objects for select to anon, authenticated using (bucket_id = 'product-media');
drop policy if exists "admin uploads product media" on storage.objects;
create policy "admin uploads product media" on storage.objects for insert to authenticated with check (bucket_id = 'product-media' and public.is_current_user_admin());
drop policy if exists "admin updates product media" on storage.objects;
create policy "admin updates product media" on storage.objects for update to authenticated using (bucket_id = 'product-media' and public.is_current_user_admin()) with check (bucket_id = 'product-media' and public.is_current_user_admin());
drop policy if exists "admin deletes product media" on storage.objects;
create policy "admin deletes product media" on storage.objects for delete to authenticated using (bucket_id = 'product-media' and public.is_current_user_admin());

-- Enable Realtime for admin order/product dashboards. If already in publication, ignore duplicate-object errors.
do $$ begin alter publication supabase_realtime add table public.orders; exception when duplicate_object then null; when others then null; end $$;
do $$ begin alter publication supabase_realtime add table public.products; exception when duplicate_object then null; when others then null; end $$;
