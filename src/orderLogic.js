export const ORDER_STATUSES = ['Placed', 'Accepted', 'Packed', 'Out for delivery', 'Delivered'];

export function makeOrderPayload({ customer, items, subtotal, deliveryFee = 0, notes = '' }, trackingCode, now = new Date()) {
  if (!customer?.name?.trim()) throw new Error('Please enter your full name.');
  if (!customer?.phone?.trim() || !/^[0-9+\s()-]{10,16}$/.test(customer.phone.trim())) throw new Error('Please enter a valid phone number.');
  if (!customer?.address?.trim()) throw new Error('Please enter your delivery address.');
  if (!Array.isArray(items) || items.length === 0) throw new Error('Your cart is empty.');
  const safeItems = items.map((item) => {
    const quantity = Number(item.quantity);
    const price = Number(item.price);
    if (!item.id || !item.name || !Number.isFinite(quantity) || quantity < 1 || !Number.isFinite(price) || price < 0) {
      throw new Error('One or more cart items are invalid.');
    }
    return { id: String(item.id), name: String(item.name), price, quantity, image: String(item.image || '') };
  });
  const calculatedSubtotal = safeItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  if (Math.abs(calculatedSubtotal - Number(subtotal)) > 0.01) throw new Error('Cart total changed. Please review your cart.');
  const fee = Math.max(0, Number(deliveryFee) || 0);
  return {
    trackingCode,
    customer: { name: customer.name.trim(), phone: customer.phone.trim(), email: String(customer.email || '').trim().toLowerCase(), address: customer.address.trim(), pincode: String(customer.pincode || '').replace(/\D/g, '').slice(0, 6), coordinates: String(customer.coordinates || '').trim(), landmark: (customer.landmark || '').trim() },
    items: safeItems,
    subtotal: calculatedSubtotal,
    deliveryFee: fee,
    total: calculatedSubtotal + fee,
    paymentMethod: 'COD',
    paymentStatus: 'Pay on delivery',
    status: 'Placed',
    statusHistory: [{ status: 'Placed', at: now.toISOString(), note: 'Order received' }],
    notes: String(notes || '').trim(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

export function canTransitionOrder(from, to) {
  if (to === 'Rejected') return !['Delivered', 'Rejected'].includes(from);
  if (to === 'Cancelled') return from === 'Placed';
  const fromIndex = ORDER_STATUSES.indexOf(from);
  const toIndex = ORDER_STATUSES.indexOf(to);
  return fromIndex >= 0 && toIndex === fromIndex + 1;
}

export function transitionOrder(order, nextStatus, now = new Date(), note = '') {
  if (!canTransitionOrder(order.status, nextStatus)) {
    throw new Error(`Invalid order status transition: ${order.status} → ${nextStatus}`);
  }
  return {
    ...order,
    status: nextStatus,
    updatedAt: now.toISOString(),
    statusHistory: [...(order.statusHistory || []), { status: nextStatus, at: now.toISOString(), note: note || nextStatus }],
  };
}


/** Restrict public order tracking to fulfilment details; never expose customer PII. */
export function sanitizePublicTrackingOrder(order) {
  if (!order || typeof order !== 'object') return null;
  const items = Array.isArray(order.items) ? order.items.map((item) => ({
    id: String(item?.id || ''),
    name: String(item?.name || 'Item'),
    size: String(item?.size || ''),
    price: Number.isFinite(Number(item?.price)) ? Number(item.price) : 0,
    quantity: Math.max(1, Number.parseInt(item?.quantity, 10) || 1),
    image: String(item?.image || ''),
  })) : [];
  const statusHistory = Array.isArray(order.statusHistory) ? order.statusHistory.map((entry) => ({
    status: String(entry?.status || ''),
    at: String(entry?.at || ''),
  })) : [];
  return {
    trackingCode: String(order.trackingCode || ''),
    status: String(order.status || 'Placed'),
    statusHistory,
    items,
    subtotal: Number(order.subtotal) || 0,
    deliveryFee: Number(order.deliveryFee) || 0,
    total: Number(order.total) || 0,
    paymentMethod: String(order.paymentMethod || 'COD'),
    createdAt: String(order.createdAt || ''),
    updatedAt: String(order.updatedAt || ''),
  };
}


export function isPincodeServiceable(pincode, allowedPincodes = ['824101']) {
  const normalized = String(pincode || '').replace(/\D/g, '');
  if (!/^\d{6}$/.test(normalized)) return false;
  const allowed = (Array.isArray(allowedPincodes) ? allowedPincodes : String(allowedPincodes || '').split(','))
    .map((value) => String(value || '').replace(/\D/g, ''))
    .filter((value) => /^\d{6}$/.test(value));
  return allowed.includes(normalized);
}
