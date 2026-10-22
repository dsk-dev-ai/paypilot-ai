import { Prisma } from "@prisma/client";
import { getDb } from "./client";
import {
  GENESIS_HASH,
  ledgerEntryHash,
  verifyLedgerChain,
  type LedgerChainEntry,
  type LedgerVerification,
} from "@/lib/mandate/ledger";

const LEDGER_LOCK_ID = 736271;

export type LedgerDTO = {
  id: string;
  seq: number;
  type: string;
  userId: string | null;
  subjectId: string | null;
  detail: Record<string, unknown> | null;
  prevHash: string;
  hash: string;
  createdAt: string;
};

type LedgerRow = {
  id: string;
  seq: number;
  type: string;
  userId: string | null;
  subjectId: string | null;
  detail: Prisma.JsonValue;
  prevHash: string;
  hash: string;
  createdAt: Date;
};

function toDTO(row: LedgerRow): LedgerDTO {
  return {
    id: row.id,
    seq: row.seq,
    type: row.type,
    userId: row.userId,
    subjectId: row.subjectId,
    detail: (row.detail as Record<string, unknown> | null) ?? null,
    prevHash: row.prevHash,
    hash: row.hash,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Append one entry to the global hash chain. A Postgres advisory lock
 * serializes appends so two concurrent requests can never claim the same
 * sequence number or read the same parent hash.
 */
export async function appendLedgerEntry(input: {
  type: string;
  userId?: string | null;
  subjectId?: string | null;
  detail?: Record<string, unknown> | null;
}): Promise<LedgerDTO> {
  const db = getDb();
  const row = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LEDGER_LOCK_ID})`;
    const last = await tx.ledgerEntry.findFirst({ orderBy: { seq: "desc" } });
    const seq = (last?.seq ?? 0) + 1;
    const prevHash = last?.hash ?? GENESIS_HASH;
    const at = new Date().toISOString();
    const detail = input.detail ?? null;
    const hash = ledgerEntryHash(prevHash, {
      seq,
      at,
      type: input.type,
      subjectId: input.subjectId ?? null,
      detail,
    });
    return tx.ledgerEntry.create({
      data: {
        seq,
        type: input.type,
        userId: input.userId ?? null,
        subjectId: input.subjectId ?? null,
        detail: detail as Prisma.InputJsonValue | undefined,
        prevHash,
        hash,
        createdAt: new Date(at),
      },
    });
  });
  return toDTO(row);
}

export async function listLedgerEntries(limit = 20): Promise<LedgerDTO[]> {
  const rows = await getDb().ledgerEntry.findMany({
    orderBy: { seq: "desc" },
    take: limit,
  });
  return rows.map(toDTO);
}

export async function verifyLedger(): Promise<LedgerVerification> {
  const rows = await getDb().ledgerEntry.findMany({ orderBy: { seq: "asc" } });
  const entries: LedgerChainEntry[] = rows.map((row) => ({
    seq: row.seq,
    at: row.createdAt.toISOString(),
    type: row.type,
    subjectId: row.subjectId,
    detail: (row.detail as Record<string, unknown> | null) ?? null,
    prevHash: row.prevHash,
    hash: row.hash,
  }));
  return verifyLedgerChain(entries);
}
