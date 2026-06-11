export type OrderStatus = 'Pending' | 'Confirmed' | 'Preparing' | 'Out for Delivery' | 'Delivered' | 'Cancelled';

export interface OrderItem {
  productId: string;
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
}

export interface Notification {
  id: string;
  userId: string;
  orderId: string;
  message: string;
  createdAt: string;
  read: boolean;
}
