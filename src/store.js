import { supabase, supabaseConfigured } from './supabase';
import { PRODUCTS } from './data';
import { transitionOrder, sanitizePublicTrackingOrder } from './orderLogic';
import { hasUsableProductImage } from './mediaUtils.js';
import { getProductCodes } from './catalogUtils';

const ORDER_KEY = 'gpb_demo_orders_v2';
const PRODUCT_KEY = 'gpb_demo_products_v2';
const read = (key, fallback=[]) => { try { const value = JSON.parse(localStorage.getItem(key) || 'null'); return Array.isArray(value) ? value : fallback; } catch { return fallback; } };
const write = (key, value, eventName) => { localStorage.setItem(key, JSON.stringify(value)); window.dispatchEvent(new CustomEvent(eventName)); };
const readDemoOrders = () => read(ORDER_KEY);
const hasProductImage = hasUsableProductImage;
const readDemoProducts = () => read(PRODUCT_KEY, PRODUCTS.map((p) => ({ ...p, active: hasProductImage(p), stock: 50 })));
export const isDemoMode = !supabaseConfigured;

export async function sendCustomerOtp(email) {
  if (!supabaseConfigured) throw new Error('Email verification needs Supabase setup. Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY first.');
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) throw new Error('Enter a valid email address.');
  // Redirect the email confirmation/magic link to the exact site origin where checkout was opened.
  // The origin must be listed in Supabase Authentication → URL Configuration → Redirect URLs.
  const emailRedirectTo = `${window.location.origin}/`;
  const { error } = await supabase.auth.signInWithOtp({
    email: normalizedEmail,
    options: { shouldCreateUser: true, emailRedirectTo }
  });
  if (error) {
    if (/redirect.*not allowed|redirect url/i.test(String(error.message || ''))) {
      throw new Error(`Supabase blocked the email redirect URL ${emailRedirectTo}. Add ${window.location.origin}/** in Authentication → URL Configuration → Redirect URLs, then resend the email.`);
    }
    if (/rate limit/i.test(String(error.message || ''))) {
      throw new Error('Supabase email rate limit reached. No email was sent for this attempt. Wait or configure custom SMTP before trying again.');
    }
    throw new Error(`Verification email could not be sent: ${error.message}`);
  }
  return normalizedEmail;
}

export async function verifyCustomerOtp(email, token) {
  if (!supabaseConfigured) throw new Error('Supabase is not configured.');
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const cleanToken = String(token || '').replace(/\s/g, '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) throw new Error('Enter a valid email address.');
  if (!/^\d{4,8}$/.test(cleanToken)) throw new Error('Enter the verification code received by email.');
  const { data, error } = await supabase.auth.verifyOtp({ email: normalizedEmail, token: cleanToken, type: 'email' });
  if (error) throw new Error(`Email verification failed: ${error.message}`);
  if (!data.session || String(data.user?.email || '').toLowerCase() !== normalizedEmail) throw new Error('Email verification did not create a signed-in session. Check the email OTP template and try again.');
  return data.user;
}

export async function getCurrentCustomerUser() {
  if (!supabaseConfigured) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(error.message);
  return data.session?.user?.email ? data.session.user : null;
}

export async function getMyCustomerOrders() {
  if (!supabaseConfigured) throw new Error('Cross-device order history needs Supabase setup.');
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw new Error(sessionError.message);
  if (!session?.user?.email) throw new Error('Verify your email address first.');
  const { data, error } = await supabase.rpc('get_my_orders_by_verified_email');
  if (error) throw new Error(`Order history could not be loaded: ${error.message}. Apply email-otp-migration.sql in Supabase first.`);
  return (data || []).map((item) => item?.payload || item).sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

export async function customerSignOut() {
  if (!supabaseConfigured) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}

function normalizeOrderRow(row) { return row?.payload || row; }
function normalizeProductRow(row) {
  if (!row || typeof row !== 'object') return row;
  const payload = row.payload && typeof row.payload === 'object' ? row.payload : null;
  const merged = payload ? { ...row, ...payload, id: row.id ?? payload.id } : { ...row };
  delete merged.payload;
  const barcode = getProductCodes(merged)[0] || '';
  return { ...merged, barcode: String(merged.barcode || barcode).trim() };
}

export async function saveOrder(order) {
  if (!supabaseConfigured) throw new Error('Live order placement is disabled because Supabase is not configured. Do not accept real customer orders in demo mode.');
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw new Error(`Could not check verified customer session: ${sessionError.message}`);
  const verifiedEmail = String(session?.user?.email || '').trim().toLowerCase();
  const checkoutEmail = String(order?.customer?.email || '').trim().toLowerCase();
  if (!verifiedEmail || verifiedEmail !== checkoutEmail) throw new Error('Verify the same email address entered at checkout before placing the order.');
  const { data, error } = await supabase.rpc('place_customer_order', { order_data: order });
  if (error) throw new Error(`Order could not be saved: ${error.message}. Check that email-otp-migration.sql is applied and every cart product exists in Supabase.`);
  return data?.payload || data || order;
}

export async function getOrder(trackingCode) {
  const code = String(trackingCode || '').trim().toUpperCase();
  if (!supabaseConfigured) return sanitizePublicTrackingOrder(readDemoOrders().find((order) => String(order.trackingCode || '').toUpperCase() === code) || null);
  const { data, error } = await supabase.rpc('get_order_for_tracking', { tracking_code_input: code });
  if (error) throw new Error(`Tracking lookup failed: ${error.message}`);
  return sanitizePublicTrackingOrder(data);
}

export function watchOrder(trackingCode, callback, onError = () => {}) {
  if (!trackingCode) return () => {};
  if (!supabaseConfigured) {
    const emit = () => { const order = readDemoOrders().find((item) => String(item.trackingCode || '').toUpperCase() === trackingCode.trim().toUpperCase()); if (order) callback(sanitizePublicTrackingOrder(order)); };
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

export async function refreshOrders() {
  if (!supabaseConfigured) return readDemoOrders().sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  const { data, error } = await supabase.from('orders').select('tracking_code,payload,created_at').order('created_at', { ascending: false });
  if (error) throw new Error(`Orders could not be refreshed: ${error.message}`);
  return (data || []).map(normalizeOrderRow);
}

export function subscribeOrders(callback, onError = () => {}, onStatus = () => {}) {
  if (!supabaseConfigured) {
    const emit = () => callback(readDemoOrders().sort((a,b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))));
    emit(); window.addEventListener('gpb-orders-updated', emit); window.addEventListener('storage', emit);
    onStatus('connected');
    return () => { window.removeEventListener('gpb-orders-updated', emit); window.removeEventListener('storage', emit); };
  }
  let active = true;
  let lastFetchError = '';
  const refresh = async () => {
    try {
      const rows = await refreshOrders();
      if (active) {
        callback(rows);
        if (lastFetchError) { lastFetchError = ''; onStatus('connected'); }
      }
    } catch (error) {
      if (active && lastFetchError !== error.message) { lastFetchError = error.message; onError(error); }
    }
  };
  refresh();
  // Realtime is fast, but periodic reads keep the admin list current during transient channel failures.
  const pollTimer = window.setInterval(refresh, 20_000);
  const channel = supabase.channel(`admin-orders-live-${Date.now()}`).on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, refresh).subscribe((status) => {
    if (!active) return;
    if (status === 'SUBSCRIBED') onStatus('connected');
    else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) onStatus('reconnecting');
  });
  return () => { active = false; window.clearInterval(pollTimer); supabase.removeChannel(channel); };
}

export async function setOrderStatus(trackingCode, status, note = '') {
  if (!supabaseConfigured) {
    const orders = readDemoOrders();
    const index = orders.findIndex((item) => item.trackingCode === trackingCode);
    if (index < 0) throw new Error('Order not found.');
    const original = orders[index];
    const updated = transitionOrder(original, status, new Date(), note);
    // Keep demo inventory consistent when a newly placed order is rejected.
    if (original.status === 'Placed' && ['Rejected', 'Cancelled'].includes(status)) {
      const quantities = new Map();
      for (const item of (original.items || [])) quantities.set(String(item.id), (quantities.get(String(item.id)) || 0) + Math.max(0, Number(item.quantity) || 0));
      const products = readDemoProducts().map((product) => quantities.has(String(product.id))
        ? { ...product, stock: Math.max(0, Number(product.stock) || 0) + quantities.get(String(product.id)) }
        : product);
      write(PRODUCT_KEY, products, 'gpb-products-updated');
    }
    orders[index] = updated;
    write(ORDER_KEY, orders, 'gpb-orders-updated');
    return updated;
  }
  const { data, error } = await supabase.rpc('admin_set_order_status', {
    tracking_code_input: trackingCode,
    next_status: status,
    note_input: note || '',
  });
  if (error) {
    const message = error.message || 'Unknown database error';
    if (/admin_set_order_status|function.*does not exist|schema cache/i.test(message)) {
      throw new Error(`Secure order-status update is not installed. Run security-inventory-hardening-migration.sql in the correct Supabase project first. Details: ${message}`);
    }
    throw new Error(`Status update failed: ${message}`);
  }
  if (!data) throw new Error('Status update returned no order. Check the admin role and the security migration.');
  return normalizeOrderRow(data);
}

export function watchAuth(callback) {
  if (!supabaseConfigured) { callback(null, 'SIGNED_OUT'); return () => {}; }
  let disposed = false;
  // Supabase warns against making further Supabase requests inside onAuthStateChange.
  // Defer the callback so the admin-role RPC runs outside the auth event lock.
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    const user = session?.user || null;
    window.setTimeout(() => { if (!disposed) callback(user, event); }, 0);
  });
  return () => { disposed = true; subscription.unsubscribe(); };
}

export async function sendAdminPasswordRecovery(email) {
  if (!supabaseConfigured) throw new Error('Supabase is not configured. Create .env.local from .env.example, then restart npm run dev.');
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) throw new Error('Enter the admin email first, then request a reset link.');
  const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, { redirectTo: window.location.origin });
  if (error) {
    if (/redirect.*not allowed|redirect url/i.test(String(error.message || ''))) {
      throw new Error(`Supabase blocked this reset URL. In Authentication → URL Configuration, add ${window.location.origin}/** to Redirect URLs, then try again.`);
    }
    throw new Error(error.message || 'Could not send reset email.');
  }
}

export async function updateAdminPassword(password) {
  if (!supabaseConfigured) throw new Error('Supabase is not configured.');
  const value = String(password || '');
  if (value.length < 8) throw new Error('Use a password with at least 8 characters.');
  const { data, error } = await supabase.auth.updateUser({ password: value });
  if (error) throw new Error(error.message || 'Password update failed.');
  return data.user;
}
export async function adminSignIn(email, password) {
  if (!supabaseConfigured) throw new Error('Supabase URL/key are missing in this project. Create .env.local from .env.example, fill the public Supabase URL and anon/publishable key, then restart npm run dev.');
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail || !String(password || '')) throw new Error('Enter both the admin email and password.');
  const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
  if (error) {
    const message = String(error.message || '');
    if (/invalid login credentials/i.test(message)) throw new Error('Email or password is incorrect, or this user has not been created in Supabase Authentication → Users. Check the account and password.');
    if (/email not confirmed/i.test(message)) throw new Error('This email is not confirmed in Supabase Auth. Confirm the admin user in Authentication → Users, then try again.');
    if (/fetch|network|failed to fetch/i.test(message)) throw new Error('Could not reach Supabase. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local, and restart the dev server.');
    throw new Error(message);
  }
  return data.user;
}
export async function adminSignOut() { if (supabaseConfigured) { const { error } = await supabase.auth.signOut(); if (error) throw error; } }
export async function isCurrentUserAdmin(user) {
  if (!supabaseConfigured || !user) return false;
  const { data, error } = await supabase.rpc('is_current_user_admin');
  if (error) {
    const message = String(error.message || '');
    if (/is_current_user_admin|function.*does not exist|schema cache/i.test(message) || error.code === 'PGRST202') {
      throw new Error('Supabase admin-role function is missing. Run supabase-schema.sql in Supabase SQL Editor, then assign this user the admin role using SETUP-HI.md.');
    }
    throw new Error(`Could not verify admin permissions: ${message}`);
  }
  return data === true;
}

export function subscribeProducts(callback, onError = () => {}) {
  if (!supabaseConfigured) {
    const emit = () => callback(readDemoProducts()); emit(); window.addEventListener('gpb-products-updated', emit); window.addEventListener('storage', emit);
    return () => { window.removeEventListener('gpb-products-updated', emit); window.removeEventListener('storage', emit); };
  }
  let active = true;
  let lastSignature = '';
  let refreshing = false;
  let refreshQueued = false;
  const refresh = async () => {
    if (!active) return;
    if (refreshing) { refreshQueued = true; return; }
    refreshing = true;
    try {
      // Read the live catalogue in stable pages. A single Supabase/PostgREST response can
      // be capped by the project's max_rows setting, which silently hides later products.
      const pageSize = 500;
      const { data: firstPage, error: firstError, count } = await supabase
        .from('products')
        .select('id,payload,active', { count: 'exact' })
        .order('id')
        .range(0, pageSize - 1);
      if (firstError) { if (active) onError(firstError); return; }
      const rows = [...(firstPage || [])];
      const totalRows = Number.isFinite(count) ? count : null;
      if (totalRows !== null) {
        for (let from = pageSize; from < totalRows; from += pageSize) {
          const { data: page, error } = await supabase
            .from('products')
            .select('id,payload,active')
            .order('id')
            .range(from, Math.min(from + pageSize - 1, totalRows - 1));
          if (error) { if (active) onError(error); return; }
          rows.push(...(page || []));
          if (!page?.length) break;
        }
      } else {
        // Fallback for APIs that do not return an exact count.
        for (let from = pageSize; rows.length >= from; from += pageSize) {
          const { data: page, error } = await supabase
            .from('products')
            .select('id,payload,active')
            .order('id')
            .range(from, from + pageSize - 1);
          if (error) { if (active) onError(error); return; }
          rows.push(...(page || []));
          if (!page || page.length < pageSize) break;
        }
      }
      // The database is the source of truth in live mode. Never inject demo/starter products.
      const products = rows.map((row) => {
        const normalized = normalizeProductRow(row);
        return { ...normalized, active: row.active === true && hasProductImage(normalized) };
      });
      const next = products.sort((a,b) => String(a.name).localeCompare(String(b.name)));
      const signature = JSON.stringify(next);
      if (active && signature !== lastSignature) {
        lastSignature = signature;
        callback(next);
      }
    } catch (error) {
      if (active) onError(error);
    } finally {
      refreshing = false;
      if (active && refreshQueued) {
        refreshQueued = false;
        refresh();
      }
    }
  };
  refresh();
  // Realtime can be unavailable on an unconfigured publication; periodic refresh keeps
  // product visibility and stock reasonably fresh on other customer devices.
  const pollTimer = window.setInterval(refresh, 45_000);
  const channel = supabase.channel('products-live').on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, refresh).subscribe();
  return () => { active = false; window.clearInterval(pollTimer); supabase.removeChannel(channel); };
}

export async function saveProduct(product) {
  const normalized = { ...product, video: String(product.video || '').trim(), id: String(product.id || `gpb-${Date.now().toString(36)}`), name: String(product.name || '').trim(), barcode: String(getProductCodes(product)[0] || '').trim(), category: String(product.category || 'Other'), size: String(product.size || '').trim(), price: Number(product.price), mrp: Number(product.mrp), stock: Math.max(0, Number(product.stock) || 0), active: product.active !== false && hasProductImage(product), updatedAt: new Date().toISOString() };
  if (!normalized.image && Array.isArray(normalized.images)) normalized.image = normalized.images.find((src) => typeof src === 'string' && src.trim()) || '';
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
  const allowedMediaTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm']);
  if (!allowedMediaTypes.has(String(file.type || '').toLowerCase())) throw new Error('Supported files are JPG, PNG, WebP, GIF, MP4 or WebM.');
  if (file.size <= 0 || file.size > 12 * 1024 * 1024) throw new Error('File must be smaller than 12 MB and not empty.');
  if (!supabaseConfigured) {
    if (file.type.startsWith('video/')) throw new Error('Video uploads need Supabase Storage. In demo mode, upload image files only.');
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('File could not be read.'));
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error('This image could not be decoded. Try a JPG, PNG or WebP image.'));
        image.onload = () => {
          try {
            const maxWidth = 1440;
            const scale = Math.min(1, maxWidth / image.width);
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(image.width * scale));
            canvas.height = Math.max(1, Math.round(image.height * scale));
            const context = canvas.getContext('2d');
            if (!context) throw new Error('Image compression is not supported in this browser.');
            context.drawImage(image, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', 0.78));
          } catch (error) { reject(error); }
        };
        image.src = String(reader.result);
      };
      reader.readAsDataURL(file);
    });
  }
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
const DEFAULT_SETTINGS = { heroImage: '/categories/atta-rice-dal.jpg', heroTitle: 'Good food. Good homes. Good every day.', heroSubtitle: 'Your everyday kirana essentials, handpicked with care and brought closer to home.', promoImage: '', promoImages: [], promoTitle: 'Offers for your everyday basket', promoText: 'Useful savings on the essentials your home needs.', deliveryFee: 25, freeDeliveryThreshold: 499, supportPhone: '', whatsappNumber: '', serviceablePincodes: ['824101'] };
const normalizeStoreSettings = (settings = {}) => {
  const legacy = settings.promoImage ? [settings.promoImage] : [];
  const images = Array.isArray(settings.promoImages) ? settings.promoImages : [];
  const deliveryFee = Number(settings.deliveryFee ?? DEFAULT_SETTINGS.deliveryFee);
  const freeDeliveryThreshold = Number(settings.freeDeliveryThreshold ?? DEFAULT_SETTINGS.freeDeliveryThreshold);
  const rawPins = settings.serviceablePincodes ?? DEFAULT_SETTINGS.serviceablePincodes;
  const serviceablePincodes = [...new Set((Array.isArray(rawPins) ? rawPins : String(rawPins || '').split(','))
    .map((value) => String(value || '').replace(/\D/g, ''))
    .filter((value) => /^\d{6}$/.test(value)))].slice(0, 100);
  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    deliveryFee: Number.isFinite(deliveryFee) ? Math.max(0, deliveryFee) : DEFAULT_SETTINGS.deliveryFee,
    freeDeliveryThreshold: Number.isFinite(freeDeliveryThreshold) ? Math.max(0, freeDeliveryThreshold) : DEFAULT_SETTINGS.freeDeliveryThreshold,
    supportPhone: String(settings.supportPhone || '').trim(),
    whatsappNumber: String(settings.whatsappNumber || '').trim(),
    serviceablePincodes: serviceablePincodes.length ? serviceablePincodes : DEFAULT_SETTINGS.serviceablePincodes,
    promoImages: [...new Set([...images, ...legacy].filter((value) => typeof value === 'string' && value.trim()))].slice(0, 8),
    promoImage: settings.promoImage || images[0] || '',
  };
};
export async function getStoreSettings() {
  if (!supabaseConfigured) { try { return normalizeStoreSettings(JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')); } catch { return normalizeStoreSettings(); } }
  const { data, error } = await supabase.from('store_settings').select('payload').eq('id', 'homepage').maybeSingle();
  if (error) { if (error.code === '42P01' || error.code === 'PGRST205') return DEFAULT_SETTINGS; throw new Error(`Store settings could not be loaded: ${error.message}`); }
  return normalizeStoreSettings(data?.payload || {});
}
export function subscribeStoreSettings(callback, onError = () => {}) {
  let active = true;
  const refresh = async () => { try { const settings = await getStoreSettings(); if (active) callback(settings); } catch (error) { if (active) onError(error); } };
  refresh();
  if (!supabaseConfigured) { const onUpdate = () => refresh(); window.addEventListener('gpb-settings-updated', onUpdate); window.addEventListener('storage', onUpdate); return () => { active = false; window.removeEventListener('gpb-settings-updated', onUpdate); window.removeEventListener('storage', onUpdate); }; }
  // Poll as a recovery path when Realtime is disabled or temporarily disconnected.
  const pollTimer = window.setInterval(refresh, 45_000);
  const channel = supabase.channel('store-settings-live').on('postgres_changes', { event: '*', schema: 'public', table: 'store_settings' }, refresh).subscribe();
  return () => { active = false; window.clearInterval(pollTimer); supabase.removeChannel(channel); };
}
export async function saveStoreSettings(settings) {
  const payload = { ...normalizeStoreSettings(settings), updatedAt: new Date().toISOString() };
  if (!supabaseConfigured) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(payload)); window.dispatchEvent(new CustomEvent('gpb-settings-updated')); return payload; }
  const { error } = await supabase.from('store_settings').upsert({ id: 'homepage', payload, updated_at: payload.updatedAt });
  if (error) throw new Error(`Store settings could not be saved: ${error.message}. Run the storefront migration SQL in SETUP-HI.md first.`);
  return payload;
}
