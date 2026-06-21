import {
  SUPABASE_NOT_CONNECTED_MESSAGE,
  formatSupabaseError,
  getSupabaseAccessToken,
  logSupabaseTableError,
  supabase,
  supabaseConfigured,
  useDevOrderMock,
} from './supabase';
import { adminApiFetchJson, customerApiFetchJson } from './apiClient';
import { apiUrl } from './apiConfig';
import type {
  Notification,
  Order,
  OrderItem,
  OrderStatus,
  ReturnRequest,
  ReturnRequestAction,
  ReturnRequestStatus,
} from './types';

type OrderRow = Record<string, any> & { id: string };
type OrderItemRow = Record<string, any> & { order_id: string };
type AdminOrdersPayload = {
  orders?: OrderRow[];
  order?: OrderRow;
  items?: OrderItemRow[];
  returns?: Record<string, any>[];
  return_request?: Record<string, any> | null;
  user_id?: string | null;
};

type CancellationStatus = NonNullable<Order['cancellationStatus']>;

function throwDbError(table: string, message: string): never {
  logSupabaseTableError(table, message);
  throw new Error(formatSupabaseError(message, table));
}

function orderApiUrl(): string {
  return apiUrl('/orders/place');
}

async function placeOrderViaApi(orderPayload: Record<string, unknown>, itemsPayload: Record<string, unknown>[]): Promise<void> {
  const token = getSupabaseAccessToken();
  if (!token) throw new Error('Login is required to place an order.');

  let res: Response;
  try {
    res = await fetch(orderApiUrl(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        order_payload: orderPayload,
        items_payload: itemsPayload,
      }),
    });
  } catch {
    throw new Error('Order API is not reachable. Start the API server and try again.');
  }

  const text = await res.text();
  let payload: Record<string, unknown> = {};
  try {
    payload = text ? JSON.parse(text) as Record<string, unknown> : {};
  } catch {
    payload = { error: text };
  }
  if (!res.ok) {
    const message = typeof payload.error === 'string'
      ? payload.error
      : typeof payload.message === 'string'
        ? payload.message
        : 'Failed to place order.';
    throw new Error(message);
  }
}

function rowToOrderItem(row: Record<string, any>): OrderItem {
  return {
    productId: row.product_id,
    variantId: row.variant_id ?? `${row.product_id}-${row.color}-${row.size}`,
    productName: row.product_name,
    price: row.price_egp,
    selectedSize: row.size,
    selectedColor: row.color,
    quantity: row.quantity,
  };
}

function asBoolean(value: unknown, fallback = false): boolean {
  if (value === true || value === 'true' || value === 't') return true;
  if (value === false || value === 'false' || value === 'f') return false;
  return fallback;
}

function normalizeCancellationStatus(value: unknown, requested: unknown): CancellationStatus {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (normalized === 'pending') return 'Pending';
  if (normalized === 'approved') return 'Approved';
  if (normalized === 'rejected') return 'Rejected';
  if (asBoolean(requested)) return 'Pending';
  return 'None';
}

function rowToOrder(row: Record<string, any>, items: Record<string, any>[] = []): Order {
  const cancellationStatus = normalizeCancellationStatus(row.cancellation_status, row.cancellation_requested);
  return {
    id: row.id,
    userId: row.user_id ?? undefined,
    items: items.map(rowToOrderItem),
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
    adminNotes: row.admin_notes ?? undefined,
    cancellationRequested: asBoolean(row.cancellation_requested) || cancellationStatus === 'Pending',
    cancellationStatus,
    cancellationReason: row.cancellation_reason ?? undefined,
    cancellationRequestedAt: row.cancellation_requested_at ?? undefined,
    cancellationResolvedAt: row.cancellation_reviewed_at ?? row.cancellation_resolved_at ?? undefined,
    cancellationAdminNote: row.cancellation_admin_note ?? undefined,
  };
}

export function rowToNotification(row: Record<string, any>): Notification {
  return {
    id: row.id,
    userId: row.customer_id,
    orderId: row.order_id ?? null,
    contactMessageId: row.contact_message_id ?? null,
    message: row.message,
    createdAt: row.created_at,
    read: row.read,
  };
}

function rowToReturnRequest(row: Record<string, any>): ReturnRequest {
  return {
    id: row.id,
    orderId: row.order_id,
    orderNumber: row.order_number,
    userId: row.user_id,
    reason: row.reason,
    message: row.message,
    preferredAction: row.preferred_action as ReturnRequestAction,
    status: row.status as ReturnRequestStatus,
    adminNote: row.admin_note ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined,
  };
}

function lsGetOrders(): Order[] {
  return JSON.parse(localStorage.getItem('swear_orders') || '[]');
}

function lsSetOrders(orders: Order[]) {
  localStorage.setItem('swear_orders', JSON.stringify(orders));
}

function lsGetNotifications(): Notification[] {
  return JSON.parse(localStorage.getItem('swear_notifications') || '[]');
}

function lsGetReturnRequests(): ReturnRequest[] {
  return JSON.parse(localStorage.getItem('swear_return_requests') || '[]');
}

function lsSetReturnRequests(requests: ReturnRequest[]) {
  localStorage.setItem('swear_return_requests', JSON.stringify(requests));
}

function lsSetNotifications(n: Notification[]) {
  localStorage.setItem('swear_notifications', JSON.stringify(n));
}

function assertOrderBackend() {
  if (supabaseConfigured && supabase) return supabase;
  if (useDevOrderMock) return null;
  throw new Error(SUPABASE_NOT_CONNECTED_MESSAGE);
}

function groupItemsByOrderId(rows: Record<string, any>[]): Map<string, Record<string, any>[]> {
  const grouped = new Map<string, Record<string, any>[]>();
  for (const row of rows) {
    const orderId = row.order_id;
    grouped.set(orderId, [...(grouped.get(orderId) ?? []), row]);
  }
  return grouped;
}

async function fetchItemsForOrders(orderIds: string[]): Promise<Map<string, Record<string, any>[]>> {
  if (orderIds.length === 0) return new Map();
  const client = assertOrderBackend();
  if (!client) {
    return groupItemsByOrderId(lsGetOrders().flatMap(order =>
      order.items.map(item => ({
        order_id: order.id,
        product_id: item.productId,
        variant_id: item.variantId,
        product_name: item.productName,
        price_egp: item.price,
        size: item.selectedSize,
        color: item.selectedColor,
        quantity: item.quantity,
      }))
    ));
  }

  const { data, error } = await client
    .from<OrderItemRow>('order_items')
    .select('*')
    .in('order_id', orderIds);

  if (error) throwDbError('order_items', error.message);
  return groupItemsByOrderId(data ?? []);
}

export async function dbSaveOrder(order: Order): Promise<void> {
  const client = assertOrderBackend();
  if (!client) {
    console.warn('[S! Wear] DEV mock order saved to localStorage:', order.id);
    lsSetOrders([...lsGetOrders(), order]);
    return;
  }

  const subtotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const orderRow = {
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
  };

  const itemRows = order.items.map(item => ({
    order_id: order.id,
    product_id: item.productId,
    variant_id: item.variantId,
    product_name: item.productName,
    size: item.selectedSize,
    color: item.selectedColor,
    quantity: item.quantity,
    price_egp: item.price,
  }));

  try {
    await placeOrderViaApi(orderRow, itemRows);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[S! Wear] order placement failure:', message);
    throwDbError('orders', message);
  }
  console.log('[S! Wear] order insert success:', order.id);
  console.log('[S! Wear] order items insert success:', order.id, itemRows.length);
}

export async function dbGetAllOrders(): Promise<Order[]> {
  const client = assertOrderBackend();
  if (!client) {
    const orders = lsGetOrders().sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    console.log('[S! Wear] admin orders fetch success: DEV mock localStorage', orders.length);
    return orders;
  }

  try {
    const payload = await adminApiFetchJson<AdminOrdersPayload>(
      '/admin/orders',
      {},
      'Failed to load orders.'
    );
    const rows = payload.orders ?? [];
    const itemsByOrder = groupItemsByOrderId(payload.items ?? []);
    console.log('[S! Wear] admin orders fetch success:', rows.length);
    return rows.map(row => rowToOrder(row, itemsByOrder.get(row.id) ?? []));
  } catch (err) {
    console.error('[S! Wear] admin orders fetch failure:', err);
    throw err;
  }
}

export async function dbGetAdminOrderById(orderId: string): Promise<Order | null> {
  const client = assertOrderBackend();
  if (!client) {
    return lsGetOrders().find(order => order.id === orderId) ?? null;
  }

  const payload = await adminApiFetchJson<AdminOrdersPayload>(
    `/admin/orders/${encodeURIComponent(orderId)}`,
    {},
    'Failed to load order.'
  );
  if (!payload.order) return null;
  return rowToOrder(payload.order, payload.items ?? []);
}

export async function dbGetUserOrders(userId: string): Promise<Order[]> {
  const client = assertOrderBackend();
  if (!client) {
    return lsGetOrders()
      .filter(order => order.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  const payload = await customerApiFetchJson<AdminOrdersPayload>(
    '/orders',
    {},
    'Failed to load orders.'
  );
  const rows = (payload.orders ?? []).filter(row => row.user_id === userId);
  const itemsByOrder = groupItemsByOrderId(payload.items ?? []);
  return rows.map(row => rowToOrder(row, itemsByOrder.get(row.id) ?? []));
}

export async function dbGetOrderById(orderId: string): Promise<Order | null> {
  const client = assertOrderBackend();
  if (!client) {
    return lsGetOrders().find(order => order.id === orderId) ?? null;
  }

  const payload = await customerApiFetchJson<AdminOrdersPayload>(
    `/orders/${encodeURIComponent(orderId)}`,
    {},
    'Failed to load order.'
  );
  return payload.order ? rowToOrder(payload.order, payload.items ?? []) : null;
}

export async function dbUpdateOrderStatus(
  orderId: string,
  status: OrderStatus
): Promise<string | null> {
  const client = assertOrderBackend();
  if (!client) {
    const orders = lsGetOrders();
    const idx = orders.findIndex(order => order.id === orderId);
    if (idx === -1) return null;
    const userId = orders[idx].userId ?? null;
    orders[idx] = { ...orders[idx], status };
    lsSetOrders(orders);
    return userId;
  }

  await adminApiFetchJson(
    `/admin/orders/${encodeURIComponent(orderId)}/status`,
    { method: 'PATCH', body: JSON.stringify({ status }) },
    'Failed to update order status.'
  );
  return null;
}

export async function dbRequestOrderCancellation(
  orderId: string,
  userId: string,
  reason: string
): Promise<Order> {
  const client = assertOrderBackend();
  const requestedAt = new Date().toISOString();
  if (!client) {
    const orders = lsGetOrders();
    const idx = orders.findIndex(order => order.id === orderId && order.userId === userId);
    if (idx === -1) throw new Error('Order not found.');
    if (!['Pending', 'Confirmed', 'Preparing'].includes(orders[idx].status)) {
      throw new Error('This order can no longer be cancelled.');
    }
    if (orders[idx].cancellationStatus === 'Pending') {
      throw new Error('Cancellation is already pending admin review.');
    }
    if (orders[idx].cancellationStatus === 'Approved' || orders[idx].cancellationStatus === 'Rejected') {
      throw new Error('This cancellation request was already reviewed.');
    }
    orders[idx] = {
      ...orders[idx],
      cancellationRequested: true,
      cancellationStatus: 'Pending',
      cancellationReason: reason,
      cancellationRequestedAt: requestedAt,
    };
    lsSetOrders(orders);
    return orders[idx];
  }

  const payload = await customerApiFetchJson<AdminOrdersPayload>(
    `/orders/${encodeURIComponent(orderId)}/cancel-request`,
    {
      method: 'POST',
      body: JSON.stringify({ reason }),
    },
    'Failed to request cancellation.'
  );
  if (!payload.order) throw new Error('Cancellation request was not saved.');
  const order = rowToOrder(payload.order, payload.items ?? []);
  if (order.userId !== userId || order.cancellationStatus !== 'Pending' || !order.cancellationRequested) {
    throw new Error('Cancellation request was not confirmed by the server.');
  }
  return order;
}

export async function dbResolveCancellation(
  orderId: string,
  approved: boolean,
  adminNote?: string
): Promise<string | null> {
  const client = assertOrderBackend();
  const resolvedAt = new Date().toISOString();

  if (!client) {
    const orders = lsGetOrders();
    const idx = orders.findIndex(order => order.id === orderId);
    if (idx === -1) return null;
    const userId = orders[idx].userId ?? null;
    orders[idx] = {
      ...orders[idx],
      status: approved ? 'Cancelled' : orders[idx].status,
      cancellationRequested: false,
      cancellationStatus: approved ? 'Approved' : 'Rejected',
      cancellationResolvedAt: resolvedAt,
      cancellationAdminNote: adminNote || undefined,
    };
    lsSetOrders(orders);
    return userId;
  }

  await adminApiFetchJson(
    `/admin/orders/${encodeURIComponent(orderId)}/cancellation/${approved ? 'approve' : 'reject'}`,
    {
      method: 'POST',
      body: JSON.stringify({ approved, admin_note: adminNote || null }),
    },
    'Failed to update cancellation.'
  );
  return null;
}

export async function dbUpdateOrderAdminNotes(orderId: string, adminNotes: string): Promise<void> {
  const client = assertOrderBackend();
  if (!client) {
    const orders = lsGetOrders();
    const idx = orders.findIndex(order => order.id === orderId);
    if (idx !== -1) {
      orders[idx] = { ...orders[idx], adminNotes };
      lsSetOrders(orders);
    }
    return;
  }

  await adminApiFetchJson(
    `/admin/orders/${encodeURIComponent(orderId)}/notes`,
    { method: 'PATCH', body: JSON.stringify({ admin_notes: adminNotes }) },
    'Failed to save order notes.'
  );
}

export async function dbCreateReturnRequest(
  request: Omit<ReturnRequest, 'id' | 'status' | 'createdAt'>
): Promise<ReturnRequest> {
  const client = assertOrderBackend();
  const createdAt = new Date().toISOString();
  const id = globalThis.crypto?.randomUUID?.() ?? `ret-${Date.now()}`;
  const next: ReturnRequest = {
    ...request,
    id,
    status: 'Pending',
    createdAt,
  };

  if (!client) {
    lsSetReturnRequests([next, ...lsGetReturnRequests()]);
    return next;
  }

  const { data, error } = await client.from('return_requests').insert({
    id,
    order_id: request.orderId,
    order_number: request.orderNumber,
    user_id: request.userId,
    reason: request.reason,
    message: request.message,
    preferred_action: request.preferredAction,
    status: 'Pending',
    admin_note: request.adminNote ?? null,
    created_at: createdAt,
  });

  if (error) throwDbError('return_requests', error.message);
  return rowToReturnRequest((data ?? [])[0]);
}

export async function dbGetReturnRequests(): Promise<ReturnRequest[]> {
  const client = assertOrderBackend();
  if (!client) {
    return lsGetReturnRequests().sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  const payload = await adminApiFetchJson<AdminOrdersPayload>(
    '/admin/returns',
    {},
    'Failed to load return requests.'
  );
  return (payload.returns ?? []).map(rowToReturnRequest);
}

export async function dbUpdateReturnRequestStatus(
  requestId: string,
  status: ReturnRequestStatus,
  adminNote?: string
): Promise<ReturnRequest | null> {
  const client = assertOrderBackend();
  const updatedAt = new Date().toISOString();

  if (!client) {
    const requests = lsGetReturnRequests();
    const idx = requests.findIndex(request => request.id === requestId);
    if (idx === -1) return null;
    requests[idx] = { ...requests[idx], status, adminNote, updatedAt };
    lsSetReturnRequests(requests);
    return requests[idx];
  }

  const payload = await adminApiFetchJson<AdminOrdersPayload>(
    `/admin/returns/${encodeURIComponent(requestId)}/status`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status, admin_note: adminNote || null, updated_at: updatedAt }),
    },
    'Failed to update return request.'
  );
  const row = payload.return_request;
  return row ? rowToReturnRequest(row) : null;
}

export async function dbSaveNotification(
  notification: Omit<Notification, 'id'>
): Promise<void> {
  const client = assertOrderBackend();
  if (!client) {
    lsSetNotifications([
      ...lsGetNotifications(),
      { ...notification, id: 'notif-' + Date.now() },
    ]);
    return;
  }

  const { error } = await client.from('notifications').insert({
    customer_id: notification.userId,
    order_id: notification.orderId ?? null,
    contact_message_id: notification.contactMessageId ?? null,
    message: notification.message,
    read: notification.read,
    created_at: notification.createdAt,
  });

  if (error) throwDbError('notifications', error.message);
}

export async function dbGetNotifications(userId: string): Promise<Notification[]> {
  const client = assertOrderBackend();
  if (!client) {
    return lsGetNotifications()
      .filter(notification => notification.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  const { data, error } = await client
    .from('notifications')
    .select('*')
    .eq('customer_id', userId)
    .order('created_at', { ascending: false });

  if (error) throwDbError('notifications', error.message);
  return (data ?? []).map(rowToNotification);
}

export async function dbMarkNotificationRead(notifId: string): Promise<void> {
  const client = assertOrderBackend();
  if (!client) {
    const notifications = lsGetNotifications();
    const idx = notifications.findIndex(notification => notification.id === notifId);
    if (idx !== -1) {
      notifications[idx].read = true;
      lsSetNotifications(notifications);
    }
    return;
  }

  const { error } = await client.from('notifications').update({ read: true }).eq('id', notifId);
  if (error) throwDbError('notifications', error.message);
}

export async function dbMarkAllNotificationsRead(userId: string): Promise<void> {
  const client = assertOrderBackend();
  if (!client) {
    lsSetNotifications(
      lsGetNotifications().map(notification =>
        notification.userId === userId ? { ...notification, read: true } : notification
      )
    );
    return;
  }

  const { error } = await client
    .from('notifications')
    .update({ read: true })
    .eq('customer_id', userId)
    .eq('read', false);

  if (error) throwDbError('notifications', error.message);
}
