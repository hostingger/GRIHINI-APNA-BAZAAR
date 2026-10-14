import { supabase, supabaseConfigured } from './supabase';
import { PRODUCTS } from './data';
import { transitionOrder } from './orderLogic';

const ORDER_KEY = 'gpb_demo_orders_v2';
const PRODUCT_KEY = 'gpb_demo_products_v2';
const read = (key, fallback=[]) => { try { const value = JSON.parse(localStorage.getItem(key) || 'null'); return Array.isArray(value) ? value : fallback; } catch { return fallback; } };
const write = (key, value, eventName) => { localStorage.setItem(key, JSON.stringify(value)); window.dispatchEvent(new CustomEvent(eventName)); };
const readDemoOrders = () => read(ORDER_KEY);
const readDemoProducts = () => read(PRODUCT_KEY, PRODUCTS.map((p) => ({ ...p, active: true, stock: 50 })));
export const isDemoMode = !supabaseConfigured;

function normalizeOrderRow(row) { return row?.payload || row; }
function normalizeProductRow(row) { return row?.payload ? { ...row.payload, id: row.id } : row; }

export async function saveOrder(order) {
  if (!supabaseConfigured) {
    const orders = readDemoOrders();
    if (orders.some((item) => item.trackingCode === order.trackingCode)) throw new Error('Tracking code collision. Please try again.');
    write(ORDER_KEY, [order, ...orders], 'gpb-orders-updated');
    return order;
  }
  const { data, error } = await supabase.rpc('place_customer_order', { order_data: order });
  if (error) throw new Error(`Order could not be saved: ${error.message}`);
  return data?.payload || data || order;
}

export async function getOrder(trackingCode) {
  const code = String(trackingCode || '').trim().toUpperCase();
  if (!supabaseConfigured) return readDemoOrders().find((order) => order.trackingCode.toUpperCase() === code) || null;
  const { data, error } = await supabase.rpc('get_order_for_tracking', { tracking_code_input: code });
  if (error) throw new Error(`Tracking lookup failed: ${error.message}`);
  return data || null;
}

export function watchOrder(trackingCode, callback, onError = () => {}) {
  if (!trackingCode) return () => {};
  if (!supabaseConfigured) {
    const emit = () => { const order = readDemoOrders().find((item) => item.trackingCode.toUpperCase() === trackingCode.trim().toUpperCase()); if (order) callback(order); };
    emit(); window.addEventListener('gpb-orders-updated', emit); window.addEventListener('storage', emit);
    return () => { window.removeEventListener('gpb-orders-updated', emit); window.removeEventListener('storage', emit); };
  }
  let active = true;
  const refresh = async () => { try { const order = await getOrder(trackingCode); if (active && order) callback(order); } catch (error) { if (active) onError(error); } };
  refresh();
  // Public tracking is intentionally fetched via a restricted SQL function. Polling avoids exposing all orders through public realtime.
  const timer = window.setInterval(refresh, 8000);
  return () => { active = false; window.clearInterval(timer); };
}

export function subscribeOrders(callback, onError = () => {}) {
  if (!supabaseConfigured) {
    const emit = () => callback(readDemoOrders().sort((a,b) => String(b.createdAt).localeCompare(String(a.createdAt))));
    emit(); window.addEventListener('gpb-orders-updated', emit); window.addEventListener('storage', emit);
    return () => { window.removeEventListener('gpb-orders-updated', emit); window.removeEventListener('storage', emit); };
  }
  let active = true;
  const refresh = async () => {
    const { data, error } = await supabase.from('orders').select('tracking_code,payload,created_at').order('created_at', { ascending: false });
    if (error) { if (active) onError(error); return; }
    if (active) callback((data || []).map(normalizeOrderRow));
  };
  refresh();
  const channel = supabase.channel('admin-orders-live').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, refresh).subscribe((status) => { if (status === 'CHANNEL_ERROR' && active) onError(new Error('Realtime connection failed. Orders will still refresh on reconnect.')); });
  return () => { active = false; supabase.removeChannel(channel); };
}

export async function setOrderStatus(trackingCode, status, note = '') {
  if (!supabaseConfigured) {
    const orders = readDemoOrders(); const index = orders.findIndex((item) => item.trackingCode === trackingCode);
    if (index < 0) throw new Error('Order not found.');
    orders[index] = transitionOrder(orders[index], status, new Date(), note); write(ORDER_KEY, orders, 'gpb-orders-updated'); return orders[index];
  }
  const { data, error } = await supabase.from('orders').select('payload').eq('tracking_code', trackingCode).single();
  if (error) throw new Error(`Order could not be loaded: ${error.message}`);
  const updated = transitionOrder(data.payload, status, new Date(), note);
  const { data: savedRow, error: updateError } = await supabase
    .from('orders')
    .update({ payload: updated, updated_at: updated.updatedAt })
    .eq('tracking_code', trackingCode)
    .select('tracking_code,payload')
    .maybeSingle();
  if (updateError) throw new Error(`Status update failed: ${updateError.message}`);
  if (!savedRow) throw new Error('Status update was not saved. Supabase returned no updated row. Check that this signed-in user has the admin role and that the "admin updates orders" RLS policy is enabled.');
  return normalizeOrderRow(savedRow);
}

export function watchAuth(callback) {
  if (!supabaseConfigured) { callback(null); return () => {}; }
  supabase.auth.getSession().then(({ data }) => callback(data.session?.user || null));
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => callback(session?.user || null));
  return () => subscription.unsubscribe();
}
export async function adminSignIn(email, password) {
  if (!supabaseConfigured) throw new Error('Supabase setup is not complete. Demo mode has no secure admin login. Follow SETUP-HI.md.');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return data.user;
}
export async function adminSignOut() { if (supabaseConfigured) { const { error } = await supabase.auth.signOut(); if (error) throw error; } }
export async function isCurrentUserAdmin(user) {
  if (!supabaseConfigured || !user) return false;
  const { data, error } = await supabase.rpc('is_current_user_admin');
  if (error) return false;
  return data === true;
}

export function subscribeProducts(callback, onError = () => {}) {
  if (!supabaseConfigured) {
    const emit = () => callback(readDemoProducts()); emit(); window.addEventListener('gpb-products-updated', emit); window.addEventListener('storage', emit);
    return () => { window.removeEventListener('gpb-products-updated', emit); window.removeEventListener('storage', emit); };
  }
  let active = true;
  const refresh = async () => {
    const { data, error } = await supabase.from('products').select('id,payload,active').order('id');
    if (error) { if (active) onError(error); return; }
    const products = (data || []).map((row) => ({ ...normalizeProductRow(row), active: row.active }));
    const seen = new Set(products.map((p) => p.id));
    const starters = PRODUCTS.filter((p) => !seen.has(p.id)).map((p) => ({ ...p, active: true, stock: 50, starterCatalogue: true }));
    if (active) callback([...products, ...starters].sort((a,b) => String(a.name).localeCompare(String(b.name))));
  };
  refresh();
  const channel = supabase.channel('products-live').on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, refresh).subscribe();
  return () => { active = false; supabase.removeChannel(channel); };
}

export async function saveProduct(product) {
  const normalized = { ...product, id: String(product.id || `gpb-${Date.now().toString(36)}`), name: String(product.name || '').trim(), category: String(product.category || 'Other'), size: String(product.size || '').trim(), price: Number(product.price), mrp: Number(product.mrp), stock: Math.max(0, Number(product.stock) || 0), active: product.active !== false, updatedAt: new Date().toISOString() };
  if (!normalized.name || !normalized.size || !Number.isFinite(normalized.price) || normalized.price < 0 || !Number.isFinite(normalized.mrp) || normalized.mrp < normalized.price) throw new Error('Product name, size, valid selling price and MRP are required. MRP must be at least the selling price.');
  if (!supabaseConfigured) { const products = readDemoProducts(); const index = products.findIndex((item) => item.id === normalized.id); if (index >= 0) products[index] = normalized; else products.unshift(normalized); write(PRODUCT_KEY, products, 'gpb-products-updated'); return normalized; }
  const { error } = await supabase.from('products').upsert({ id: normalized.id, payload: normalized, active: normalized.active, name: normalized.name, updated_at: normalized.updatedAt });
  if (error) throw new Error(`Product could not be saved: ${error.message}`);
  return normalized;
}
export async function removeProduct(productId, product = {}) {
  if (!supabaseConfigured) { write(PRODUCT_KEY, readDemoProducts().filter((p) => p.id !== productId), 'gpb-products-updated'); return; }
  const updated = { ...product, active: false, updatedAt: new Date().toISOString() };
  const { error } = await supabase.from('products').upsert({ id: productId, payload: updated, active: false, name: updated.name || '', updated_at: updated.updatedAt });
  if (error) throw new Error(`Product could not be archived: ${error.message}`);
}
export async function uploadProductMedia(file, productId = 'new') {
  if (!file) return '';
  if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) throw new Error('Please choose an image or video file.');
  if (file.size > 12 * 1024 * 1024) throw new Error('File size must be 12 MB or less.');
  if (!supabaseConfigured) return await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('File could not be read.')); reader.readAsDataURL(file); });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isCurrentUserAdmin(user))) throw new Error('Only an authenticated Admin can upload product media.');
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${productId}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage.from('product-media').upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  const { data } = supabase.storage.from('product-media').getPublicUrl(path);
  return data.publicUrl;
}

const SETTINGS_KEY = 'gpb_demo_store_settings_v1';
const DEFAULT_SETTINGS = { heroImage: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=90', heroTitle: 'Good food. Good homes. Good every day.', heroSubtitle: 'Your everyday kirana essentials, handpicked with care and brought closer to home.', promoImage: '', promoTitle: 'Fresh offers for your home', promoText: 'Everyday essentials, close to home.' };
export async function getStoreSettings() {
  if (!supabaseConfigured) { try { return { ...DEFAULT_SETTINGS, ...(JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')) }; } catch { return DEFAULT_SETTINGS; } }
  const { data, error } = await supabase.from('store_settings').select('payload').eq('id', 'homepage').maybeSingle();
  if (error) { if (error.code === '42P01' || error.code === 'PGRST205') return DEFAULT_SETTINGS; throw new Error(`Store settings could not be loaded: ${error.message}`); }
  return { ...DEFAULT_SETTINGS, ...(data?.payload || {}) };
}
export function subscribeStoreSettings(callback, onError = () => {}) {
  let active = true;
  const refresh = async () => { try { const settings = await getStoreSettings(); if (active) callback(settings); } catch (error) { if (active) onError(error); } };
  refresh();
  if (!supabaseConfigured) { const onUpdate = () => refresh(); window.addEventListener('gpb-settings-updated', onUpdate); window.addEventListener('storage', onUpdate); return () => { active = false; window.removeEventListener('gpb-settings-updated', onUpdate); window.removeEventListener('storage', onUpdate); }; }
  const channel = supabase.channel('store-settings-live').on('postgres_changes', { event: '*', schema: 'public', table: 'store_settings' }, refresh).subscribe();
  return () => { active = false; supabase.removeChannel(channel); };
}
export async function saveStoreSettings(settings) {
  const payload = { ...DEFAULT_SETTINGS, ...settings, updatedAt: new Date().toISOString() };
  if (!supabaseConfigured) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(payload)); window.dispatchEvent(new CustomEvent('gpb-settings-updated')); return payload; }
  const { error } = await supabase.from('store_settings').upsert({ id: 'homepage', payload, updated_at: payload.updatedAt });
  if (error) throw new Error(`Store settings could not be saved: ${error.message}. Run the storefront migration SQL in SETUP-HI.md first.`);
  return payload;
}
