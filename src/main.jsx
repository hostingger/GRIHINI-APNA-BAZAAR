import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowDown, ArrowLeft, ArrowRight, BadgeCheck, Check, ChevronDown, ChevronLeft, ChevronRight, Clock3, MapPin, Menu, Minus, PackageCheck, Plus, Search, ShieldCheck, ShoppingBag, ShoppingCart, Store, Truck, X, LogIn, LogOut, Package, Phone, CircleCheck, CircleX, RefreshCw, ClipboardList, UserRound, Navigation, Leaf, Headphones, Heart, FileUp, Pencil, Trash2, Download, Upload, BarChart3, Tag, ImagePlus, LocateFixed, PackagePlus, MoreHorizontal, Sparkles, Home, Percent, Info } from 'lucide-react';
import { CATEGORIES, PRODUCTS } from './data';
import { makeOrderPayload, isPincodeServiceable } from './orderLogic';
import { adminSignIn, adminSignOut, getOrder, isCurrentUserAdmin, isDemoMode, saveOrder, setOrderStatus, subscribeOrders, refreshOrders, subscribeProducts, saveProduct, removeProduct, uploadProductMedia, watchAuth, watchOrder, subscribeStoreSettings, saveStoreSettings, sendCustomerOtp, verifyCustomerOtp, getMyCustomerOrders, getCurrentCustomerUser, customerSignOut, sendAdminPasswordRecovery, updateAdminPassword } from './store';
import './styles.css';
import { isFreshProduce, matchesProductSearch, normalizeSearchText, getProductCodes, compactSearchCode } from './catalogUtils';
import { ADMIN_EMAIL_RATE_LIMIT_COOLDOWN_MS, formatCooldownDuration, isEmailRateLimitError } from './authUiUtils';
import { csvCell, parseDelimitedObjects } from './csvUtils.js';
import { hasUsableProductImage, isUsableProductImage } from './mediaUtils.js';

const money = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);
const makeTrackingCode = () => { const bytes = new Uint8Array(8); if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes); else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256); return `GPB-${Array.from(bytes, (b) => (b % 36).toString(36)).join('').toUpperCase()}`; };
const blankCustomer = { name: '', phone: '', email: '', address: '', pincode: '', coordinates: '', landmark: '' };
const ORDER_HISTORY_KEY = 'gpb_order_history_v1';
const ADMIN_RESET_COOLDOWN_KEY = 'gpb_admin_reset_cooldown_until_v1';
const readAdminResetCooldown = () => {
  try { const until = Number(localStorage.getItem(ADMIN_RESET_COOLDOWN_KEY)); return Number.isFinite(until) && until > Date.now() ? until : null; }
  catch { return null; }
};
const loadOrderHistory = () => { try { const value = JSON.parse(localStorage.getItem(ORDER_HISTORY_KEY) || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } };
const hasProductImage = hasUsableProductImage;
const CATEGORY_FALLBACK_IMAGES = {
  'Atta & Rice': '/categories/atta-rice-dal.jpg',
  'Oil & Ghee': '/categories/oil-ghee.jpg',
  'Pulses & Dal': '/categories/atta-rice-dal.jpg',
  'Spices': '/categories/masala-spices.jpg',
  'Snacks & Packaged': '/categories/snacks.jpg',
  'Personal Care': '/categories/personal-care.jpg',
  'Household': '/categories/home-care.jpg',
  'Other': '/categories/snacks.jpg',
};
const HERO_FALLBACK_IMAGE = '/categories/atta-rice-dal.jpg';

function App() {
  const [category, setCategory] = useState('All items');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState(() => { try { return JSON.parse(localStorage.getItem('gpb_cart_v1') || '[]'); } catch { return []; } });
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productPage, setProductPage] = useState(0);
  const [storeSettings, setStoreSettings] = useState({ heroImage: HERO_FALLBACK_IMAGE, promoImage: '', promoImages: [], promoTitle: 'Offers for your everyday basket', promoText: 'Useful savings on the essentials your home needs.', deliveryFee: 25, freeDeliveryThreshold: 499, supportPhone: '', whatsappNumber: '', serviceablePincodes: ['824101'] });
  const [wishlist, setWishlist] = useState(() => { try { return JSON.parse(localStorage.getItem('gpb_wishlist_v1') || '[]'); } catch { return []; } });
  const [showWishlist, setShowWishlist] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [ordersHistory, setOrdersHistory] = useState(loadOrderHistory);
  const [ordersHistoryOpen, setOrdersHistoryOpen] = useState(false);
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerOtp, setCustomerOtp] = useState('');
  const [customerOtpSent, setCustomerOtpSent] = useState(false);
  const [customerAuthUser, setCustomerAuthUser] = useState(null);
  const [customerHistoryBusy, setCustomerHistoryBusy] = useState(false);
  const [customerHistoryEntries, setCustomerHistoryEntries] = useState([]);
  const [customerHistoryError, setCustomerHistoryError] = useState('');
  const [historyBusyCode, setHistoryBusyCode] = useState('');
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutOtpSent, setCheckoutOtpSent] = useState(false);
  const [checkoutOtp, setCheckoutOtp] = useState('');
  const [checkoutVerifiedPhone, setCheckoutVerifiedPhone] = useState('');
  const [checkoutOtpBusy, setCheckoutOtpBusy] = useState(false);
  const [checkoutOtpMessage, setCheckoutOtpMessage] = useState('');
  const [customer, setCustomer] = useState(blankCustomer);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [placedOrder, setPlacedOrder] = useState(null);
  const [trackOpen, setTrackOpen] = useState(false);
  const [trackCode, setTrackCode] = useState('');
  const [trackedOrder, setTrackedOrder] = useState(null);
  const [trackError, setTrackError] = useState('');
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminResetMode, setAdminResetMode] = useState(false);
  const [adminResetBusy, setAdminResetBusy] = useState(false);
  const [adminResetPassword, setAdminResetPassword] = useState('');
  const [adminResetConfirm, setAdminResetConfirm] = useState('');
  const [adminResetMessage, setAdminResetMessage] = useState('');
  const [adminResetCooldownUntil, setAdminResetCooldownUntil] = useState(readAdminResetCooldown);
  const [adminResetClock, setAdminResetClock] = useState(() => Date.now());
  const adminResetCooldownRemaining = Math.max(0, (adminResetCooldownUntil || 0) - adminResetClock);
  const adminResetIsRateLimited = adminResetCooldownRemaining > 0;
  const [adminUser, setAdminUser] = useState(null);
  const [adminAllowed, setAdminAllowed] = useState(false);
  const [adminRoleChecking, setAdminRoleChecking] = useState(false);
  const [adminError, setAdminError] = useState('');
  const [adminBusy, setAdminBusy] = useState(false);
  const [orders, setOrders] = useState([]);
  const [ordersRealtimeStatus, setOrdersRealtimeStatus] = useState('connecting');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [adminTab, setAdminTab] = useState('Orders');

  useEffect(() => { const unsubscribe = subscribeProducts((nextProducts) => { setProducts(nextProducts); setProductsLoading(false); }, (error) => { setNotice(error.message); setProductsLoading(false); }); return unsubscribe; }, []);
  useEffect(() => subscribeStoreSettings(setStoreSettings, (error) => setNotice(error.message)), []);
  useEffect(() => { localStorage.setItem('gpb_cart_v1', JSON.stringify(cart)); }, [cart]);
  useEffect(() => { localStorage.setItem('gpb_wishlist_v1', JSON.stringify(wishlist)); }, [wishlist]);
  useEffect(() => { localStorage.setItem(ORDER_HISTORY_KEY, JSON.stringify(ordersHistory.slice(0, 30))); }, [ordersHistory]);

  // When Supabase email sending is rate-limited, keep a visible, persistent retry countdown.
  useEffect(() => {
    if (!adminResetCooldownUntil) return undefined;
    const timer = window.setInterval(() => setAdminResetClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [adminResetCooldownUntil]);
  useEffect(() => {
    if (adminResetCooldownUntil && adminResetClock >= adminResetCooldownUntil) {
      try { localStorage.removeItem(ADMIN_RESET_COOLDOWN_KEY); } catch {}
      setAdminResetCooldownUntil(null);
    }
  }, [adminResetCooldownUntil, adminResetClock]);

  useEffect(() => {
    let disposed = false;
    let authCheckId = 0;
    const unsubscribe = watchAuth((user, authEvent) => {
      const checkId = ++authCheckId;
      if (disposed) return;
      // Email confirmation links sign the user in and return to the same origin.
      // Restore the verified email after redirect/reload so checkout can continue without a numeric code.
      if (user?.email && (user.email_confirmed_at || user.confirmed_at)) {
        const confirmedEmail = String(user.email).trim().toLowerCase();
        setCustomer((current) => ({ ...current, email: current.email || confirmedEmail }));
        setCheckoutVerifiedPhone((current) => current === confirmedEmail ? current : confirmedEmail);
        setCheckoutOtpSent(false);
        setCheckoutOtp('');
        setCheckoutOtpMessage('Email verified. You can now place your COD order.');
        setCustomerAuthUser(user);
      }
      if (authEvent === 'PASSWORD_RECOVERY') {
        setAdminOpen(true);
        setAdminResetMode(true);
        setAdminResetMessage('Reset link verified. Choose a temporary password of at least 8 characters.');
        setAdminResetPassword('');
        setAdminResetConfirm('');
      }
      setAdminUser(user);
      if (!user) {
        setAdminAllowed(false);
        setAdminRoleChecking(false);
        setAdminError('');
        return;
      }
      setAdminAllowed(false);
      setAdminRoleChecking(true);
      setAdminError('');
      isCurrentUserAdmin(user).then((allowed) => {
        if (disposed || checkId !== authCheckId) return;
        setAdminAllowed(allowed);
        setAdminRoleChecking(false);
        setAdminError(allowed ? '' : 'This account is signed in, but it does not have the admin role. Run the role-assignment SQL in SETUP-HI.md using the same admin email.');
      }).catch((error) => {
        if (disposed || checkId !== authCheckId) return;
        setAdminAllowed(false);
        setAdminRoleChecking(false);
        setAdminError(error.message || 'Could not check admin permissions. Verify the Supabase schema and user role.');
      });
    });
    return () => { disposed = true; unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!ordersHistoryOpen || isDemoMode) return;
    let active = true;
    getCurrentCustomerUser().then(async (user) => {
      if (!active || !user) return;
      setCustomerAuthUser(user);
      setCustomerPhone(user.email || '');
      try {
        const remoteOrders = await getMyCustomerOrders();
        if (!active) return;
        const entries = remoteOrders.map((order) => ({ trackingCode: order.trackingCode, createdAt: order.createdAt, total: order.total, status: order.status, items: order.items || [] }));
        setCustomerHistoryEntries(entries);
      } catch (error) { if (active) setCustomerHistoryError(error.message || 'Could not load order history.'); }
    }).catch((error) => { if (active) setCustomerHistoryError(error.message || 'Could not check customer session.'); });
    return () => { active = false; };
  }, [ordersHistoryOpen]);

  useEffect(() => {
    if (trackOpen && trackedOrder?.trackingCode) {
      return watchOrder(trackedOrder.trackingCode, setTrackedOrder, (error) => setTrackError(error.message));
    }
  }, [trackOpen, trackedOrder?.trackingCode]);

  useEffect(() => {
    if (adminOpen && adminAllowed && !isDemoMode) return subscribeOrders(setOrders, (error) => setAdminError(error.message), setOrdersRealtimeStatus);
  }, [adminOpen, adminAllowed]);

  const visibleCategories = useMemo(() => CATEGORIES.filter((item) => item === 'All items' || !isFreshProduce({ name: '', category: item })), []);
  useEffect(() => { setProductPage(0); }, [search, category, showWishlist]);
  const publicSearchActive = Boolean(normalizeSearchText(search));
  // An entered search (especially a scanned barcode) searches across the full live catalogue,
  // not only the previously selected category or wishlist. Normal category filters apply when search is empty.
  const filtered = useMemo(() => products.filter((product) =>
    product.active !== false && hasProductImage(product) && !isFreshProduce(product) &&
    (publicSearchActive || !showWishlist || wishlist.includes(product.id)) &&
    (publicSearchActive || category === 'All items' || product.category === category) &&
    matchesProductSearch(product, search)
  ), [products, category, search, publicSearchActive, showWishlist, wishlist]);
  const visibleCustomerProducts = filtered.slice(0, (productPage + 1) * 24);
  const hasMoreCustomerProducts = visibleCustomerProducts.length < filtered.length;
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const freeDeliveryThreshold = Math.max(0, Number(storeSettings.freeDeliveryThreshold ?? 499) || 0);
  const standardDeliveryFee = Math.max(0, Number(storeSettings.deliveryFee ?? 25) || 0);
  const deliveryFee = subtotal >= freeDeliveryThreshold ? 0 : standardDeliveryFee;
  const total = subtotal + deliveryFee;
  const updateQuantity = (product, change) => setCart((items) => {
    const found = items.find((item) => item.id === product.id);
    const currentQuantity = found?.quantity || 0;
    const stock = Number.isFinite(Number(product.stock)) ? Number(product.stock) : 999999;
    if (change > 0 && currentQuantity + change > stock) { setNotice(stock <= 0 ? `${product.name} is currently out of stock.` : `Only ${stock} unit(s) of ${product.name} are available.`); return items; }
    if (!found && change > 0) return [...items, { ...product, quantity: 1 }];
    return items.map((item) => item.id === product.id ? { ...product, quantity: item.quantity + change } : item).filter((item) => item.quantity > 0);
  });

  async function sendCheckoutOtp() {
    setCheckoutOtpBusy(true); setCheckoutOtpMessage('');
    try {
      if (isDemoMode) throw new Error('Live ordering is not connected yet. Configure Supabase in .env.local and Vercel before accepting customer orders.');
      const email = await sendCustomerOtp(customer.email);
      setCustomer((current) => ({ ...current, email }));
      setCheckoutOtpSent(true); setCheckoutOtp(''); setCheckoutVerifiedPhone('');
      setCheckoutOtpMessage(`Email sent to ${email}. Check Inbox and Spam. If it says “Confirm your email address”, open that link on this same site, then return to checkout and press “Verify email” with the code box empty. If the email contains a numeric code instead, enter that code.`);
    } catch (error) { setCheckoutOtpMessage(error.message || 'Could not send email code. Check Supabase email settings.'); }
    finally { setCheckoutOtpBusy(false); }
  }

  async function verifyCheckoutOtp() {
    setCheckoutOtpBusy(true); setCheckoutOtpMessage('');
    try {
      const email = String(customer.email || '').trim().toLowerCase();
      if (!email) throw new Error('Enter your email address first.');

      // First support Supabase's default confirmation-link email. After the user taps the link
      // and returns to this same site/browser, Supabase stores a verified session.
      const currentUser = await getCurrentCustomerUser();
      if (currentUser && String(currentUser.email || '').trim().toLowerCase() === email && (currentUser.email_confirmed_at || currentUser.confirmed_at)) {
        setCustomer((current) => ({ ...current, email }));
        setCheckoutVerifiedPhone(email);
        setCheckoutOtpSent(false);
        setCheckoutOtp('');
        setCustomerAuthUser(currentUser);
        setCheckoutOtpMessage('Email verified. You can now place your COD order.');
        return;
      }

      // If this project sends a numeric OTP template, keep that route working too.
      if (!String(checkoutOtp || '').trim()) {
        throw new Error('No verified session found yet. If your email says “Confirm your email address”, open that link on this same site/browser, return here, and press Verify email again. If it shows a numeric code, enter the code above.');
      }
      const user = await verifyCustomerOtp(email, checkoutOtp);
      if (String(user.email || '').trim().toLowerCase() !== email) throw new Error('The verified email does not match the checkout email.');
      setCustomer((current) => ({ ...current, email }));
      setCheckoutVerifiedPhone(email); setCheckoutOtpSent(false); setCheckoutOtp('');
      setCustomerAuthUser(user);
      setCheckoutOtpMessage('Email verified. You can now place your COD order.');
    } catch (error) { setCheckoutOtpMessage(error.message || 'Email verification failed. Please try again.'); }
    finally { setCheckoutOtpBusy(false); }
  }

  async function placeOrder(event) {
    event.preventDefault(); setNotice('');
    if (isDemoMode) { setNotice('Order not sent: live database is not connected. Configure Supabase, run the SQL migrations and redeploy Preview before taking real orders.'); return; }
    const verifiedEmail = String(checkoutVerifiedPhone || '').trim().toLowerCase();
    const orderEmail = String(customer.email || '').trim().toLowerCase();
    if (!verifiedEmail || verifiedEmail !== orderEmail) { setNotice('Please verify the same email address before placing the order.'); setCheckoutOtpMessage('Verify your email address to continue.'); return; }
    if (!isPincodeServiceable(customer.pincode, storeSettings.serviceablePincodes)) { setNotice(`We currently deliver only to these PIN codes: ${(storeSettings.serviceablePincodes || ['824101']).join(', ')}. Please confirm your delivery PIN code.`); return; }
    setBusy(true);
    try {
      const order = makeOrderPayload({ customer: { ...customer, email: verifiedEmail }, items: cart, subtotal, deliveryFee, notes }, makeTrackingCode());
      await saveOrder(order);
      const historyEntry = { trackingCode: order.trackingCode, createdAt: order.createdAt, total: order.total, status: order.status, items: order.items.map(({ id, name, size, price, quantity, image }) => ({ id, name, size, price, quantity, image })) };
      setOrdersHistory((current) => [historyEntry, ...current.filter((item) => item.trackingCode !== order.trackingCode)].slice(0, 30));
      setPlacedOrder(order); setCart([]); setCheckoutOpen(false); setCartOpen(false); setCustomer(blankCustomer); setNotes(''); setCheckoutVerifiedPhone(''); setCheckoutOtpSent(false); setCheckoutOtp(''); setCheckoutOtpMessage(''); setTrackedOrder(order); setTrackCode(order.trackingCode); setTrackOpen(true);
      setNotice('Your order has been placed successfully.');
    } catch (error) { setNotice(error.message || 'Could not place order. Please try again.'); }
    finally { setBusy(false); }
  }

  async function trackOrder(event) {
    event?.preventDefault(); setTrackError(''); setTrackedOrder(null);
    try { const order = await getOrder(trackCode); if (!order) setTrackError('Order not found. Check the tracking code and try again.'); else { setTrackedOrder(order); setOrdersHistory((current) => current.map((item) => item.trackingCode === order.trackingCode ? { ...item, createdAt: order.createdAt, total: order.total, status: order.status, items: order.items.map(({ id, name, size, price, quantity, image }) => ({ id, name, size, price, quantity, image })) } : item)); } }
    catch (error) { setTrackError(error.message || 'Could not look up this order.'); }
  }

  async function refreshHistoryOrder(entry) {
    setHistoryBusyCode(entry.trackingCode);
    try { const order = await getOrder(entry.trackingCode); if (!order) throw new Error('Order not found.'); const refreshed = { ...entry, status: order.status, createdAt: order.createdAt, total: order.total, items: order.items.map(({ id, name, size, price, quantity, image }) => ({ id, name, size, price, quantity, image })) }; setOrdersHistory((current) => current.map((item) => item.trackingCode === entry.trackingCode ? { ...item, ...refreshed } : item)); setCustomerHistoryEntries((current) => current.map((item) => item.trackingCode === entry.trackingCode ? { ...item, ...refreshed } : item)); }
    catch (error) { setNotice(error.message || 'Could not refresh order status.'); }
    finally { setHistoryBusyCode(''); }
  }

  async function loginAdmin(event) {
    event.preventDefault(); setAdminBusy(true); setAdminError(''); setAdminResetMessage('');
    try {
      await adminSignIn(adminEmail, adminPassword);
      // The auth listener checks the user's role. A signed-in non-admin is not shown the dashboard.
    } catch (error) { setAdminError(error.message || 'Unable to sign in.'); }
    finally { setAdminBusy(false); }
  }

  async function requestAdminReset(event) {
    event?.preventDefault();
    if (adminResetIsRateLimited) {
      setAdminResetMessage(`Email sending is still paused by the cooldown. Estimated retry in ${formatCooldownDuration(adminResetCooldownRemaining)}; this is a conservative local estimate, not an exact time from Supabase.`);
      return;
    }
    setAdminResetBusy(true); setAdminResetMessage(''); setAdminError('');
    try {
      await sendAdminPasswordRecovery(adminEmail);
      setAdminResetMessage('Request accepted. If this email belongs to an account, a reset link should arrive. Check Inbox and Spam; open the link on this same site.');
    } catch (error) {
      if (isEmailRateLimitError(error)) {
        const until = Date.now() + ADMIN_EMAIL_RATE_LIMIT_COOLDOWN_MS;
        try { localStorage.setItem(ADMIN_RESET_COOLDOWN_KEY, String(until)); } catch {}
        setAdminResetClock(Date.now());
        setAdminResetCooldownUntil(until);
        setAdminResetMessage('Supabase blocked this reset-email request because the project email limit was reached. No reset email was sent for this attempt.');
      } else {
        setAdminResetMessage(error.message || 'Could not send a password reset email.');
      }
    } finally { setAdminResetBusy(false); }
  }

  async function saveAdminReset(event) {
    event.preventDefault(); setAdminResetMessage(''); setAdminError('');
    if (adminResetPassword.length < 8) { setAdminResetMessage('Use at least 8 characters for the temporary password.'); return; }
    if (adminResetPassword !== adminResetConfirm) { setAdminResetMessage('The two password fields do not match.'); return; }
    setAdminResetBusy(true);
    try {
      await updateAdminPassword(adminResetPassword);
      setAdminResetMode(false);
      setAdminResetPassword(''); setAdminResetConfirm(''); setAdminPassword('');
      setAdminResetMessage('Password updated successfully. Checking your admin permissions…');
    } catch (error) {
      setAdminResetMessage(error.message || 'Could not update the password. Request a fresh reset link and try again.');
    } finally { setAdminResetBusy(false); }
  }

  async function changeStatus(order, status) {
    setAdminError('');
    try {
      const updatedOrder = await setOrderStatus(order.trackingCode, status);
      // Update the UI immediately instead of relying solely on Supabase Realtime.
      setOrders((current) => current.map((item) => item.trackingCode === updatedOrder.trackingCode ? updatedOrder : item));
      if (trackedOrder?.trackingCode === order.trackingCode) setTrackedOrder(updatedOrder);
    } catch (error) {
      setAdminError(error.message || 'Status update failed.');
    }
  }

  const activeOrders = orders.filter((order) => !['Delivered', 'Rejected', 'Cancelled'].includes(order.status));

  const visibleOrderHistory = customerAuthUser ? customerHistoryEntries : ordersHistory;

  return <div className="app-shell">
    <div className="topline"><div className="wrap topline-inner"><span><MapPin size={13} /> Serving Aurangabad and nearby areas</span><span className="topline-right"><ShieldCheck size={13} /> Everyday essentials. Delivered with care.</span></div></div>
    <header className="site-header"><div className="wrap header-inner">
      <button className="icon-btn mobile-menu-btn" aria-label="Open menu" onClick={() => setMobileMenu(!mobileMenu)}><Menu /></button>
      <button className="brand" aria-label="Go to Grihini Apna Bazaar home" onClick={() => { setAdminOpen(false); setMobileMenu(false); setCategory('All items'); setSearch(''); setShowWishlist(false); window.scrollTo({ top: 0, behavior: 'smooth' }); document.getElementById('home-top')?.focus?.({preventScroll:true}); }}><span className="brand-mark"><Store size={24} /></span><span className="brand-copy"><strong>Grihini <em>Apna Bazaar</em></strong><small>GOODNESS FOR EVERY HOME</small></span></button>
      <div className="searchbox"><Search size={18} /><input value={search} onChange={(e) => { const next = e.target.value; setSearch(next); if (next.trim()) { setCategory('All items'); setShowWishlist(false); } if (!search.trim() && next.trim()) window.setTimeout(() => document.getElementById('shop')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80); }} onKeyDown={(e) => { if (e.key === 'Enter') { setCategory('All items'); setShowWishlist(false); document.getElementById('shop')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }} placeholder="Search product name or scan barcode…" aria-label="Search products by name, category or barcode" /><kbd>⌕</kbd></div>
      <div className="header-actions"><button className="track-link" onClick={() => setOrdersHistoryOpen(true)}><ClipboardList size={18} /><span>My orders</span></button><button className="track-link" onClick={() => { setTrackOpen(true); setTrackedOrder(null); setTrackError(''); }}><Package size={18} /><span>Track order</span></button><button className="cart-button" onClick={() => setCartOpen(true)}><ShoppingCart size={19} /><span>My cart</span><b>{cartCount}</b></button></div>
    </div>
      {mobileMenu && <div className="mobile-menu wrap"><div className="mobile-menu-title"><strong>Explore Grihini</strong><button className="icon-btn" aria-label="Close menu" onClick={() => setMobileMenu(false)}><X size={18}/></button></div><button onClick={() => { setAdminOpen(false); setCategory('All items'); setShowWishlist(false); setMobileMenu(false); document.getElementById('shop')?.scrollIntoView({behavior:'smooth'}); }}><ShoppingBag size={17}/> Shop all products <ChevronRight size={16}/></button><button onClick={() => { setShowWishlist(true); setCategory('All items'); setAdminOpen(false); setMobileMenu(false); window.setTimeout(() => document.getElementById('shop')?.scrollIntoView({behavior:'smooth', block:'start'}), 30); }}><Heart size={17}/> My wishlist <ChevronRight size={16}/></button><button onClick={() => { setOrdersHistoryOpen(true); setMobileMenu(false); }}><ClipboardList size={17}/> My orders <ChevronRight size={16}/></button><button onClick={() => { setTrackOpen(true); setTrackError(''); setMobileMenu(false); }}><Package size={17}/> Track an order <ChevronRight size={16}/></button><button onClick={() => { setCategory('All items'); setSearch(''); setAdminOpen(false); setMobileMenu(false); document.getElementById('shop')?.scrollIntoView({behavior:'smooth'}); }}><Percent size={17}/> Offers & popular picks <ChevronRight size={16}/></button><button onClick={() => { setMobileMenu(false); document.getElementById('store-info')?.scrollIntoView({behavior:'smooth'}); }}><Info size={17}/> About our store <ChevronRight size={16}/></button></div>}
    </header>

    {adminOpen ? <AdminDashboard storeSettings={storeSettings} setStoreSettings={setStoreSettings} orders={orders} setOrders={setOrders} activeOrders={activeOrders} adminError={adminError} setAdminError={setAdminError} adminAllowed={adminAllowed} setAdminAllowed={setAdminAllowed} adminRoleChecking={adminRoleChecking} adminUser={adminUser} adminEmail={adminEmail} setAdminEmail={setAdminEmail} adminPassword={adminPassword} setAdminPassword={setAdminPassword} adminBusy={adminBusy} setAdminBusy={setAdminBusy} loginAdmin={loginAdmin} requestAdminReset={requestAdminReset} saveAdminReset={saveAdminReset} adminResetMode={adminResetMode} adminResetBusy={adminResetBusy} adminResetPassword={adminResetPassword} setAdminResetPassword={setAdminResetPassword} adminResetConfirm={adminResetConfirm} setAdminResetConfirm={setAdminResetConfirm} adminResetMessage={adminResetMessage} adminResetIsRateLimited={adminResetIsRateLimited} adminResetCooldownRemaining={adminResetCooldownRemaining} changeStatus={changeStatus} products={products} setProducts={setProducts} ordersRealtimeStatus={ordersRealtimeStatus} onBack={() => setAdminOpen(false)} /> : <main>
      <section className="hero"><div className="wrap hero-grid"><div className="hero-copy"><div className="hero-kicker"><span className="kicker-dot" /> YOUR NEIGHBOURHOOD GROCERY STORE</div><h1>Your everyday<br /><span>groceries,</span><br />made easy.</h1><p>The everyday kirana items your home needs, with local delivery in Aurangabad.</p><div className="hero-actions"><button className="btn btn-primary" onClick={() => document.getElementById('shop').scrollIntoView({ behavior: 'smooth' })}>Shop essentials <ArrowRight size={17} /></button><button className="text-btn" onClick={() => { setTrackOpen(true); setTrackedOrder(null); }}>Track an order <ArrowRight size={16} /></button></div><div className="hero-points"><span><Check size={15} /> Quality essentials</span><span><Check size={15} /> Easy COD</span><span><Check size={15} /> Local delivery</span></div></div><div className="hero-visual"><div className="hero-image"><img src={storeSettings.heroImage || HERO_FALLBACK_IMAGE} alt="Packaged grocery essentials in a local store" onError={(event) => { if (event.currentTarget.dataset.fallback !== 'true') { event.currentTarget.dataset.fallback = 'true'; event.currentTarget.src = HERO_FALLBACK_IMAGE; setStoreSettings((previous) => ({ ...previous, heroImage: HERO_FALLBACK_IMAGE })); } else { event.currentTarget.style.visibility = 'hidden'; } }} /></div><div className="floating-note"><span className="float-icon"><Leaf size={18} /></span><span><strong>Care in every basket</strong><small>Your local everyday store</small></span></div><div className="hero-stamp"><strong>₹</strong><span>LOCAL<br />LOVE</span></div></div></div></section>
      <section className="category-showcase wrap" aria-label="Shop by category"><div className="category-showcase-head"><div><span className="eyebrow">SHOP BY CATEGORY</span><h2>What do you need today?</h2></div><button className="text-btn" onClick={() => { setCategory('All items'); document.getElementById('shop')?.scrollIntoView({behavior:'smooth'}); }}>View all <ArrowRight size={15}/></button></div><div className="category-tiles">{CATEGORIES.filter((item) => item !== 'All items').filter((item) => !/vegetable|fruit|produce/i.test(item)).slice(0,7).map((item) => { const categoryProduct = products.find((p) => p.category === item && p.active !== false && !isFreshProduce(p)); return <button className={`category-tile ${category === item ? 'selected' : ''}`} key={item} onClick={() => { setCategory(item); setShowWishlist(false); document.getElementById('shop')?.scrollIntoView({behavior:'smooth'}); }}><span className="category-tile-image"><img src={categoryProduct?.image || CATEGORY_FALLBACK_IMAGES[item] || CATEGORY_FALLBACK_IMAGES.Other} alt={`${item} category`} loading="lazy" onError={(event) => { const fallback = CATEGORY_FALLBACK_IMAGES[item] || CATEGORY_FALLBACK_IMAGES.Other; if (event.currentTarget.dataset.fallback !== 'true') { event.currentTarget.dataset.fallback = 'true'; event.currentTarget.src = fallback; } else { event.currentTarget.style.visibility = 'hidden'; } }} /></span><strong>{item}</strong><small>See products <ArrowRight size={12}/></small></button>; })}</div></section>
      <PromoCarousel settings={storeSettings} onShop={() => document.getElementById('shop')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} />
      <section className="benefits"><div className="wrap benefits-grid"><div className="benefit"><span className="benefit-icon"><BadgeCheck /></span><span><strong>Everyday essentials</strong><small>For your whole household</small></span></div><div className="benefit"><span className="benefit-icon"><Truck /></span><span><strong>Local delivery</strong><small>Aurangabad & nearby</small></span></div><div className="benefit"><span className="benefit-icon"><ShieldCheck /></span><span><strong>Pay on delivery</strong><small>No online payment needed</small></span></div><div className="benefit"><span className="benefit-icon"><Headphones /></span><span><strong>Here to help</strong><small>Friendly local service</small></span></div></div></section>
      <section className="shop-section wrap" id="shop"><div className="section-heading"><div><div className="eyebrow">IN THE SHOP</div><h2>Everyday groceries</h2><p>Your regular essentials, ready to add to your basket.</p></div><div className="product-count">{productsLoading ? 'Loading products' : products.length === 0 ? 'Catalog setup needed' : `${filtered.length} products`} <ArrowDown size={15} /></div></div>
        <div className="category-toolbar"><div className="category-row"><button className={`category-chip ${category === 'All items' && !showWishlist ? 'active' : ''}`} onClick={() => { setShowWishlist(false); setCategory('All items'); }}>All items</button>{visibleCategories.filter((item) => item !== 'All items').map((item) => <button key={item} className={`category-chip ${category === item && !showWishlist ? 'active' : ''}`} onClick={() => { setShowWishlist(false); setCategory(item); }}>{item}</button>)}</div><button className={`wishlist-filter ${showWishlist ? 'active' : ''}`} onClick={() => { const next = !showWishlist; setShowWishlist(next); setCategory('All items'); if (next) window.setTimeout(() => document.getElementById('shop')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30); }}><Heart size={15} fill={showWishlist ? 'currentColor' : 'none'}/><span>{showWishlist ? 'Showing saved' : 'Wishlist'}</span><b>{wishlist.length}</b></button></div>
        {productsLoading ? <div className="empty-state" role="status"><RefreshCw size={24} /><h3>Loading products…</h3><p>Fetching the latest available products.</p></div> : filtered.length ? <><div className="product-grid">{visibleCustomerProducts.map((product) => <article className="product-card" key={product.id}><ProductImageCarousel product={product} wishlist={wishlist} setWishlist={setWishlist} cart={cart} updateQuantity={updateQuantity} onOpenDetails={setSelectedProduct} /></article>)}</div>{hasMoreCustomerProducts && <div className="catalog-load-more"><span>Showing {visibleCustomerProducts.length} of {filtered.length} products</span><button className="btn btn-ghost" onClick={()=>setProductPage((page)=>page+1)}>Load more products <ChevronDown size={16}/></button></div>}</> : <div className="empty-state catalog-empty"><Search size={35} /><h3>{products.length === 0 ? 'Our catalogue is being stocked' : (publicSearchActive && /^[\d\s-]{6,}$/.test(search) ? 'No product is saved with this barcode' : 'No products found')}</h3><p>{products.length === 0 ? 'The live product catalogue has no published items yet. Please check back soon.' : (publicSearchActive && /^[\d\s-]{6,}$/.test(search) ? 'Check the barcode digits. Barcode search only works when the code is saved in that product in Admin → Products or included in the product import file.' : 'Try another product name, barcode or category.')}</p>{products.length > 0 && (search || category !== 'All items' || showWishlist) && <button className="btn btn-ghost" onClick={() => { setSearch(''); setCategory('All items'); setShowWishlist(false); }}>Clear filters</button>}</div>}
      </section>
      <section className="delivery-banner"><div className="wrap delivery-inner"><div className="delivery-art"><div className="delivery-circle"><ShoppingBag size={42} /></div><span className="spark spark-one">✦</span><span className="spark spark-two">✳</span></div><div><div className="eyebrow">FROM OUR STORE TO YOUR DOOR</div><h2>Your shopping list.<br /><em>Sorted.</em></h2><p>Choose what you need, place a COD order, and pay when it arrives.</p></div><button className="btn btn-light" onClick={() => document.getElementById('shop').scrollIntoView({ behavior: 'smooth' })}>Browse products <ArrowRight size={17} /></button></div></section>
    </main>}

    <footer className="site-footer" id="store-info"><div className="wrap footer-main"><div className="footer-brand"><div className="brand"><span className="brand-mark"><Store size={23} /></span><span className="brand-copy"><strong>Grihini <em>Apna Bazaar</em></strong><small>GOODNESS FOR EVERY HOME</small></span></div><p>Your neighbourhood partner for the everyday essentials that make a house feel like home.</p></div><div className="footer-col"><strong>Explore</strong><button onClick={() => { setAdminOpen(false); document.getElementById('shop')?.scrollIntoView({ behavior: 'smooth' }); }}>Shop essentials</button><button onClick={() => setTrackOpen(true)}>Track your order</button><button onClick={() => { setAdminOpen(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Store admin sign-in</button></div><div className="footer-col"><strong>Visit our store</strong><span><MapPin size={15} /> Old G.T. Road, Aurangabad,<br /> Bihar – 824101</span><span><Clock3 size={15} /> Local delivery in service area</span>{storeSettings.supportPhone ? <a href={`tel:${String(storeSettings.supportPhone).replace(/[^+\d]/g, '')}`}><Phone size={15} /> {storeSettings.supportPhone}</a> : <span><Phone size={15} /> Contact details coming soon</span>}{(storeSettings.whatsappNumber || storeSettings.supportPhone) && <a href={`https://wa.me/${String(storeSettings.whatsappNumber || storeSettings.supportPhone).replace(/\D/g, '')}`} target="_blank" rel="noreferrer"><Phone size={15} /> WhatsApp support</a>}</div></div><div className="wrap footer-bottom"><span>© Grihini Apna Bazaar Private Limited, 2026 — Developed by AbhiWeb</span><span>Made for local homes <span className="heart">♥</span> · Prices in INR</span></div></footer>

    {notice && <div className={`toast ${notice.includes('successfully') ? 'success' : 'error'}`}><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Dismiss"><X size={16} /></button></div>}

    {selectedProduct && <div className="overlay product-detail-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelectedProduct(null); }}><section className="modal product-detail-modal" role="dialog" aria-modal="true" aria-label={`${selectedProduct.name} details`}><div className="modal-head"><div><span className="eyebrow">PRODUCT DETAILS</span><h2>{selectedProduct.name}</h2><p>{selectedProduct.category} · {selectedProduct.size}</p></div><button className="icon-btn" onClick={() => setSelectedProduct(null)} aria-label="Close product details"><X /></button></div><div className="product-detail-content"><img src={selectedProduct.image} alt={selectedProduct.name} onError={(e)=>{e.currentTarget.onerror=null;e.currentTarget.src='/favicon.svg';}}/>{selectedProduct.video && <video className="product-detail-video" src={selectedProduct.video} controls preload="metadata" aria-label={`${selectedProduct.name} product video`}/>}<div className="product-detail-copy"><span className="product-category">{selectedProduct.category}</span><h3>{selectedProduct.name}</h3><p>{selectedProduct.description || 'A handy everyday grocery essential for your home.'}</p><div className="product-detail-price"><strong>{money(selectedProduct.price)}</strong>{Number(selectedProduct.mrp)>Number(selectedProduct.price)&&<del>{money(selectedProduct.mrp)}</del>}</div><p className="product-detail-size">Pack size: {selectedProduct.size}</p><div className="product-detail-actions"><button className="btn btn-primary" onClick={() => { updateQuantity(selectedProduct,1); setSelectedProduct(null); }}><ShoppingCart size={16}/> Add to cart</button><button className="btn btn-ghost" onClick={() => setWishlist((items)=>items.includes(selectedProduct.id)?items.filter((id)=>id!==selectedProduct.id):[...items,selectedProduct.id])}><Heart size={16}/> {wishlist.includes(selectedProduct.id)?'Saved to wishlist':'Add to wishlist'}</button></div></div></div></section></div>}

    {cartOpen && <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setCartOpen(false); }}><aside className="drawer"><div className="drawer-head"><div><span className="eyebrow">YOUR BASKET</span><h2>My cart <span>({cartCount})</span></h2></div><button className="icon-btn" onClick={() => setCartOpen(false)} aria-label="Close cart"><X /></button></div>{cart.length === 0 ? <div className="empty-state cart-empty"><ShoppingBag size={43} /><h3>Your basket is waiting</h3><p>Add a few everyday essentials to get started.</p><button className="btn btn-primary" onClick={() => { setCartOpen(false); document.getElementById('shop')?.scrollIntoView({ behavior: 'smooth' }); }}>Explore products</button></div> : <><div className="drawer-items">{cart.map((item) => <div className="cart-item" key={item.id}><img src={item.image} alt="" /><div className="cart-item-info"><strong>{item.name}</strong><small>{item.size}</small><b>{money(item.price * item.quantity)}</b></div><div className="qty-control"><button onClick={() => updateQuantity(item, -1)} aria-label="Decrease quantity"><Minus size={13} /></button><span>{item.quantity}</span><button onClick={() => updateQuantity(item, 1)} aria-label="Increase quantity"><Plus size={13} /></button></div></div>)}</div><div className="drawer-summary"><div className="delivery-progress"><span className="progress-icon"><Truck size={17} /></span><span>{subtotal >= freeDeliveryThreshold ? 'You unlocked free delivery!' : `Add ${money(freeDeliveryThreshold - subtotal)} more for free delivery`}</span></div><div className="summary-line"><span>Subtotal</span><strong>{money(subtotal)}</strong></div><div className="summary-line"><span>Delivery fee</span><strong>{deliveryFee === 0 ? 'FREE' : money(deliveryFee)}</strong></div><div className="summary-line summary-total"><span>Total</span><strong>{money(total)}</strong></div><button className="btn btn-primary full-btn" onClick={() => { setCartOpen(false); setCheckoutOpen(true); }}>Continue to checkout <ArrowRight size={17} /></button><p className="secure-note"><ShieldCheck size={14} /> Cash on delivery · No online payment</p></div></>}</aside></div>}

    {checkoutOpen && <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setCheckoutOpen(false); }}><section className="modal checkout-modal"><div className="modal-head"><div><span className="eyebrow">JUST A FEW DETAILS</span><h2>Delivery details</h2><p>We’ll bring your basket to your doorstep.</p></div><button className="icon-btn" onClick={() => setCheckoutOpen(false)} aria-label="Close checkout"><X /></button></div><form onSubmit={placeOrder} className="checkout-form"><div className="form-grid"><label>Full name *<input required minLength={2} value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} placeholder="Name on the order" /></label><label>Mobile number *<input required type="tel" autoComplete="tel" minLength={10} maxLength={16} value={customer.phone} onChange={(e) => setCustomer((current) => ({ ...current, phone: e.target.value }))} placeholder="10-digit mobile number" /></label><label>Email address *<input required type="email" autoComplete="email" value={customer.email} onChange={(e) => { setCustomer((current) => ({ ...current, email: e.target.value })); setCheckoutVerifiedPhone(''); setCheckoutOtpSent(false); setCheckoutOtp(''); setCheckoutOtpMessage(''); }} placeholder="you@example.com" /></label></div>{checkoutVerifiedPhone && checkoutVerifiedPhone === String(customer.email || '').trim().toLowerCase() ? <div className="checkout-phone-verified"><ShieldCheck size={17}/><span>Email verified: {checkoutVerifiedPhone}</span><button type="button" className="text-btn" onClick={()=>{setCheckoutVerifiedPhone('');setCheckoutOtpSent(false);setCheckoutOtpMessage('Verify the email address to continue.');}}>Change</button></div> : <div className="checkout-phone-verification"><div className="checkout-otp-intro"><ShieldCheck size={17}/><span>Verify your email address to place a COD order and access order history across devices.</span></div>{checkoutOtpSent && <label>Email verification code (only if the email contains a number)<input inputMode="numeric" autoComplete="one-time-code" minLength={4} maxLength={8} value={checkoutOtp} onChange={(e)=>setCheckoutOtp(e.target.value.replace(/\D/g,'').slice(0,8))} placeholder="Code, or leave blank for confirmation link" /><small>If the email says “Confirm your email address”, open its link first; you do not need to type a code.</small></label>}<div className="checkout-otp-actions"><button type="button" className="btn btn-ghost" disabled={checkoutOtpBusy || !customer.email.trim()} onClick={sendCheckoutOtp}>{checkoutOtpBusy ? 'Please wait…' : checkoutOtpSent ? 'Resend email' : 'Send verification email'}</button>{checkoutOtpSent && <button type="button" className="btn btn-primary" disabled={checkoutOtpBusy} onClick={verifyCheckoutOtp}>{checkoutOtpBusy ? 'Checking…' : 'Verify email / Check link'}</button>}</div>{checkoutOtpMessage && <p className={checkoutVerifiedPhone || /Email sent|Check Inbox|Confirm your email|numeric code/i.test(checkoutOtpMessage) ? 'history-status' : 'history-error'} role="status">{checkoutOtpMessage}</p>}</div>}<label>Delivery address *<textarea required minLength={8} rows={3} value={customer.address} onChange={(e) => setCustomer({ ...customer, address: e.target.value })} placeholder="House no., street, area, Aurangabad" /></label><button type="button" className="btn btn-ghost location-btn" onClick={() => { if (!navigator.geolocation) { setNotice('Location is not supported by this browser. Please type your address.'); return; } navigator.geolocation.getCurrentPosition((position) => { const { latitude, longitude } = position.coords; setCustomer((c) => ({ ...c, coordinates: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}` })); }, () => setNotice('Could not access location. Please enter your address manually.'), { enableHighAccuracy: true, timeout: 10000 }); }}><LocateFixed size={15} /> Use my current location</button>{customer.coordinates && <p className="field-help" role="status">Location captured. Please also enter a readable street address and PIN code.</p>}<label>Delivery PIN code *<input required inputMode="numeric" autoComplete="postal-code" pattern="[0-9]{6}" minLength={6} maxLength={6} value={customer.pincode || ''} onChange={(e) => setCustomer((current) => ({ ...current, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) }))} placeholder="6-digit PIN code" /></label><p className="field-help">Current service PIN codes: {(storeSettings.serviceablePincodes || ['824101']).join(', ')}. Call the store to confirm nearby areas before adding them in Admin → Storefront.</p><label>Landmark (optional)<input value={customer.landmark} onChange={(e) => setCustomer({ ...customer, landmark: e.target.value })} placeholder="Near a shop, school, or landmark" /></label><label>Order note (optional)<textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any delivery instructions?" /></label><div className="checkout-total"><div><span>{cartCount} items · Total payable</span><strong>{money(total)}</strong></div><span className="cod-pill"><BanknoteIcon /> Cash on delivery</span></div><button className="btn btn-primary full-btn" disabled={busy || cart.length === 0 || isDemoMode || !checkoutVerifiedPhone || String(customer.email || '').trim().toLowerCase()!==checkoutVerifiedPhone}>{busy ? 'Placing your order…' : 'Place COD order'} <ArrowRight size={17} /></button><p className="form-privacy"><ShieldCheck size={14} /> Your verified email links this order to your history on other devices. Cash on delivery only.</p>{isDemoMode && <p className="history-error" role="status">Live order placement is disabled until Supabase is configured. Demo mode must not accept real customer orders.</p>}</form></section></div>}

    {ordersHistoryOpen && <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setOrdersHistoryOpen(false); }}><section className="modal order-history-modal"><div className="modal-head"><div><span className="eyebrow">YOUR PURCHASES</span><h2>My orders</h2><p>Verify your email address to see orders from any device.</p></div><button className="icon-btn" onClick={() => setOrdersHistoryOpen(false)} aria-label="Close order history"><X /></button></div>
      {isDemoMode ? <div className="history-login-panel"><div className="notice error compact"><ShieldCheck size={17}/><span>Cross-device history is not active yet. Connect Supabase and apply email-otp-migration.sql.</span></div><p className="history-privacy-note">Orders on this browser are still listed below. Do not use demo mode for real customer orders.</p></div> : <div className="history-login-panel">{customerAuthUser ? <div className="customer-session-row"><div><strong>Email verified</strong><small>{customerAuthUser.email || customerPhone}</small></div><button className="btn btn-ghost" disabled={customerHistoryBusy} onClick={async()=>{setCustomerHistoryBusy(true);setCustomerHistoryError('');try{const remoteOrders=await getMyCustomerOrders();const entries=remoteOrders.map((order)=>({trackingCode:order.trackingCode,createdAt:order.createdAt,total:order.total,status:order.status,items:order.items||[]}));setCustomerHistoryEntries(entries);}catch(error){setCustomerHistoryError(error.message);}finally{setCustomerHistoryBusy(false);}}}><RefreshCw size={15}/>{customerHistoryBusy?'Loading…':'Refresh history'}</button><button className="btn btn-ghost" onClick={async()=>{try{await customerSignOut();setCustomerAuthUser(null);setCustomerHistoryEntries([]);setCustomerOtpSent(false);setCustomerOtp('');}catch(error){setCustomerHistoryError(error.message);}}}>Sign out</button></div> : <form className="customer-otp-form" onSubmit={async(e)=>{e.preventDefault();setCustomerHistoryBusy(true);setCustomerHistoryError('');try{if(!customerOtpSent){const email=await sendCustomerOtp(customerPhone);setCustomerPhone(email);setCustomerOtpSent(true);setCustomerHistoryError('Verification code sent by email. Check your inbox and spam folder.');}else{const user=await verifyCustomerOtp(customerPhone,customerOtp);setCustomerAuthUser(user);setCustomerOtpSent(false);setCustomerOtp('');const remoteOrders=await getMyCustomerOrders();const entries=remoteOrders.map((order)=>({trackingCode:order.trackingCode,createdAt:order.createdAt,total:order.total,status:order.status,items:order.items||[]}));setCustomerHistoryEntries(entries);setCustomerHistoryError(entries.length?'Your order history is up to date.':'Verified successfully. No orders were found for this email yet.');}}catch(error){setCustomerHistoryError(error.message||'Could not verify email address.');}finally{setCustomerHistoryBusy(false);}}}><label>Email address<input type="email" required autoComplete="email" value={customerPhone} onChange={(e)=>setCustomerPhone(e.target.value)} placeholder="you@example.com" disabled={customerOtpSent}/></label>{customerOtpSent&&<label>Email verification code<input inputMode="numeric" autoComplete="one-time-code" required minLength={4} maxLength={8} value={customerOtp} onChange={(e)=>setCustomerOtp(e.target.value)} placeholder="Enter email code"/></label>}<div className="customer-otp-actions"><button className="btn btn-primary" disabled={customerHistoryBusy}>{customerHistoryBusy?(customerOtpSent?'Verifying…':'Sending OTP…'):(customerOtpSent?'Verify & show my orders':'Send email code')}</button>{customerOtpSent&&<button type="button" className="btn btn-ghost" onClick={()=>{setCustomerOtpSent(false);setCustomerOtp('');setCustomerHistoryError('');}}>Change email</button>}</div></form>}{customerHistoryError&&<p className={/could not|failed|error|not active|apply/i.test(customerHistoryError)?'history-error':'history-status'} role="status">{customerHistoryError}</p>}</div>}
      {visibleOrderHistory.length ? <div className="order-history-list">{visibleOrderHistory.map((entry) => <article className="history-order-card" key={entry.trackingCode}><div className="history-order-head"><div><strong>{entry.trackingCode}</strong><small>{entry.createdAt ? new Date(entry.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Order date unavailable'}</small></div><span className={`status-pill ${(entry.status || 'Placed').toLowerCase().replaceAll(' ', '-')}`}>{entry.status || 'Placed'}</span></div><div className="history-items">{(entry.items || []).map((item) => <div key={`${entry.trackingCode}-${item.id}`}><span>{item.name} × {item.quantity}</span><strong>{money(Number(item.price || 0) * Number(item.quantity || 1))}</strong></div>)}</div><div className="history-order-foot"><strong>Total {money(entry.total)}</strong><div><button className="btn btn-ghost" disabled={historyBusyCode === entry.trackingCode} onClick={() => refreshHistoryOrder(entry)}><RefreshCw size={14}/>{historyBusyCode === entry.trackingCode ? 'Checking…' : 'Refresh status'}</button><button className="btn btn-primary" onClick={async () => { setTrackCode(entry.trackingCode); setTrackOpen(true); setOrdersHistoryOpen(false); setTrackError(''); try { const order = await getOrder(entry.trackingCode); if (order) setTrackedOrder(order); else setTrackError('Order not found.'); } catch (error) { setTrackError(error.message || 'Could not look up this order.'); } }}>Track order</button></div></div></article>)}</div> : <div className="empty-state"><ClipboardList size={40}/><h3>No previous orders found</h3><p>Once you place an order, it will appear here. Verify the same email address used at checkout to see purchases on other devices.</p><button className="btn btn-primary" onClick={() => setOrdersHistoryOpen(false)}>Continue shopping</button></div>}<p className="history-privacy-note"><ShieldCheck size={14}/> Your order history is matched to the email address verified by OTP. Delivery details are not shown in this list.</p></section></div>}

    {trackOpen && <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setTrackOpen(false); }}><section className="modal track-modal"><div className="modal-head"><div><span className="eyebrow">ORDER UPDATES</span><h2>Track your order</h2><p>Enter the tracking code shared after checkout.</p></div><button className="icon-btn" onClick={() => setTrackOpen(false)} aria-label="Close tracking"><X /></button></div><form className="tracking-form" onSubmit={trackOrder}><input required value={trackCode} onChange={(e) => setTrackCode(e.target.value.toUpperCase())} placeholder="e.g. GPB-A1B2C3" aria-label="Tracking code" /><button className="btn btn-primary" type="submit">Track <ArrowRight size={16} /></button></form>{trackError && <div className="notice error compact"><CircleX size={17} /><span>{trackError}</span></div>}{trackedOrder && <OrderTracking order={trackedOrder} />}{placedOrder && trackedOrder?.trackingCode === placedOrder.trackingCode && <div className="tracking-code-box"><span>Your tracking code</span><strong>{placedOrder.trackingCode}</strong><button className="text-btn" onClick={() => navigator.clipboard?.writeText(placedOrder.trackingCode)}>Copy code</button></div>}<p className="track-help">Need help with an order? {storeSettings.supportPhone ? <>Call <a href={`tel:${String(storeSettings.supportPhone).replace(/[^+\d]/g, '')}`}>{storeSettings.supportPhone}</a>.</> : 'Contact details will appear here when the store adds its support number.'} {storeSettings.whatsappNumber && <>You can also <a href={`https://wa.me/${String(storeSettings.whatsappNumber).replace(/\D/g, '')}`} target="_blank" rel="noreferrer">message us on WhatsApp</a>.</>}</p></section></div>}
  </div>;
}

function AdminDashboard(props) {
  const { storeSettings, setStoreSettings, orders, setOrders, activeOrders, ordersRealtimeStatus, adminError, setAdminError, adminAllowed, setAdminAllowed, adminRoleChecking, adminUser, adminEmail, setAdminEmail, adminPassword, setAdminPassword, adminBusy, setAdminBusy, loginAdmin, requestAdminReset, saveAdminReset, adminResetMode, adminResetBusy, adminResetPassword, setAdminResetPassword, adminResetConfirm, setAdminResetConfirm, adminResetMessage, adminResetIsRateLimited, adminResetCooldownRemaining, changeStatus, products, setProducts, onBack } = props;
  const [tab, setTab] = useState('Orders');
  const [settingsDraft, setSettingsDraft] = useState(storeSettings);
  useEffect(() => setSettingsDraft(storeSettings), [storeSettings]);
  const [savingSettings, setSavingSettings] = useState(false);
  const [productQuery, setProductQuery] = useState('');
  const [productPage, setProductPage] = useState(0);
  const [orderQuery, setOrderQuery] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('All statuses');
  const [editing, setEditing] = useState(null);
  const [savingProduct, setSavingProduct] = useState(false);
  const [importMessage, setImportMessage] = useState('');
  const blankProduct = { id: '', name: '', barcode: '', category: 'Atta & Rice', size: '', price: '', mrp: '', stock: 0, image: '', images: [], video: '', tag: 'Everyday essential', active: true };
  const [draft, setDraft] = useState(blankProduct);
  const [mediaBusy, setMediaBusy] = useState(false);
  const draftImages = [...new Set([draft.image, ...(Array.isArray(draft.images) ? draft.images : [])].filter(isUsableProductImage))].slice(0, 3);
  useEffect(() => { setProductPage(0); }, [productQuery, tab]);
  const categories = ['Atta & Rice', 'Oil & Ghee', 'Pulses & Dal', 'Spices', 'Snacks & Packaged', 'Personal Care', 'Household', 'Other'];
  const activeProducts = products.filter((p) => p.active !== false && hasProductImage(p));
  const normalizedProductQuery = normalizeSearchText(productQuery);
  const searchedOrders = useMemo(() => {
    const query = normalizeSearchText(orderQuery);
    return [...orders].filter((order) => {
      if (orderStatusFilter !== 'All statuses' && order.status !== orderStatusFilter) return false;
      if (!query) return true;
      const customer = order.customer || {};
      const items = (order.items || []).map((item) => `${item.name || ''} ${item.size || ''}`).join(' ');
      const haystack = normalizeSearchText([order.trackingCode, order.status, order.total, customer.name, customer.phone, customer.email, customer.address, customer.landmark, items].join(' '));
      return query.split(' ').filter(Boolean).every((term) => haystack.includes(term));
    }).sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  }, [orders, orderQuery, orderStatusFilter]);
  const searchedProducts = products.filter((p) => {
    if (!normalizedProductQuery) return true;
    const codeValues = getProductCodes(p);
    const searchableValues = [p.name, p.category, p.size, p.tag, p.brand, p.id, p.stock, p.price, p.mrp, p.active === false ? 'hidden draft' : 'live visible'];
    const haystack = normalizeSearchText(searchableValues.filter((value) => value !== null && value !== undefined).join(' ')).replace(/(\p{N})\s+(?=\p{L})/gu, '$1');
    const queryText = normalizeSearchText(productQuery).replace(/(\p{N})\s+(?=\p{L})/gu, '$1');
    const queryTerms = queryText.split(/\s+/).filter(Boolean);
    const textMatch = queryTerms.length > 0 && queryTerms.every((term) => haystack.includes(term));
    // Barcode scanners may send spaces, hyphens or an Enter suffix; compare compact codes too.
    // Do not treat very short numeric fragments as a barcode match.
    const compactQuery = compactSearchCode(productQuery);
    const compactBarcodeMatch = compactQuery.length >= 4 && codeValues.some((value) => compactSearchCode(value).includes(compactQuery));
    return textMatch || compactBarcodeMatch;
  });
  const adminProductPageSize = 50;
  const adminProductPageCount = Math.max(1, Math.ceil(searchedProducts.length / adminProductPageSize));
  const visibleAdminProducts = searchedProducts.slice(productPage * adminProductPageSize, (productPage + 1) * adminProductPageSize);
  function removeDraftImage(src) {
    setDraft((current) => {
      const nextImages = [...new Set([current.image, ...(Array.isArray(current.images) ? current.images : [])].filter((image) => isUsableProductImage(image) && image !== src))].slice(0, 3);
      return { ...current, images: nextImages, image: current.image === src ? (nextImages[0] || '') : current.image };
    });
  }
  async function saveDraft(e) {
    e.preventDefault(); setSavingProduct(true); setAdminError('');
    try {
      const barcode = String(draft.barcode ?? '').trim();
      const compactBarcode = compactSearchCode(barcode);
      if (compactBarcode) {
        const duplicate = products.find((product) => product.id !== (draft.id || editing) && getProductCodes(product).some((code) => compactSearchCode(code) === compactBarcode));
        if (duplicate) throw new Error(`This barcode is already assigned to “${duplicate.name}”. Edit that product instead of creating a duplicate.`);
      }
      const saved = await saveProduct({ ...draft, barcode, id: draft.id || `gpb-${Date.now().toString(36)}` });
      setProducts((items) => [saved, ...items.filter((p) => p.id !== saved.id)]);
      setDraft(blankProduct); setEditing(null);
      setImportMessage(saved.active ? 'Product saved and published. Barcode/name search is ready for this product.' : 'Product saved as hidden. Upload a product image and enable “Visible in customer store” to publish it.');
    } catch (err) { setAdminError(err.message || 'Could not save product.'); }
    finally { setSavingProduct(false); }
  }
  async function chooseMedia(e) {
    const files = Array.from(e.target.files || []); if (!files.length) return; setMediaBusy(true);
    try { const urls = []; for (const file of files.slice(0, 3)) urls.push(await uploadProductMedia(file, draft.id || `gpb-${Date.now().toString(36)}`)); setDraft((d) => ({ ...d, image: d.image || urls[0], images: [...new Set([...(d.images || []), ...urls])].slice(0, 3) })); setImportMessage(`${urls.length} image(s) uploaded. Save the product to keep them.`); }
    catch (err) { setAdminError(err.message || 'Upload failed.'); } finally { setMediaBusy(false); e.target.value = ''; }
  }
  async function chooseVideo(e) {
    const file = e.target.files?.[0]; if (!file) return; setMediaBusy(true); setAdminError('');
    try { const url = await uploadProductMedia(file, draft.id || `gpb-${Date.now().toString(36)}`); setDraft((current) => ({ ...current, video: url })); setImportMessage('Product video uploaded. Save the product to keep it.'); }
    catch (err) { setAdminError(err.message || 'Video upload failed.'); } finally { setMediaBusy(false); e.target.value = ''; }
  }

  async function importFile(e) {
    const file = e.target.files?.[0]; if (!file) return; setImportMessage(''); setAdminError('');
    let savedImportCount = 0;
    try {
      let rows = [];
      const ext = file.name.split('.').pop().toLowerCase();
      if (ext === 'json') rows = JSON.parse(await file.text());
      else if (['csv','tsv','txt'].includes(ext)) {
        const text = await file.text(); const firstLine = text.split(/\r?\n/, 1)[0] || '';
        const delim = ext === 'tsv' || firstLine.includes('\t') ? '\t' : ',';
        rows = parseDelimitedObjects(text, delim);
      } else if (['xlsx','xls'].includes(ext)) {
        const XLSX = await import('xlsx'); const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' }); rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' });
      } else if (ext === 'pdf') {
        const pdfjs = await import('pdfjs-dist'); pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
        const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise; const pdfLines = [];
        for (let n=1; n<=pdf.numPages; n++) {
          const page = await pdf.getPage(n); const content = await page.getTextContent(); const grouped = new Map();
          for (const item of content.items) {
            if (!item.str?.trim()) continue;
            const y = Math.round(Number(item.transform?.[5] || 0) / 2) * 2;
            if (!grouped.has(y)) grouped.set(y, []);
            grouped.get(y).push({ x: Number(item.transform?.[4] || 0), text: item.str.trim() });
          }
          for (const [, parts] of [...grouped.entries()].sort((a,b)=>b[0]-a[0])) {
            parts.sort((a,b)=>a.x-b.x);
            pdfLines.push(parts.map((part)=>part.text).join(' | '));
          }
        }
        rows = pdfLines.map((line) => { const parts = line.split(/\s*\|\s*/).map((v) => v.trim()).filter(Boolean); return { name: parts[0], size: parts[1] || '1 unit', price: parts[2] || '', mrp: parts[3] || parts[2] || '', category: parts[4] || 'Other' }; }).filter((r) => r.name && Number.isFinite(Number(r.price)) && Number(r.price) >= 0);
      } else throw new Error('Use CSV, TSV, Excel (.xlsx/.xls), JSON or text-based PDF.');
      if (!Array.isArray(rows)) throw new Error('The file must contain a list of product rows.');
      const stableImportId = (name, category, size) => {
        const source = `${normalizeSearchText(name)}|${normalizeSearchText(category)}|${normalizeSearchText(size)}`;
        let hash = 2166136261;
        for (let index = 0; index < source.length; index += 1) hash = Math.imul(hash ^ source.charCodeAt(index), 16777619);
        return `import-${(hash >>> 0).toString(36)}`;
      };
      const norm = (row, i) => { const obj = {}; for (const [k,v] of Object.entries(row)) obj[String(k).toLowerCase().replace(/[^a-z0-9]/g,'')] = v; const get = (...keys) => { for (const k of keys) if (obj[k] !== undefined && obj[k] !== '') return obj[k]; return ''; }; const name = String(get('name','product','productname','item','itemname')).trim(); const category = String(get('category','type') || 'Other').trim(); const size = String(get('size','weight','quantity','pack') || '1 unit').trim(); const price = Number(get('price','sellingprice','saleprice','rate')); const mrp = Number(get('mrp','listprice','maximumretailprice') || price); const suppliedId = String(get('id','productid') || '').trim(); return { id: suppliedId || stableImportId(name, category, size), name, barcode: String(get('barcode','barcodenumber','barcodevalue','ean','ean8','ean13','ean14','upc','upca','upce','gtin','gtin8','gtin12','gtin13','gtin14','sku','productcode','itemcode','itemnumber','articlecode','scancode','jan','isbn') || '').trim(), category, size, price, mrp, stock: Math.max(0, Number(get('stock','quantityinstock','inventory')) || 0), image: String(get('image','imageurl','photo') || '').trim(), tag: String(get('tag','offer') || 'Imported'), active: true }; };
      const parsedRows = rows.map(norm);
      const cleaned = parsedRows.filter((r) => r.name && r.size && Number.isFinite(r.price) && r.price >= 0 && Number.isFinite(r.mrp) && r.mrp >= r.price);
      const invalidCount = parsedRows.length - cleaned.length;
      if (!cleaned.length) throw new Error('No valid products found. Include columns like name, size, price, mrp, category, stock. PDF must contain selectable text, not just a scanned image.');
      const ids = new Set();
      const importedBarcodes = new Map();
      for (const row of cleaned) {
        if (ids.has(row.id)) throw new Error(`Duplicate product ID in import file: ${row.id}. Keep the original id for existing products or remove the duplicate.`);
        ids.add(row.id);
        const compactBarcode = compactSearchCode(row.barcode);
        if (compactBarcode) {
          if (importedBarcodes.has(compactBarcode)) throw new Error(`Barcode ${row.barcode} appears more than once in this file (products: ${importedBarcodes.get(compactBarcode)} and ${row.name}). Keep one unique barcode per product.`);
          importedBarcodes.set(compactBarcode, row.name);
        }
      }
      for (const row of cleaned) { await saveProduct(row); savedImportCount++; }
      setImportMessage(`Imported/updated ${savedImportCount} valid products${invalidCount ? `; skipped ${invalidCount} invalid row(s)` : ''}. Products without a usable photo remain hidden. Review prices and stock before publishing.`);
    } catch (err) {
      const partial = savedImportCount ? ` ${savedImportCount} product(s) were saved before the failure; review the catalogue before retrying to avoid unintended updates.` : '';
      setAdminError(`${err.message || 'Import failed.'}${partial}`);
    } finally { e.target.value = ''; }
  }
  function exportProducts() {
    const headers = ['id','name','barcode','category','size','price','mrp','stock','image','tag','active'];
    const csv = [headers.map(csvCell).join(','), ...products.map((p) => headers.map((h) => csvCell(p[h])).join(','))].join('\r\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = 'grihini-products.csv'; a.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <main className="wrap admin-page">
    <div className="admin-heading"><div><div className="eyebrow">STORE MANAGEMENT</div><h1>Admin dashboard</h1><p>Manage orders, catalogue, inventory, offers and product imports.</p></div><button className="btn btn-ghost" onClick={onBack}><ArrowLeft size={16} /> Back to store</button></div>
    {isDemoMode && <div className="notice warning"><ShieldCheck size={18} /><div><strong>Local demo mode</strong><p>Data is saved only in this browser. Configure Supabase to enable secure admin login, shared catalogue, file storage and live updates across devices.</p></div></div>}
    {adminError && <div className="notice error"><CircleX size={18} /><span>{adminError}</span></div>}
    {isDemoMode ? <div className="admin-card"><div className="demo-admin-icon"><ShieldCheck size={27} /></div><h2>Admin access is not configured</h2><p>For your store’s safety, the admin dashboard stays locked until Supabase authentication and database permissions are configured. Follow SETUP-HI.md; do not enable public demo admin on the live site.</p></div> : adminResetMode ? <form className="admin-card login-card" onSubmit={saveAdminReset}><div className="demo-admin-icon"><ShieldCheck size={27} /></div><h2>Set temporary admin password</h2><p>Your recovery link has been verified. Set a temporary password now; you can change it again before launch.</p><label>New temporary password<input required type="password" autoComplete="new-password" minLength={8} value={adminResetPassword} onChange={(e)=>setAdminResetPassword(e.target.value)} placeholder="At least 8 characters" /></label><label>Confirm password<input required type="password" autoComplete="new-password" minLength={8} value={adminResetConfirm} onChange={(e)=>setAdminResetConfirm(e.target.value)} placeholder="Type it again" /></label><button className="btn btn-primary" disabled={adminResetBusy}>{adminResetBusy ? 'Saving password…' : 'Save password & continue'} <ArrowRight size={17} /></button>{adminResetMessage && <p className={/successfully|checking/i.test(adminResetMessage)?'history-status':'history-error'} role="status">{adminResetMessage}</p>}</form> : !adminUser ? <form className="admin-card login-card" onSubmit={loginAdmin}><div className="demo-admin-icon"><LogIn size={27} /></div><h2>Sign in to your store</h2><p>Only approved store administrators can view or update customer orders and products.</p><label>Admin email<input required type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="Admin email" /></label><label>Password<input required type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} placeholder="Password" /></label><button className="btn btn-primary" disabled={adminBusy}>{adminBusy ? 'Signing in…' : 'Sign in securely'} <ArrowRight size={17} /></button><button type="button" className="text-btn admin-forgot-password" disabled={adminResetBusy || adminResetIsRateLimited} onClick={requestAdminReset}>{adminResetBusy ? 'Sending reset email…' : adminResetIsRateLimited ? `Try reset again in ${formatCooldownDuration(adminResetCooldownRemaining)}` : 'Forgot password? Send reset link'}</button>{adminResetIsRateLimited && <div className="admin-reset-cooldown" role="status" aria-live="polite"><div className="admin-reset-cooldown-heading"><Clock3 size={17} /><strong>Email limit reached — retry paused</strong></div><div className="admin-reset-countdown">Estimated retry in <strong>{formatCooldownDuration(adminResetCooldownRemaining)}</strong></div><p>No reset email was sent for the blocked attempt. This countdown is an estimate; Supabase does not expose the exact remaining time. Your normal sign-in is still available.</p></div>}{adminResetMessage && <p className={/request accepted|should arrive|check Inbox/i.test(adminResetMessage)?'history-status':'history-error'} role="status">{adminResetMessage}</p>}</form> : adminRoleChecking ? <div className="admin-card"><h2>Verifying admin access…</h2><p>Checking this account’s permission securely with Supabase.</p></div> : !adminAllowed ? <div className="admin-card"><h2>Admin permission required</h2><p>This account is signed in, but it does not have an admin role assigned. Follow the details above to complete setup.</p></div> : <>
      <div className="admin-stats"><div className="stat-card"><span>Total orders</span><strong>{orders.length}</strong><small>All received orders</small></div><div className="stat-card"><span>Needs attention</span><strong>{activeOrders.length}</strong><small>Not yet completed</small></div><div className="stat-card"><span>Live products</span><strong>{activeProducts.length}</strong><small>Visible to customers</small></div><div className="stat-card"><span>Delivered COD sales</span><strong>{money(orders.filter((o) => o.status === 'Delivered').reduce((s,o)=>s+o.total,0))}</strong><small>Delivered order value</small></div></div>
      <div className="admin-tabs">{['Orders','Products','Storefront','Import / Export','Reports'].map((t) => <button key={t} className={`admin-tab ${tab===t?'active':''}`} onClick={() => { setTab(t); if (t==='Storefront') setSettingsDraft(storeSettings); }}>{t==='Orders'?<ClipboardList size={16}/>:t==='Products'?<PackageCheck size={16}/>:t==='Storefront'?<ImagePlus size={16}/>:t==='Import / Export'?<FileUp size={16}/>:<BarChart3 size={16}/>} {t}</button>)}</div>
      {tab === 'Orders' && <><div className="admin-list-head"><div><h2>Customer orders</h2><p>Accept, reject, pack, dispatch and deliver.</p></div><button className="btn btn-ghost" onClick={async () => { setAdminError(''); try { setOrders(await refreshOrders()); } catch (error) { setAdminError(error.message || 'Could not refresh orders.'); } }}><RefreshCw size={16}/> Refresh</button></div>{ordersRealtimeStatus === 'reconnecting' && <div className="notice warning orders-connection-note"><RefreshCw size={16}/><span>Realtime connection is reconnecting. The order list will still refresh automatically every 20 seconds.</span></div>}<div className="order-filter-bar"><label><span>Search orders</span><input value={orderQuery} onChange={(e)=>setOrderQuery(e.target.value)} placeholder="Order code, customer, phone, address, product…"/></label><label><span>Order status</span><select value={orderStatusFilter} onChange={(e)=>setOrderStatusFilter(e.target.value)}>{['All statuses','Placed','Accepted','Packed','Out for delivery','Delivered','Rejected','Cancelled'].map((status)=><option key={status}>{status}</option>)}</select></label><span className="product-search-count">{searchedOrders.length} of {orders.length} orders</span></div>{searchedOrders.length ? <div className="orders-list">{searchedOrders.map((order)=><AdminOrder key={order.trackingCode} order={order} onChange={changeStatus}/>)}</div> : <div className="admin-empty-search"><PackageCheck size={32}/><strong>{orders.length ? 'No matching orders' : 'No orders yet'}</strong><span>{orders.length ? 'Try another search or change the status filter.' : 'Customer orders appear here when checkout is completed.'}</span>{(orderQuery || orderStatusFilter !== 'All statuses') && <button type="button" className="btn btn-ghost" onClick={()=>{setOrderQuery('');setOrderStatusFilter('All statuses');}}>Clear filters</button>}</div>}</>}
      {tab === 'Products' && <div className="catalog-admin"><div className="admin-list-head"><div><h2>Product catalogue</h2><p>Add or update products, prices, stock and media.</p></div><button className="btn btn-ghost" onClick={() => { setDraft(blankProduct); setEditing(null); }}><PackagePlus size={16}/> New product</button></div>
        <form className="product-editor" onSubmit={saveDraft}><h3>{editing ? 'Edit product' : 'Add product'}</h3><div className="form-grid"><label>Product name *<input required value={draft.name} onChange={(e)=>setDraft({...draft,name:e.target.value})}/></label><label>Barcode / EAN / UPC / SKU<input inputMode="text" autoComplete="off" spellCheck={false} value={draft.barcode || ''} onChange={(e)=>setDraft({...draft,barcode:e.target.value})} onKeyDown={(e)=>{ if(e.key==='Enter') e.preventDefault(); }} placeholder="Scan barcode or type code"/><small>Save this code with the product to enable barcode search on Admin and Storefront.</small></label><label>Category<select value={draft.category} onChange={(e)=>setDraft({...draft,category:e.target.value})}>{categories.map((c)=><option key={c}>{c}</option>)}</select></label><label>Pack size *<input required value={draft.size} onChange={(e)=>setDraft({...draft,size:e.target.value})} placeholder="500 g / 1 L"/></label><label>Selling price (₹) *<input required type="number" min="0" step="0.01" value={draft.price} onChange={(e)=>setDraft({...draft,price:e.target.value})}/></label><label>MRP (₹) *<input required type="number" min="0" step="0.01" value={draft.mrp} onChange={(e)=>setDraft({...draft,mrp:e.target.value})}/></label><label>Stock quantity<input type="number" min="0" value={draft.stock} onChange={(e)=>setDraft({...draft,stock:e.target.value})}/></label><label>Badge / offer label<input value={draft.tag} onChange={(e)=>setDraft({...draft,tag:e.target.value})} placeholder="Best seller / Offer"/></label><label>Primary image URL<input value={draft.image} onChange={(e)=>setDraft({...draft,image:e.target.value})} placeholder="https://…"/></label></div><label className="upload-label"><ImagePlus size={17}/> Upload up to 3 product photos (required to publish)<input type="file" accept="image/*" multiple onChange={chooseMedia}/></label>{mediaBusy&&<p>Uploading media…</p>}{draftImages.length > 0 && <div className="media-gallery-preview" aria-label="Saved product photos">{draftImages.map((src,index)=><div className="media-gallery-item" key={src}><img src={src} alt={`Product photo ${index+1}`} loading="lazy"/><div className="media-gallery-actions"><button type="button" className={draft.image===src?'is-main':''} onClick={()=>setDraft((current)=>({...current,image:src}))}>{draft.image===src?'Main photo':'Make main'}</button><button type="button" className="remove-photo" onClick={()=>removeDraftImage(src)}>Remove</button></div></div>)}</div>}<label className="upload-label"><Package size={17}/> Optional product video (MP4/WebM, max 12 MB)<input type="file" accept="video/mp4,video/webm" onChange={chooseVideo}/></label>{draft.video && <div className="media-preview product-video-preview"><video src={draft.video} controls preload="metadata"/><button type="button" className="btn btn-ghost" onClick={()=>setDraft((current)=>({...current,video:''}))}>Remove video</button></div>}<label className="inline-check"><input type="checkbox" checked={draft.active!==false} onChange={(e)=>setDraft({...draft,active:e.target.checked})}/> Visible in customer store</label><p className="field-help">Products without a usable photo are saved as hidden automatically. Upload at least one product photo before publishing.</p><div className="editor-actions"><button className="btn btn-primary" disabled={savingProduct||mediaBusy}>{savingProduct?'Saving…':editing?'Save changes':'Add product'}</button>{editing&&<button type="button" className="btn btn-ghost" onClick={()=>{setDraft(blankProduct);setEditing(null);}}>Cancel edit</button>}</div></form>
        <div className="product-search-head"><label className="product-search"> <span>Search catalogue</span><input value={productQuery} onChange={(e)=>setProductQuery(e.target.value)} placeholder="Search name, barcode, EAN, UPC, SKU, category, size, price or stock…"/></label><span className="product-search-count">{searchedProducts.length} of {products.length} products</span></div><div className="product-admin-list">{visibleAdminProducts.map((p)=><div className="product-admin-row" key={p.id}><img src={(isUsableProductImage(p.image) ? p.image : (Array.isArray(p.images) ? p.images.find(isUsableProductImage) : '')) || '/favicon.svg'} alt={`${p.name} product`} loading="lazy" onError={(e)=>{e.currentTarget.onerror=null;e.currentTarget.src='/favicon.svg';}}/><div className="product-admin-copy"><strong>{p.name}</strong><small>{p.category} · {p.size} · Stock {p.stock ?? 0}{getProductCodes(p)[0] ? ` · Barcode ${getProductCodes(p)[0]}` : ''}</small><span>{money(p.price)} <del>{money(p.mrp)}</del> {p.active===false?'· Hidden':''}</span></div><button className="icon-btn" title="Edit product" onClick={()=>{setDraft({...p,images:[...new Set([p.image,...(Array.isArray(p.images)?p.images:[])].filter(isUsableProductImage))].slice(0,3),image:isUsableProductImage(p.image)?p.image:(Array.isArray(p.images)?p.images.find(isUsableProductImage)||'':''),price:String(p.price),mrp:String(p.mrp),stock:String(p.stock??0)});setEditing(p.id);window.scrollTo({top:0,behavior:'smooth'});}}><Pencil size={16}/></button><button className="icon-btn danger-icon" title="Archive product" aria-label={`Archive ${p.name}`} onClick={async()=>{if(!window.confirm(`Hide ${p.name} from the customer store? You can restore it by editing the product and enabling visibility.`))return;setAdminError('');try{await removeProduct(p.id, p);setProducts((items)=>items.map((x)=>x.id===p.id?{...x,active:false}:x));setImportMessage(`${p.name} is now hidden from customers.`);}catch(err){setAdminError(err.message);}}}><Trash2 size={16}/></button></div>)}</div>{searchedProducts.length > adminProductPageSize && <div className="admin-product-pagination"><span>Showing {productPage*adminProductPageSize+1}–{Math.min((productPage+1)*adminProductPageSize,searchedProducts.length)} of {searchedProducts.length}</span><div><button type="button" className="btn btn-ghost" disabled={productPage===0} onClick={()=>setProductPage((page)=>Math.max(0,page-1))}>Previous</button><button type="button" className="btn btn-ghost" disabled={productPage+1>=adminProductPageCount} onClick={()=>setProductPage((page)=>Math.min(adminProductPageCount-1,page+1))}>Next</button></div></div>}{searchedProducts.length === 0 && <div className="admin-empty-search"><Search size={24}/><strong>No matching products</strong><span>Try a product name, barcode, EAN/UPC, SKU, category, pack size or clear the search.</span><button type="button" className="btn btn-ghost" onClick={()=>setProductQuery('')}>Clear search</button></div>}
      </div>}
      {tab === 'Storefront' && <section className="storefront-editor"><div className="admin-list-head"><div><h2>Homepage & promotions</h2><p>Change the wide hero image and promotional banner shown to customers.</p></div><span className="status-pill accepted">Live storefront</span></div><form className="product-editor" onSubmit={async(e)=>{e.preventDefault();setSavingSettings(true);setAdminError('');try{const saved=await saveStoreSettings(settingsDraft);setStoreSettings(saved);setImportMessage('Homepage settings saved. Customers will see the updated banner after refresh.');}catch(err){setAdminError(err.message);}finally{setSavingSettings(false);}}}><h3>Hero advertisement</h3><label>Hero / landscape image URL<input value={settingsDraft.heroImage || ''} onChange={(e)=>setSettingsDraft({...settingsDraft,heroImage:e.target.value})} placeholder="https://…"/></label><label className="upload-label"><ImagePlus size={17}/> Upload hero image<input type="file" accept="image/*" onChange={async(e)=>{const file=e.target.files?.[0];if(!file)return;setMediaBusy(true);try{const url=await uploadProductMedia(file,'storefront');setSettingsDraft((d)=>({...d,heroImage:url}));setImportMessage('Hero image uploaded. Save settings to publish it.');}catch(err){setAdminError(err.message);}finally{setMediaBusy(false);e.target.value='';}}}/></label>{settingsDraft.heroImage && <div className="media-preview hero-preview"><img src={settingsDraft.heroImage} alt="Homepage hero preview" onError={(event) => { if (event.currentTarget.dataset.fallback !== 'true') { event.currentTarget.dataset.fallback = 'true'; event.currentTarget.src = HERO_FALLBACK_IMAGE; event.currentTarget.parentElement?.classList.add('uses-fallback'); setSettingsDraft((previous) => ({ ...previous, heroImage: HERO_FALLBACK_IMAGE })); } }}/><span className="preview-fallback-note">The saved URL could not load. A local grocery image is selected; save settings to keep it.</span></div>}<label>Promotion title<input value={settingsDraft.promoTitle || ''} onChange={(e)=>setSettingsDraft({...settingsDraft,promoTitle:e.target.value})} placeholder="Fresh offers for your home"/></label><label>Promotion subtitle<input value={settingsDraft.promoText || ''} onChange={(e)=>setSettingsDraft({...settingsDraft,promoText:e.target.value})} placeholder="Everyday essentials, close to home."/></label><label>Promotional banner image URL (optional)<input value={settingsDraft.promoImage || ''} onChange={(e)=>setSettingsDraft((d)=>{const next=e.target.value.trim();const current=d.promoImages?.length?d.promoImages:(d.promoImage?[d.promoImage]:[]);const images=next?[next,...current.slice(1)]:current.slice(1);return {...d,promoImage:images[0]||'',promoImages:images};})} placeholder="Paste a public image URL"/></label><label className="upload-label"><ImagePlus size={17}/> Add promotional photos (up to 8)<input type="file" accept="image/*" multiple onChange={async(e)=>{const files=Array.from(e.target.files||[]);if(!files.length)return;setMediaBusy(true);setAdminError('');try{const remaining=Math.max(0,8-(settingsDraft.promoImages||[]).length);const urls=[];for(const file of files.slice(0,remaining))urls.push(await uploadProductMedia(file,'promo'));setSettingsDraft((d)=>{const images=[...new Set([...(d.promoImages||[]),...urls])].slice(0,8);return {...d,promoImages:images,promoImage:images[0]||''};});setImportMessage(`${urls.length} promotional photo(s) added. Press Save homepage settings to publish them.`);}catch(err){setAdminError(err.message||'Upload failed.');}finally{setMediaBusy(false);e.target.value='';}}}/></label><p className="field-help">Add several wide images. Customers can swipe through them; the banner also advances automatically. Maximum 8 images.</p>{(settingsDraft.promoImages?.length ? settingsDraft.promoImages : (settingsDraft.promoImage ? [settingsDraft.promoImage] : [])).length>0 && <div className="promo-admin-images">{(settingsDraft.promoImages?.length ? settingsDraft.promoImages : [settingsDraft.promoImage]).map((src,index)=><div className="promo-admin-image" key={`${src}-${index}`}><img src={src} alt={`Offer slide ${index+1}`}/><span>Slide {index+1}</span><button type="button" className="icon-btn danger-icon" aria-label={`Remove offer slide ${index+1}`} onClick={()=>setSettingsDraft((d)=>{const current=d.promoImages?.length?d.promoImages:[d.promoImage].filter(Boolean);const images=current.filter((_,i)=>i!==index);return {...d,promoImages:images,promoImage:images[0]||''};})}><Trash2 size={15}/></button></div>)}</div>}<h3>Delivery and customer contact</h3><div className="form-grid"><label>Delivery fee (₹)<input type="number" min="0" step="1" value={settingsDraft.deliveryFee ?? 25} onChange={(e)=>setSettingsDraft({...settingsDraft,deliveryFee:e.target.value})}/></label><label>Free delivery above (₹)<input type="number" min="0" step="1" value={settingsDraft.freeDeliveryThreshold ?? 499} onChange={(e)=>setSettingsDraft({...settingsDraft,freeDeliveryThreshold:e.target.value})}/></label><label>Serviceable PIN codes (comma-separated)<input inputMode="numeric" value={(settingsDraft.serviceablePincodes || ['824101']).join(', ')} onChange={(e)=>setSettingsDraft({...settingsDraft,serviceablePincodes:e.target.value.split(',').map((pin)=>pin.trim()).slice(0,100)})} placeholder="824101, 824102"/></label><label>Customer support phone<input type="tel" value={settingsDraft.supportPhone || ''} onChange={(e)=>setSettingsDraft({...settingsDraft,supportPhone:e.target.value})} placeholder="Add store phone number"/></label><label>WhatsApp number (with country code)<input type="tel" value={settingsDraft.whatsappNumber || ''} onChange={(e)=>setSettingsDraft({...settingsDraft,whatsappNumber:e.target.value})} placeholder="91XXXXXXXXXX"/></label></div><p className="field-help">Delivery fee, free-delivery threshold and allowed PIN codes are checked again by the database for new orders. Enter only PIN codes your team can actually serve. Set real phone/WhatsApp details before publishing contact links.</p><div className="editor-actions"><button className="btn btn-primary" disabled={savingSettings||mediaBusy}>{savingSettings?'Saving…':'Save homepage settings'}</button></div>{importMessage && <div className="notice success"><Check size={17}/>{importMessage}</div>}</form><div className="storefront-help"><Sparkles size={18}/><span>Use wide landscape images (around 1600 × 600 px). Images are public on the store; never upload private documents. {isDemoMode ? "Demo mode is active: changes are saved only in this browser and will NOT appear on other devices. Configure Supabase and its product-media storage bucket before using this storefront publicly." : "Settings are saved to the shared Supabase database so customers on other devices can see them."}</span></div></section>}
      {tab === 'Import / Export' && <section className="import-panel"><h2>Bulk product import</h2><p>Upload CSV, TSV, Excel (.xlsx/.xls), JSON, or a text-based PDF product list. Scanned/image-only PDFs need OCR first.</p><div className="import-columns"><label className="upload-drop"><Upload size={27}/><strong>Choose a product file</strong><span>CSV · Excel · JSON · PDF · up to 12 MB</span><input type="file" accept=".csv,.tsv,.txt,.xlsx,.xls,.json,.pdf" onChange={importFile}/></label><div className="import-template"><strong>Required columns</strong><code>name, barcode, category, size, price, mrp, stock, image, tag</code><p>Use a barcode column named barcode, EAN, UPC, GTIN or SKU. Format barcode cells as Text in Excel to preserve leading zeroes. To update existing products by import, export first and keep each original id column; an unsaved barcode cannot be looked up automatically.</p><button className="btn btn-ghost" onClick={exportProducts}><Download size={16}/> Export current products (CSV)</button><button className="btn btn-ghost" onClick={()=>{const sample='name,barcode,category,size,price,mrp,stock,image,tag\nAashirvaad Atta,8901324054972,Atta & Rice,5 kg,285,310,20,,Daily essential\n';const url=URL.createObjectURL(new Blob([sample],{type:'text/csv'}));const a=document.createElement('a');a.href=url;a.download='grihini-product-template.csv';a.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);}}><Download size={16}/> Download template</button></div></div>{importMessage&&<div className="notice success"><Check size={17}/>{importMessage}</div>}</section>}
      {tab === 'Reports' && <section className="reports-panel"><h2>Store reports</h2><div className="admin-stats"><div className="stat-card"><span>Placed / active</span><strong>{activeOrders.length}</strong></div><div className="stat-card"><span>Rejected / cancelled</span><strong>{orders.filter((o)=>['Rejected','Cancelled'].includes(o.status)).length}</strong></div><div className="stat-card"><span>Delivered orders</span><strong>{orders.filter((o)=>o.status==='Delivered').length}</strong></div><div className="stat-card"><span>Delivered value</span><strong>{money(orders.filter((o)=>o.status==='Delivered').reduce((s,o)=>s+o.total,0))}</strong></div></div><button className="btn btn-ghost" onClick={()=>{const headers=['trackingCode','createdAt','customer','phone','status','total','paymentMethod'];const csv=[headers.map(csvCell).join(','),...orders.map(o=>[o.trackingCode,o.createdAt,o.customer?.name,o.customer?.phone,o.status,o.total,o.paymentMethod].map(csvCell).join(','))].join('\r\n');const url=URL.createObjectURL(new Blob(['\uFEFF',csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='grihini-orders-report.csv';a.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);}}><Download size={16}/> Export order report</button></section>}
      <button className="btn btn-ghost signout" onClick={async()=>{await adminSignOut();setAdminAllowed(false);}}><LogOut size={16}/> Sign out</button>
    </>}
  </main>;
}

function PromoCarousel({ settings, onShop }) {
  const images = [...new Set([...(Array.isArray(settings.promoImages) ? settings.promoImages : []), settings.promoImage].filter((value) => typeof value === 'string' && value.trim()))].slice(0, 8);
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef(null);
  useEffect(() => setActiveIndex(0), [images.join('|')]);
  useEffect(() => {
    if (images.length < 2 || paused) return undefined;
    const timer = window.setInterval(() => setActiveIndex((index) => (index + 1) % images.length), 5000);
    return () => window.clearInterval(timer);
  }, [images.length, paused]);
  if (!images.length) return null;
  const move = (step) => setActiveIndex((index) => (index + step + images.length) % images.length);
  return <section className="promo-banner wrap" aria-label="Current offers" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocusCapture={() => setPaused(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false); }} onTouchStart={(event) => { setPaused(true); touchStartX.current = event.touches[0]?.clientX ?? null; }} onTouchEnd={(event) => { const start = touchStartX.current; const end = event.changedTouches[0]?.clientX; touchStartX.current = null; if (start !== null && typeof end === 'number' && Math.abs(end - start) > 40 && images.length > 1) move(end < start ? 1 : -1); window.setTimeout(() => setPaused(false), 3200); }}>
    <img key={images[activeIndex]} className="promo-slide-image" src={images[activeIndex]} alt={`${settings.promoTitle || 'Grihini Apna Bazaar offer'} — slide ${activeIndex + 1}`} loading="lazy" onError={(event) => { if (event.currentTarget.dataset.fallback !== 'true') { event.currentTarget.dataset.fallback = 'true'; event.currentTarget.src = '/categories/snacks.jpg'; } else { event.currentTarget.style.visibility = 'hidden'; } }} />
    <div className="promo-banner-shade"/><div className="promo-banner-copy"><span className="eyebrow">OFFERS FOR YOUR HOME</span><h2>{settings.promoTitle || 'Offers for your everyday basket'}</h2><p>{settings.promoText || 'Useful savings on the essentials your home needs.'}</p><button className="btn btn-primary" onClick={onShop}>Shop offers <ArrowRight size={16}/></button></div>
    {images.length > 1 && <><button type="button" className="promo-arrow promo-prev" aria-label="Previous offer" onClick={() => move(-1)}><ChevronLeft size={20}/></button><button type="button" className="promo-arrow promo-next" aria-label="Next offer" onClick={() => move(1)}><ChevronRight size={20}/></button><div className="promo-dots" aria-label={`Slide ${activeIndex + 1} of ${images.length}`}>{images.map((image,index)=><button type="button" key={`${image}-${index}`} aria-label={`Show offer ${index+1}`} aria-current={index===activeIndex?'true':undefined} className={index===activeIndex?'active':''} onClick={()=>setActiveIndex(index)}/>)}</div></>}
  </section>;
}

function ProductImageCarousel({ product, wishlist, setWishlist, cart, updateQuantity, onOpenDetails }) {
  const images = [...new Set([...(Array.isArray(product.images) ? product.images : []), product.image].filter(isUsableProductImage))].slice(0, 3);
  const [index, setIndex] = useState(0);
  const [touchStart, setTouchStart] = useState(null);
  const suppressPhotoClick = useRef(false);
  const saved = wishlist.includes(product.id);
  const added = cart.some((item) => item.id === product.id);
  const move = (direction) => setIndex((current) => (current + direction + images.length) % images.length);
  return <><div className="product-photo product-carousel product-photo-open" role="button" tabIndex={0} aria-label={`View details for ${product.name}`} onClick={() => { if (suppressPhotoClick.current) { suppressPhotoClick.current = false; return; } onOpenDetails(product); }} onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); onOpenDetails(product); } }} onTouchStart={(e)=>setTouchStart(e.touches[0].clientX)} onTouchEnd={(e)=>{if(touchStart===null)return;const delta=e.changedTouches[0].clientX-touchStart;if(Math.abs(delta)>35){suppressPhotoClick.current=true;if(images.length>1)move(delta<0?1:-1);window.setTimeout(()=>{suppressPhotoClick.current=false;},350);}setTouchStart(null);}}><img key={images[index] || product.id} src={images[index] || product.image} alt={product.name} loading="lazy" onError={(e)=>{if(e.currentTarget.dataset.fallback!=='true'){e.currentTarget.dataset.fallback='true';e.currentTarget.src='/favicon.svg';}else{e.currentTarget.style.visibility='hidden';}}}/><span className="product-tag">{product.tag}</span><button className={`wishlist-toggle ${saved?'saved':''}`} onClick={(e)=>{e.stopPropagation();setWishlist((items)=>saved?items.filter((id)=>id!==product.id):[...items,product.id]);}} aria-label={`Toggle wishlist for ${product.name}`}><Heart size={17} fill={saved?'currentColor':'none'}/></button><button className={`quick-add ${added?'added':''}`} onClick={(e)=>{e.stopPropagation();updateQuantity(product,1);}} aria-label={`Add ${product.name} to cart`}>{added?<Check size={19}/>:<Plus size={20}/>}</button>{images.length>1 && <><button className="image-swipe-arrow prev" onClick={(e)=>{e.stopPropagation();move(-1);}} aria-label="Previous product photo"><ChevronLeft size={17}/></button><button className="image-swipe-arrow next" onClick={(e)=>{e.stopPropagation();move(1);}} aria-label="Next product photo"><ChevronRight size={17}/></button><div className="image-dots">{images.map((src,i)=><button key={src} aria-label={`Show photo ${i+1}`} className={i===index?'active':''} onClick={(e)=>{e.stopPropagation();setIndex(i);}}/>)}</div></>}</div><div className="product-info"><span className="product-category">{product.category}</span><button className="product-name-button" onClick={() => onOpenDetails(product)}>{product.name}</button><p className="product-size">{product.size}</p><button className="product-detail-link" onClick={() => onOpenDetails(product)}>View details <ArrowRight size={13}/></button><div className="product-buy"><div><strong>{money(product.price)}</strong><del>{money(product.mrp)}</del></div><button className="add-button" onClick={()=>updateQuantity(product,1)}>{added?'Add more':'Add to cart'}</button></div></div></>;
}

function BanknoteIcon() { return <span className="cod-symbol">₹</span>; }

function OrderTracking({ order }) {
  const stages = ['Placed', 'Accepted', 'Packed', 'Out for delivery', 'Delivered'];
  const currentIndex = stages.indexOf(order.status);
  const rejected = ['Rejected', 'Cancelled'].includes(order.status);
  return <div className="tracking-result"><div className="tracking-result-head"><div><span className="eyebrow">ORDER {order.trackingCode}</span><h3>{order.status === 'Delivered' ? 'Your order has arrived!' : rejected ? 'Order update' : 'We’re on it.'}</h3><p>Placed {new Date(order.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p></div><span className={`status-pill ${order.status.toLowerCase().replaceAll(' ', '-')}`}>{order.status}</span></div>{rejected ? <div className="rejected-note"><CircleX size={20} /> This order was {order.status.toLowerCase()}. Please contact the store if you need help.</div> : <div className="timeline">{stages.map((stage, index) => { const done = index <= currentIndex; const active = index === currentIndex; const history = (order.statusHistory || []).find((h) => h.status === stage); return <div className={`timeline-step ${done ? 'done' : ''} ${active ? 'current' : ''}`} key={stage}><div className="timeline-marker">{done ? <Check size={14} /> : <span>{index + 1}</span>}</div><div className="timeline-copy"><strong>{stage}</strong><small>{history ? `${history.status || stage} · ${new Date(history.at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}` : stage === 'Delivered' ? 'Your order will be marked delivered here.' : 'Waiting for the previous step.'}</small></div></div>; })}</div>}<div className="tracking-order-summary"><div><strong>Delivery details protected</strong><span>For privacy, customer contact details are not shown on public tracking.</span></div><div><span>COD total</span><strong>{money(order.total)}</strong></div></div><div className="tracking-items">{order.items.map((item) => <div key={item.id}><span>{item.name} × {item.quantity}</span><strong>{money(item.price * item.quantity)}</strong></div>)}</div></div>;
}

function AdminOrder({ order, onChange }) {
  const [expanded, setExpanded] = useState(false);
  const nextStatus = { Placed: 'Accepted', Accepted: 'Packed', Packed: 'Out for delivery', 'Out for delivery': 'Delivered' }[order.status];
  const rejected = ['Rejected', 'Cancelled'].includes(order.status);
  return <article className="admin-order"><button className="admin-order-summary" onClick={() => setExpanded(!expanded)}><div className="admin-order-main"><span className="order-id">{order.trackingCode}</span><strong>{order.customer.name}</strong><small>{new Date(order.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</small></div><div className="admin-order-right"><strong>{money(order.total)}</strong><span className={`status-pill ${order.status.toLowerCase().replaceAll(' ', '-')}`}>{order.status}</span><ChevronDown className={expanded ? 'rotate' : ''} size={18} /></div></button>{expanded && <div className="admin-order-detail"><div className="admin-detail-grid"><div><span>Phone</span><strong>{order.customer.phone}</strong></div><div><span>Payment</span><strong>Cash on delivery</strong></div><div className="wide"><span>Delivery address</span><strong>{order.customer.address}{order.customer.landmark ? ` · ${order.customer.landmark}` : ''}</strong></div></div>{order.notes && <p className="order-note"><strong>Customer note:</strong> {order.notes}</p>}<div className="admin-order-items">{order.items.map((item) => <div key={item.id}><span>{item.name} × {item.quantity}</span><strong>{money(item.price * item.quantity)}</strong></div>)}<div><span>Delivery fee</span><strong>{order.deliveryFee === 0 ? 'FREE' : money(order.deliveryFee)}</strong></div></div><div className="order-actions">{nextStatus && <button className="btn btn-primary" onClick={() => onChange(order, nextStatus)}>{nextStatus === 'Accepted' ? <Check size={16} /> : nextStatus === 'Delivered' ? <PackageCheck size={16} /> : <ArrowRight size={16} />}{nextStatus === 'Accepted' ? 'Accept order' : nextStatus === 'Packed' ? 'Mark packed' : nextStatus === 'Out for delivery' ? 'Dispatch order' : 'Mark delivered'}</button>}{order.status === 'Placed' && <button className="btn btn-danger" onClick={() => onChange(order, 'Rejected')}><CircleX size={16} /> Reject</button>}<span className="status-hint">{rejected ? 'This order is closed.' : order.status === 'Delivered' ? 'Order completed.' : 'Customer tracking updates when you change status.'}</span></div></div>}</article>;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
