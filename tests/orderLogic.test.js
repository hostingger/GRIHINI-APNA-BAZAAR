import test from 'node:test';
import assert from 'node:assert/strict';
import { canTransitionOrder, makeOrderPayload, transitionOrder } from '../src/orderLogic.js';

const customer = { name: 'Asha Kumari', phone: '9876543210', address: 'Old GT Road, Aurangabad' };
const items = [{ id: 'atta', name: 'Wheat Atta', price: 250, quantity: 2 }];

test('creates a valid COD order and calculates totals from items', () => {
  const order = makeOrderPayload({ customer, items, subtotal: 500, deliveryFee: 20 }, 'GPB-TEST01', new Date('2026-10-14T10:00:00Z'));
  assert.equal(order.total, 520);
  assert.equal(order.paymentMethod, 'COD');
  assert.equal(order.status, 'Placed');
  assert.equal(order.statusHistory.length, 1);
});

test('rejects empty carts and incorrect totals', () => {
  assert.throws(() => makeOrderPayload({ customer, items: [], subtotal: 0 }, 'GPB-X'), /cart is empty/i);
  assert.throws(() => makeOrderPayload({ customer, items, subtotal: 10 }, 'GPB-X'), /total changed/i);
});

test('supports the full lifecycle in order and records history', () => {
  let order = makeOrderPayload({ customer, items, subtotal: 500 }, 'GPB-TEST02');
  for (const status of ['Accepted', 'Packed', 'Out for delivery', 'Delivered']) order = transitionOrder(order, status);
  assert.equal(order.status, 'Delivered');
  assert.deepEqual(order.statusHistory.map((x) => x.status), ['Placed', 'Accepted', 'Packed', 'Out for delivery', 'Delivered']);
});

test('blocks skipping statuses and changes after delivery', () => {
  assert.equal(canTransitionOrder('Placed', 'Delivered'), false);
  assert.throws(() => transitionOrder({ status: 'Delivered', statusHistory: [] }, 'Accepted'), /invalid order status/i);
});

test('customer → admin → delivered → customer tracking round-trip', () => {
  const customerOrder = makeOrderPayload({ customer, items, subtotal: 500, deliveryFee: 0 }, 'GPB-FLOW01');
  // Simulate the saved Firestore/local-storage record crossing from checkout to the admin order queue.
  let savedOrder = JSON.parse(JSON.stringify(customerOrder));
  for (const status of ['Accepted', 'Packed', 'Out for delivery', 'Delivered']) {
    savedOrder = transitionOrder(savedOrder, status);
  }
  // Customer tracking reads the same saved record after the admin updates it.
  const trackedOrder = JSON.parse(JSON.stringify(savedOrder));
  assert.equal(trackedOrder.trackingCode, 'GPB-FLOW01');
  assert.equal(trackedOrder.status, 'Delivered');
  assert.equal(trackedOrder.paymentMethod, 'COD');
  assert.equal(trackedOrder.total, 500);
  assert.equal(trackedOrder.statusHistory.length, 5);
});
