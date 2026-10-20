import { randomUUID } from "crypto";

export type InternalOrderState =
  | "created"
  | "pending_approval"
  | "approved"
  | "capturing"
  | "completed"
  | "failed"
  | "canceled";

export type InternalOrder = {
  id: string;
  ppOrderId?: string;
  items: Array<{ productId: string; quantity: number; unitPrice: number }>;
  total: number;
  currency: "USD";
  state: InternalOrderState;
  createdAt: string;
  updatedAt: string;
};

// Simple in-memory store for demo
const orders = new Map<string, InternalOrder>();

export function createInternalOrder(items: InternalOrder["items"], total: number): InternalOrder {
  const now = new Date().toISOString();
  const order: InternalOrder = {
    id: randomUUID(),
    items,
    total,
    currency: "USD",
    state: "created",
    createdAt: now,
    updatedAt: now,
  };
  orders.set(order.id, order);
  return order;
}

export function attachPayPalOrder(internalId: string, ppOrderId: string): InternalOrder | undefined {
  const o = orders.get(internalId);
  if (!o) return undefined;
  o.ppOrderId = ppOrderId;
  o.state = "pending_approval";
  o.updatedAt = new Date().toISOString();
  orders.set(internalId, o);
  return o;
}

export function getInternalOrderById(id: string): InternalOrder | undefined {
  return orders.get(id);
}

export function getInternalOrderByPayPalId(ppOrderId: string): InternalOrder | undefined {
  for (const o of orders.values()) {
    if (o.ppOrderId === ppOrderId) return o;
  }
  return undefined;
}

export function updateInternalOrder(id: string, patch: Partial<InternalOrder>): InternalOrder | undefined {
  const o = orders.get(id);
  if (!o) return undefined;
  const updated = { ...o, ...patch, updatedAt: new Date().toISOString() };
  orders.set(id, updated);
  return updated;
}

export function getAllInternalOrders(): InternalOrder[] {
  return Array.from(orders.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
