import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { getDb } from "./client";
import type { OrderDTO } from "./orders";
import { getCatalogProduct } from "@/lib/catalog/products";

export type FulfillmentItem = {
  externalId: string;
  title: string;
  quantity: number;
  deliverableType: string;
  licenseKey: string | null;
  fileName: string | null;
};

export type FulfillmentDTO = {
  id: string;
  orderId: string;
  userId: string;
  status: string;
  items: FulfillmentItem[];
  deliveredAt: string;
};

type FulfillmentRow = {
  id: string;
  orderId: string;
  userId: string;
  status: string;
  items: Prisma.JsonValue;
  deliveredAt: Date;
};

function toDTO(row: FulfillmentRow): FulfillmentDTO {
  const items = Array.isArray(row.items) ? (row.items as unknown as FulfillmentItem[]) : [];
  return {
    id: row.id,
    orderId: row.orderId,
    userId: row.userId,
    status: row.status,
    items,
    deliveredAt: row.deliveredAt.toISOString(),
  };
}

/** Human-readable license key, e.g. PP-8F2A-11C9-77DE. */
export function newLicenseKey(): string {
  const hex = randomBytes(6).toString("hex").toUpperCase();
  return `PP-${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}`;
}

export async function getFulfillment(userId: string, orderId: string): Promise<FulfillmentDTO | null> {
  const row = await getDb().fulfillment.findFirst({ where: { orderId, userId } });
  return row ? toDTO(row) : null;
}

/**
 * Deliver digital goods for a PAID order. Idempotent — a retried capture or a
 * double return-URL load returns the existing delivery instead of minting new
 * license keys.
 *
 * Only the built-in PayPilot Store is fulfilled here. External merchant
 * handoffs are never marked as fulfilled because we cannot verify them.
 */
export async function fulfillOrder(userId: string, order: OrderDTO): Promise<FulfillmentDTO | null> {
  const paypilotItems = order.items.filter((it) => it.provider === "paypilot");
  if (paypilotItems.length === 0) return null;

  const existing = await getDb().fulfillment.findUnique({ where: { orderId: order.id } });
  if (existing) return toDTO(existing);

  const items: FulfillmentItem[] = paypilotItems.map((it) => {
    const product = getCatalogProduct(it.externalId);
    const deliverable = product?.deliverable;
    const type = deliverable?.type ?? "download";
    return {
      externalId: it.externalId,
      title: it.title,
      quantity: it.quantity,
      deliverableType: type,
      licenseKey: type === "license" || type === "service" ? newLicenseKey() : newLicenseKey(),
      fileName: deliverable?.fileName ?? null,
    };
  });

  try {
    const row = await getDb().fulfillment.create({
      data: {
        orderId: order.id,
        userId,
        status: "DELIVERED",
        items: items as unknown as Prisma.InputJsonValue,
      },
    });
    return toDTO(row);
  } catch {
    const raced = await getDb().fulfillment.findUnique({ where: { orderId: order.id } });
    return raced ? toDTO(raced) : null;
  }
}
