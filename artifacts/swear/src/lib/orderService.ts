import { supabase, supabaseConfigured } from './supabase';
import type { Order, OrderStatus, Notification } from './types';

// ─── helpers ──────────────────────────────────────────────────────────────────

function rowToOrder(row: Record<string, any>): Order {
  return {
    id: row.id,
    userId: row.user_id ?? undefined,
    items: (row.order_items ?? []).map((i: Record<string, any>) => ({
      productId: i.product_id,
      productName: i.product_name,
      price: i.price_egp,
      selectedSize: i.size,
      selectedColor: i.color,
      quantity: i.quantity,
    })),
    total: row.total_egp,
    deliveryFee: row.shipping_egp,
    ...(row.discount_code ? { discountCode: row.discount_code } : {}),
    ...(row.discount_amount > 0 ? { discountAmount: row.discount_amount } : {}),
    status: row.status as OrderStatus,
    customer: {
      name: row.customer_name,
      phone: row.phone,
      governorate: row.governorate,
      city: row.city_area,
      address: row.full_address,
      notes: row.notes ?? undefined,
    },
    createdAt: row.created_at,
  };
}

function rowToNotification(row: Record<string, any>): Notification {
  return {
    id: row.id,
    userId: row.customer_id,
    orderId: row.order_id,
    message: row.message,
    createdAt: row.created_at,
    read: row.read,
  };
}

// ─── localStorage helpers (fallback) ─────────────────────────────────────────

function lsGetOrders(): Order[] {
  return JSON.parse(localStorage.getItem('swear_orders') || '[]');
}
function lsSetOrders(orders: Order[]) {
  localStorage.setItem('swear_orders', JSON.stringify(orders));
}
function lsGetNotifications(): Notification[] {
  return JSON.parse(localStorage.getItem('swear_notifications') || '[]');
}
function lsSetNotifications(n: Notification[]) {
  localStorage.setItem('swear_notifications', JSON.stringify(n));
}

// ─── Orders ───────────────────────────────────────────────────────────────────

export async function dbSaveOrder(order: Order): Promise<void> {
  if (!supabaseConfigured || !supabase) {
    lsSetOrders([...lsGetOrders(), order]);
    return;
  }

  const subtotal = order.total - order.deliveryFee - (order.discountAmount ?? 0);

  const { error: orderErr } = await supabase.from('orders').insert({
    id: order.id,
    user_id: order.userId ?? null,
    customer_name: order.customer.name,
    phone: order.customer.phone,
    governorate: order.customer.governorate,
    city_area: order.customer.city,
    full_address: order.customer.address,
    notes: order.customer.notes ?? null,
    subtotal_egp: subtotal,
    shipping_egp: order.deliveryFee,
    total_egp: order.total,
    discount_code: order.discountCode ?? null,
    discount_amount: order.discountAmount ?? 0,
    payment_method: 'Cash on Delivery',
    status: 'Pending',
    created_at: order.createdAt,
  });

  if (orderErr) throw new Error(`Failed to save order: ${orderErr.message}`);

  const itemRows = order.items.map(item => ({
    order_id: order.id,
    product_id: item.productId,
    product_name: item.productName,
    size: item.selectedSize,
    color: item.selectedColor,
    quantity: item.quantity,
    price_egp: item.price,
  }));

  const { error: itemsErr } = await supabase.from('order_items').insert(itemRows);
  if (itemsErr) throw new Error(`Failed to save order items: ${itemsErr.message}`);
}

export async function dbGetAllOrders(): Promise<Order[]> {
  if (!supabaseConfigured || !supabase) {
    return lsGetOrders().sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToOrder);
}

export async function dbGetUserOrders(userId: string): Promise<Order[]> {
  if (!supabaseConfigured || !supabase) {
    return lsGetOrders()
      .filter(o => o.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToOrder);
}

export async function dbGetOrderById(orderId: string): Promise<Order | null> {
  if (!supabaseConfigured || !supabase) {
    return lsGetOrders().find(o => o.id === orderId) ?? null;
  }

  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('id', orderId)
    .single();

  if (error || !data) return null;
  return rowToOrder(data);
}

/** Returns the userId of the updated order (for notification creation) */
export async function dbUpdateOrderStatus(
  orderId: string,
  status: OrderStatus
): Promise<string | null> {
  if (!supabaseConfigured || !supabase) {
    const orders = lsGetOrders();
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx === -1) return null;
    const userId = orders[idx].userId ?? null;
    orders[idx] = { ...orders[idx], status };
    lsSetOrders(orders);
    return userId;
  }

  const { data: existing } = await supabase
    .from('orders')
    .select('user_id')
    .eq('id', orderId)
    .single();

  const { error } = await supabase
    .from('orders')
    .update({ status })
    .eq('id', orderId);

  if (error) throw new Error(error.message);
  return existing?.user_id ?? null;
}

// ─── Notifications ────────────────────────────────────────────────────────────

export async function dbSaveNotification(
  notification: Omit<Notification, 'id'>
): Promise<void> {
  if (!supabaseConfigured || !supabase) {
    lsSetNotifications([
      ...lsGetNotifications(),
      { ...notification, id: 'notif-' + Date.now() },
    ]);
    return;
  }

  const { error } = await supabase.from('notifications').insert({
    customer_id: notification.userId,
    order_id: notification.orderId,
    message: notification.message,
    read: notification.read,
    created_at: notification.createdAt,
  });

  if (error) throw new Error(error.message);
}

export async function dbGetNotifications(userId: string): Promise<Notification[]> {
  if (!supabaseConfigured || !supabase) {
    return lsGetNotifications()
      .filter(n => n.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('customer_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToNotification);
}

export async function dbMarkNotificationRead(notifId: string): Promise<void> {
  if (!supabaseConfigured || !supabase) {
    const n = lsGetNotifications();
    const idx = n.findIndex(x => x.id === notifId);
    if (idx !== -1) { n[idx].read = true; lsSetNotifications(n); }
    return;
  }
  await supabase.from('notifications').update({ read: true }).eq('id', notifId);
}

export async function dbMarkAllNotificationsRead(userId: string): Promise<void> {
  if (!supabaseConfigured || !supabase) {
    lsSetNotifications(
      lsGetNotifications().map(n => n.userId === userId ? { ...n, read: true } : n)
    );
    return;
  }
  await supabase
    .from('notifications')
    .update({ read: true })
    .eq('customer_id', userId)
    .eq('read', false);
}
