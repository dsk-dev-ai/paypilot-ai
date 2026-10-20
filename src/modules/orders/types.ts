export type OrderItem = {
  productId: string;
  quantity: number;
  unitPrice: number; // must come from catalog
};

export type OrderState =
  | "draft"
  | "pending_approval"
  | "approved"
  | "capturing"
  | "paid"
  | "failed"
  | "canceled"
  | "refunded";

export type Order = {
  id: string;
  items: OrderItem[];
  total: number;
  currency: "USD";
  state: OrderState;
  paypalOrderId?: string;
  createdAt: string;
  updatedAt: string;
};
