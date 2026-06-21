export type OrderStatus = 'Pending' | 'Confirmed' | 'Preparing' | 'Out for Delivery' | 'Delivered' | 'Cancelled';

export interface OrderItem {
  productId: string;
  variantId: string;
  productName: string;
  price: number;
  selectedSize: string;
  selectedColor: string;
  quantity: number;
}

export interface CustomerInfo {
  name: string;
  phone: string;
  governorate: string;
  city: string;
  address: string;
  notes?: string;
}

export interface Order {
  id: string;
  userId?: string;
  items: OrderItem[];
  total: number;
  deliveryFee: number;
  discountCode?: string;
  discountAmount?: number;
  status: OrderStatus;
  customer: CustomerInfo;
  createdAt: string;
  adminNotes?: string;
  cancellationRequested?: boolean;
  cancellationStatus?: "None" | "Pending" | "Approved" | "Rejected";
  cancellationReason?: string;
  cancellationRequestedAt?: string;
  cancellationResolvedAt?: string;
  cancellationAdminNote?: string;
}

export interface Notification {
  id: string;
  userId: string;
  orderId?: string | null;
  contactMessageId?: string | null;
  message: string;
  createdAt: string;
  read: boolean;
}

export type ContactMessageStatus = "open" | "customer_replied" | "pending_admin" | "admin_replied" | "closed" | "replied";

export interface ContactMessageReply {
  id: string;
  contactMessageId: string;
  senderId?: string | null;
  senderRole: "customer" | "admin";
  message: string;
  createdAt: string;
}

export interface ContactMessage {
  id: string;
  customerId: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  subject: string;
  message: string;
  orderId?: string | null;
  status: ContactMessageStatus;
  adminReply?: string | null;
  repliedBy?: string | null;
  repliedAt?: string | null;
  closedAt?: string | null;
  closedBy?: string | null;
  lastReplyAt?: string | null;
  lastReplyBy?: string | null;
  createdAt: string;
  replies?: ContactMessageReply[];
  latestReply?: ContactMessageReply | null;
  replyCount?: number;
}

export interface ShippingZone {
  id: string;
  governorate: string;
  cityArea?: string;
  deliveryFeeEgp: number;
  freeShippingMinEgp?: number | null;
  active: boolean;
  createdAt: string;
}

export interface ShippingFeeQuote {
  matched: boolean;
  fee: number | null;
  zone?: ShippingZone;
  message?: string;
}

export interface DiscountCode {
  id: string;
  code: string;
  type: "percentage" | "fixed";
  value: number;
  minimumOrderEgp: number;
  usageLimit: number | null;
  usedCount: number;
  active: boolean;
  expiresAt?: string | null;
  createdAt: string;
}

export type ReturnRequestStatus = "Pending" | "Accepted" | "Rejected" | "Completed";
export type ReturnRequestAction = "return" | "exchange";

export interface ReturnRequest {
  id: string;
  orderId: string;
  orderNumber: string;
  userId: string;
  reason: string;
  message: string;
  preferredAction: ReturnRequestAction;
  status: ReturnRequestStatus;
  adminNote?: string;
  createdAt: string;
  updatedAt?: string;
}
