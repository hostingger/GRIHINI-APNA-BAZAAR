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
    customer: { name: customer.name.trim(), phone: customer.phone.trim(), address: customer.address.trim(), landmark: (customer.landmark || '').trim() },
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
