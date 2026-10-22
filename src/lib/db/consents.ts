import { Prisma } from "@prisma/client";
import { getDb, bigIntToNumber, numberToBigInt } from "./client";
import type { ConsentSnapshot } from "@/lib/mandate/consent";

export type ConsentDTO = {
  id: string;
  planId: string;
  mandateId: string | null;
  currency: string;
  subtotalMinor: number;
  itemCount: number;
  decision: string;
  snapshot: ConsentSnapshot;
  contentHash: string;
  approvedAt: string;
  expiresAt: string;
  consumedAt: string | null;
  revokedAt: string | null;
};

type ConsentRow = {
  id: string;
  planId: string;
  mandateId: string | null;
  currency: string;
  subtotalMinor: bigint;
  itemCount: number;
  decision: string;
  snapshot: Prisma.JsonValue;
  contentHash: string;
  approvedAt: Date;
  expiresAt: Date;
  consumedAt: Date | null;
  revokedAt: Date | null;
};

function toDTO(row: ConsentRow): ConsentDTO {
  return {
    id: row.id,
    planId: row.planId,
    mandateId: row.mandateId,
    currency: row.currency,
    subtotalMinor: bigIntToNumber(row.subtotalMinor)!,
    itemCount: row.itemCount,
    decision: row.decision,
    snapshot: row.snapshot as unknown as ConsentSnapshot,
    contentHash: row.contentHash,
    approvedAt: row.approvedAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    consumedAt: row.consumedAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
  };
}

/**
 * Persist a new consent artifact and revoke any older unused consent for the
 * same plan. Re-approving a plan therefore invalidates the previous cart hash.
 */
export async function createConsent(input: {
  userId: string;
  planId: string;
  mandateId: string | null;
  snapshot: ConsentSnapshot;
  contentHash: string;
}): Promise<ConsentDTO> {
  const db = getDb();
  const row = await db.$transaction(async (tx) => {
    await tx.purchaseConsent.updateMany({
      where: { userId: input.userId, planId: input.planId, revokedAt: null, consumedAt: null },
      data: { revokedAt: new Date() },
    });
    return tx.purchaseConsent.create({
      data: {
        userId: input.userId,
        planId: input.planId,
        mandateId: input.mandateId,
        currency: input.snapshot.currency,
        subtotalMinor: numberToBigInt(input.snapshot.subtotalMinor),
        itemCount: input.snapshot.itemCount,
        decision: input.snapshot.decision,
        snapshot: input.snapshot as unknown as Prisma.InputJsonValue,
        contentHash: input.contentHash,
        approvedAt: new Date(input.snapshot.approvedAt),
        expiresAt: new Date(input.snapshot.expiresAt),
      },
    });
  });
  return toDTO(row);
}

export async function getConsent(userId: string, consentId: string): Promise<ConsentDTO | null> {
  const row = await getDb().purchaseConsent.findFirst({
    where: { id: consentId, userId },
  });
  return row ? toDTO(row) : null;
}

/** Latest non-revoked consent for a plan (may already be consumed). */
export async function getLatestConsent(userId: string, planId: string): Promise<ConsentDTO | null> {
  const row = await getDb().purchaseConsent.findFirst({
    where: { userId, planId, revokedAt: null },
    orderBy: { approvedAt: "desc" },
  });
  return row ? toDTO(row) : null;
}

export async function consumeConsent(userId: string, consentId: string): Promise<ConsentDTO | null> {
  const row = await getDb().purchaseConsent.updateMany({
    where: { id: consentId, userId, consumedAt: null, revokedAt: null },
    data: { consumedAt: new Date() },
  });
  if (row.count === 0) return null;
  return getConsent(userId, consentId);
}
