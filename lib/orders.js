const { supabase } = require('./supabase');

const ORDER_STATUSES = [
  { value: 'pending_manual_processing', label: 'Pending' },
  { value: 'payment_confirmed', label: 'Payment Confirmed' },
  { value: 'fulfilled', label: 'Fulfilled' },
  { value: 'cancelled', label: 'Cancelled' },
];

async function createOrder(sessionId, details) {
  const { data: orderId, error } = await supabase.rpc('create_order', {
    p_session_id: sessionId,
    p_user_id: details.userId || null,
    p_email: details.email,
    p_full_name: details.full_name,
    p_phone: details.phone || null,
    p_fulfillment_method: details.fulfillment_method,
    p_address: details.address || null,
    p_payment_method: details.payment_method,
    p_crypto_network: details.crypto_network || null,
  });

  if (error) throw error;
  return getOrderWithItems(orderId);
}

async function getOrderWithItems(orderId) {
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .maybeSingle();
  if (orderError) throw orderError;
  if (!order) return null;

  const { data: items, error: itemsError } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', orderId);
  if (itemsError) throw itemsError;

  return { ...order, items };
}

async function getOrdersForUser(userId) {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;

  return Promise.all(
    orders.map(async (order) => {
      const { data: items, error: itemsError } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', order.id);
      if (itemsError) throw itemsError;
      return { ...order, items };
    })
  );
}

async function getAllOrders() {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  if (!orders.length) return [];

  const { data: items, error: itemsError } = await supabase
    .from('order_items')
    .select('*')
    .in('order_id', orders.map((o) => o.id));
  if (itemsError) throw itemsError;

  const itemsByOrder = {};
  items.forEach((item) => {
    (itemsByOrder[item.order_id] = itemsByOrder[item.order_id] || []).push(item);
  });

  return orders.map((order) => ({ ...order, items: itemsByOrder[order.id] || [] }));
}

async function updateOrderStatus(orderId, status) {
  if (!ORDER_STATUSES.some((s) => s.value === status)) {
    throw new Error(`Invalid order status: ${status}`);
  }
  const { error } = await supabase.from('orders').update({ status }).eq('id', orderId);
  if (error) throw error;
}

module.exports = {
  createOrder,
  getOrderWithItems,
  getOrdersForUser,
  getAllOrders,
  updateOrderStatus,
  ORDER_STATUSES,
};
