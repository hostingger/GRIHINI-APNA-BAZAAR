-- Run once in Supabase SQL Editor to enable Admin-managed homepage banners.
create table if not exists public.store_settings (
  id text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.store_settings enable row level security;
drop policy if exists "public reads storefront settings" on public.store_settings;
create policy "public reads storefront settings" on public.store_settings for select to anon, authenticated using (id = 'homepage');
drop policy if exists "admin inserts storefront settings" on public.store_settings;
create policy "admin inserts storefront settings" on public.store_settings for insert to authenticated with check (public.is_current_user_admin());
drop policy if exists "admin updates storefront settings" on public.store_settings;
create policy "admin updates storefront settings" on public.store_settings for update to authenticated using (public.is_current_user_admin()) with check (public.is_current_user_admin());
grant select on public.store_settings to anon, authenticated;
grant insert, update on public.store_settings to authenticated;
