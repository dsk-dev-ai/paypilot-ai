import { getDb, bigIntToNumber, numberToBigInt } from "./client";

export type OrderState =
  | "CREATED"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "CAPTURING"
  | "PAID"
  | "FAILED"
  | "CANCELED"
  | "REFUNDED";

const VALID_TRANSITIONS: Record<OrderState, OrderState[]> = {
  CREATED: ["PENDING_APPROVAL", "CANCELED", "FAILED"],
  PENDING_APPROVAL: ["APPROVED", "CANCELED", "FAILED"],
  APPROVED: ["CAPTURING", "CANCELED", "FAILED"],
  CAPTURING: ["PAID", "FAILED"],
  PAID: ["REFUNDED"],
  FAILED: ["CREATED", "CANCELED"],
  CANCELED: [],
  REFUNDED: [],
};

export function canTransition(from: OrderState, to: OrderState): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export type CreateOrderInput = {
  userId: string;
  planId?: string;
  currency: string;
  subtotalMinor: number;
  shippingMinor?: number | null;
  taxMinor?: number | null;
  totalMinor: number;
  amountIsEstimate?: boolean;
  idempotencyKey?: string;
  consentId?: string | null;
  consentHash?: string | null;
  items: Array<{
    listingRecordId?: string;
    title: string;
    provider: string;
    externalId: string;
    canonicalUrl: string;
    quantity: number;
    unitPriceMinor: number;
  }>;
};

export type OrderItemDTO = {
  id: string;
  title: string;
  provider: string;
  externalId: string;
  canonicalUrl: string;
  quantity: number;
  unitPriceMinor: number;
  currency: string;
};

export type OrderDTO = {
  id: string;
  userId: string;
  planId: string | null;
  state: OrderState;
  currency: string;
  subtotalMinor: number;
  shippingMinor: number | null;
  taxMinor: number | null;
  totalMinor: number;
  amountIsEstimate: boolean;
  paymentProvider: string | null;
  providerReference: string | null;
  environment: string;
  idempotencyKey: string | null;
  consentId: string | null;
  consentHash: string | null;
  items: OrderItemDTO[];
  createdAt: string;
  updatedAt: string;
};

type OrderRow = {
  id: string;
  userId: string;
  planId: string | null;
  state: OrderState;
  currency: string;
  subtotalMinor: bigint;
  shippingMinor: bigint | null;
  taxMinor: bigint | null;
  totalMinor: bigint;
  amountIsEstimate: boolean;
  paymentProvider: string | null;
  providerReference: string | null;
  environment: string;
  idempotencyKey: string | null;
  consentId: string | null;
  consentHash: string | null;
  createdAt: Date;
  updatedAt: Date;
  items: Array<{
    id: string;
    title: string;
    provider: string;
    externalId: string;
    canonicalUrl: string;
    quantity: number;
    unitPriceMinor: bigint;
    currency: string;
  }>;
};

function toDTO(row: OrderRow): OrderDTO {
  return {
    id: row.id,
    userId: row.userId,
    planId: row.planId,
    state: row.state,
    currency: row.currency,
    subtotalMinor: bigIntToNumber(row.subtotalMinor)!,
    shippingMinor: bigIntToNumber(row.shippingMinor) ?? null,
    taxMinor: bigIntToNumber(row.taxMinor) ?? null,
    totalMinor: bigIntToNumber(row.totalMinor)!,
    amountIsEstimate: row.amountIsEstimate,
    paymentProvider: row.paymentProvider,
    providerReference: row.providerReference,
    environment: row.environment,
    idempotencyKey: row.idempotencyKey,
    consentId: row.consentId,
    consentHash: row.consentHash,
    items: row.items.map((it) => ({
      id: it.id,
      title: it.title,
      provider: it.provider,
      externalId: it.externalId,
      canonicalUrl: it.canonicalUrl,
      quantity: it.quantity,
      unitPriceMinor: bigIntToNumber(it.unitPriceMinor)!,
      currency: it.currency,
    })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const orderInclude = { items: true } as const;

export async function createOrder(input: CreateOrderInput): Promise<OrderDTO> {
  const db = getDb();
  if (input.idempotencyKey) {
    const existing = await db.order.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: orderInclude,
    });
    if (existing) return toDTO(existing);
  }
  const row = await db.order.create({
    data: {
      userId: input.userId,
      planId: input.planId ?? null,
      currency: input.currency,
      subtotalMinor: numberToBigInt(input.subtotalMinor),
      shippingMinor: input.shippingMinor != null ? numberToBigInt(input.shippingMinor) : null,
      taxMinor: input.taxMinor != null ? numberToBigInt(input.taxMinor) : null,
      totalMinor: numberToBigInt(input.totalMinor),
      amountIsEstimate: input.amountIsEstimate ?? true,
      idempotencyKey: input.idempotencyKey ?? null,
      consentId: input.consentId ?? null,
      consentHash: input.consentHash ?? null,
      items: {
        create: input.items.map((it) => ({
          listingId: it.listingRecordId ?? null,
          title: it.title,
          provider: it.provider,
          externalId: it.externalId,
          canonicalUrl: it.canonicalUrl,
          quantity: it.quantity,
          unitPriceMinor: numberToBigInt(it.unitPriceMinor),
          currency: input.currency,
        })),
      },
    },
    include: orderInclude,
  });
  return toDTO(row);
}

export async function getOrder(userId: string, orderId: string): Promise<OrderDTO | null> {
  const row = await getDb().order.findFirst({
    where: { id: orderId, userId },
    include: orderInclude,
  });
  return row ? toDTO(row) : null;
}

export async function getOrderByProviderReference(providerReference: string): Promise<OrderDTO | null> {
  const row = await getDb().order.findUnique({
    where: { providerReference },
    include: orderInclude,
  });
  return row ? toDTO(row) : null;
}

export async function listOrders(userId: string, limit = 50): Promise<OrderDTO[]> {
  const rows = await getDb().order.findMany({
    where: { userId },
    include: orderInclude,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map(toDTO);
}

/**
 * Idempotent state transition: validates against the state machine and is a
 * no-op when already in the target state.
 */
export async function transitionOrder(
  userId: string,
  orderId: string,
  to: OrderState,
  extra: { paymentProvider?: string; providerReference?: string } = {}
): Promise<OrderDTO | null> {
  const db = getDb();
  const order = await db.order.findFirst({ where: { id: orderId, userId }, include: orderInclude });
  if (!order) return null;
  if (order.state === to) return toDTO(order);
  if (!canTransition(order.state as OrderState, to)) {
    throw new Error(`Invalid order transition ${order.state} -> ${to}`);
  }
  const row = await db.order.update({
    where: { id: orderId },
    data: {
      state: to,
      ...(extra.paymentProvider ? { paymentProvider: extra.paymentProvider } : {}),
      ...(extra.providerReference ? { providerReference: extra.providerReference } : {}),
    },
    include: orderInclude,
  });
  return toDTO(row);
}

export type PaymentAttemptInput = {
  orderId: string;
  provider: string;
  status: string;
  amountMinor: number;
  currency: string;
  providerReference?: string;
  failureCode?: string;
  failureMessage?: string;
};

export async function recordPaymentAttempt(input: PaymentAttemptInput): Promise<void> {
  await getDb().paymentAttempt.create({
    data: {
      orderId: input.orderId,
      provider: input.provider,
      status: input.status,
      amountMinor: numberToBigInt(input.amountMinor),
      currency: input.currency,
      providerReference: input.providerReference ?? null,
      failureCode: input.failureCode ?? null,
      failureMessage: input.failureMessage ?? null,
      verifiedAt: new Date(),
    },
  });
}

export async function listPaymentAttempts(orderId: string) {
  const rows = await getDb().paymentAttempt.findMany({
    where: { orderId },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    provider: r.provider,
    status: r.status,
    amountMinor: bigIntToNumber(r.amountMinor)!,
    currency: r.currency,
    providerReference: r.providerReference,
    failureCode: r.failureCode,
    createdAt: r.createdAt.toISOString(),
    verifiedAt: r.verifiedAt?.toISOString() ?? null,
  }));
}
