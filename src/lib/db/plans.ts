import { getDb, bigIntToNumber, numberToBigInt } from "./client";

export type PlanItemDTO = {
  id: string;
  listingRecordId: string;
  listingId: string;
  provider: string;
  externalId: string;
  title: string;
  canonicalUrl: string;
  imageUrl?: string;
  priceMinor: number;
  currency: string;
  availability: string;
  seller?: string;
  brand?: string;
  quantity: number;
  approvedPriceMinor: number | null;
  approvedAt: string | null;
  addedAt: string;
  fetchedAt: string;
};

export type PlanDTO = {
  id: string;
  userId: string;
  name: string;
  status: "DRAFT" | "APPROVED" | "CHECKOUT_IN_PROGRESS" | "CHECKED_OUT" | "CANCELED";
  currency: string;
  mandateId: string | null;
  items: PlanItemDTO[];
  subtotalMinor: number;
  updatedAt: string;
};

type PlanItemRow = {
  id: string;
  quantity: number;
  approvedPriceMinor: bigint | null;
  approvedAt: Date | null;
  addedAt: Date;
  listing: {
    id: string;
    provider: string;
    externalId: string;
    title: string;
    canonicalUrl: string;
    imageUrl: string | null;
    priceMinor: bigint;
    currency: string;
    availability: string;
    seller: string | null;
    brand: string | null;
    fetchedAt: Date;
  };
};

function toItemDTO(row: PlanItemRow): PlanItemDTO {
  return {
    id: row.id,
    listingRecordId: row.listing.id,
    listingId: `${row.listing.provider}:${row.listing.externalId}`,
    provider: row.listing.provider,
    externalId: row.listing.externalId,
    title: row.listing.title,
    canonicalUrl: row.listing.canonicalUrl,
    imageUrl: row.listing.imageUrl ?? undefined,
    priceMinor: bigIntToNumber(row.listing.priceMinor)!,
    currency: row.listing.currency,
    availability: row.listing.availability,
    seller: row.listing.seller ?? undefined,
    brand: row.listing.brand ?? undefined,
    quantity: row.quantity,
    approvedPriceMinor: bigIntToNumber(row.approvedPriceMinor) ?? null,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    addedAt: row.addedAt.toISOString(),
    fetchedAt: row.listing.fetchedAt.toISOString(),
  };
}

const itemInclude = { listing: true } as const;

async function loadPlan(planId: string): Promise<PlanDTO | null> {
  const row = await getDb().shoppingPlan.findUnique({
    where: { id: planId },
    include: { items: { include: itemInclude, orderBy: { addedAt: "asc" } } },
  });
  if (!row) return null;
  const items = row.items.map(toItemDTO);
  const subtotalMinor = items.reduce((acc, it) => acc + it.priceMinor * it.quantity, 0);
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    status: row.status,
    currency: row.currency,
    mandateId: row.mandateId,
    items,
    subtotalMinor,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getPlan(userId: string, planId: string): Promise<PlanDTO | null> {
  const plan = await loadPlan(planId);
  if (!plan || plan.userId !== userId) return null;
  return plan;
}

export async function getActiveDraftPlan(userId: string): Promise<PlanDTO | null> {
  const row = await getDb().shoppingPlan.findFirst({
    where: { userId, status: "DRAFT" },
    orderBy: { updatedAt: "desc" },
  });
  if (!row) return null;
  return loadPlan(row.id);
}

/** Most recent plan in one of the given statuses (e.g. APPROVED, CHECKOUT_IN_PROGRESS). */
export async function getLatestPlanByStatuses(
  userId: string,
  statuses: PlanDTO["status"][]
): Promise<PlanDTO | null> {
  const row = await getDb().shoppingPlan.findFirst({
    where: { userId, status: { in: statuses } },
    orderBy: { updatedAt: "desc" },
  });
  if (!row) return null;
  return loadPlan(row.id);
}

export async function createPlan(userId: string, currency: string, mandateId?: string): Promise<PlanDTO> {
  const row = await getDb().shoppingPlan.create({
    data: { userId, currency, mandateId: mandateId ?? null },
  });
  return loadPlan(row.id) as Promise<PlanDTO>;
}

/** Get or create the user's active draft plan. */
export async function getOrCreateDraftPlan(userId: string, currency: string): Promise<PlanDTO> {
  const existing = await getActiveDraftPlan(userId);
  if (existing) return existing;
  return createPlan(userId, currency);
}

export async function addListingToPlan(
  userId: string,
  currency: string,
  listingRecordId: string,
  quantity = 1
): Promise<PlanDTO> {
  const db = getDb();
  const listing = await db.listingRecord.findUnique({ where: { id: listingRecordId } });
  if (!listing) throw new Error("Listing snapshot not found");
  if (listing.currency !== currency) {
    throw new Error(`Listing currency ${listing.currency} does not match plan currency ${currency}`);
  }
  const plan = await getOrCreateDraftPlan(userId, currency);
  const existing = plan.items.find((it) => it.listingRecordId === listingRecordId);
  if (existing) {
    await db.planItem.update({ where: { id: existing.id }, data: { quantity: existing.quantity + quantity } });
  } else {
    await db.planItem.create({
      data: { planId: plan.id, listingId: listingRecordId, quantity },
    });
  }
  await db.shoppingPlan.update({ where: { id: plan.id }, data: { updatedAt: new Date() } });
  return loadPlan(plan.id) as Promise<PlanDTO>;
}

export async function updatePlanItemQuantity(
  userId: string,
  itemId: string,
  quantity: number
): Promise<PlanDTO | null> {
  const db = getDb();
  const item = await db.planItem.findUnique({ where: { id: itemId }, include: { plan: true } });
  if (!item || item.plan.userId !== userId) return null;
  if (quantity <= 0) {
    await db.planItem.delete({ where: { id: itemId } });
  } else {
    await db.planItem.update({ where: { id: itemId }, data: { quantity } });
  }
  await db.shoppingPlan.update({ where: { id: item.planId }, data: { updatedAt: new Date() } });
  return loadPlan(item.planId);
}

export async function removePlanItem(userId: string, itemId: string): Promise<PlanDTO | null> {
  return updatePlanItemQuantity(userId, itemId, 0);
}

export async function approvePlanSnapshot(
  userId: string,
  planId: string
): Promise<PlanDTO | null> {
  const db = getDb();
  const plan = await getPlan(userId, planId);
  if (!plan) return null;
  const now = new Date();
  for (const item of plan.items) {
    await db.planItem.update({
      where: { id: item.id },
      data: { approvedPriceMinor: numberToBigInt(item.priceMinor), approvedAt: now },
    });
  }
  await db.shoppingPlan.update({ where: { id: planId }, data: { status: "APPROVED" } });
  return loadPlan(planId);
}

export async function setPlanStatus(
  userId: string,
  planId: string,
  status: PlanDTO["status"]
): Promise<PlanDTO | null> {
  const db = getDb();
  const plan = await db.shoppingPlan.findFirst({ where: { id: planId, userId } });
  if (!plan) return null;
  await db.shoppingPlan.update({ where: { id: planId }, data: { status } });
  return loadPlan(planId);
}
