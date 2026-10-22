import { getDb } from "./client";

export type HandoffDTO = {
  id: string;
  provider: string;
  url: string;
  orderId: string | null;
  state: "OPENED" | "CONFIRMED" | "CANCELED";
  createdAt: string;
};

type HandoffRow = {
  id: string;
  provider: string;
  url: string;
  orderId: string | null;
  state: string;
  createdAt: Date;
};

function toDTO(row: HandoffRow): HandoffDTO {
  return {
    id: row.id,
    provider: row.provider,
    url: row.url,
    orderId: row.orderId,
    state: (row.state as HandoffDTO["state"]) ?? "OPENED",
    createdAt: row.createdAt.toISOString(),
  };
}

export type CreateHandoffInput = {
  userId: string;
  provider: string;
  url: string;
  orderId?: string | null;
};

/** Records that the user was sent to a merchant's official checkout. */
export async function createHandoff(input: CreateHandoffInput): Promise<HandoffDTO> {
  const row = await getDb().externalCheckoutHandoff.create({
    data: {
      userId: input.userId,
      provider: input.provider,
      url: input.url,
      orderId: input.orderId ?? null,
      state: "OPENED",
    },
  });
  return toDTO(row);
}

export async function getHandoff(userId: string, id: string): Promise<HandoffDTO | null> {
  const row = await getDb().externalCheckoutHandoff.findFirst({ where: { id, userId } });
  return row ? toDTO(row) : null;
}

export async function listHandoffsForOrder(userId: string, orderId: string): Promise<HandoffDTO[]> {
  const rows = await getDb().externalCheckoutHandoff.findMany({
    where: { userId, orderId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toDTO);
}

/**
 * Self-reported completion of an external checkout. Mandate cannot verify
 * merchant purchases — this is explicitly labeled as the user's own record.
 */
export async function confirmHandoff(userId: string, id: string): Promise<HandoffDTO | null> {
  const db = getDb();
  const row = await db.externalCheckoutHandoff.findFirst({ where: { id, userId } });
  if (!row) return null;
  if (row.state === "CONFIRMED") return toDTO(row);
  const updated = await db.externalCheckoutHandoff.update({ where: { id: row.id }, data: { state: "CONFIRMED" } });
  return toDTO(updated);
}

export async function cancelHandoff(userId: string, id: string): Promise<HandoffDTO | null> {
  const db = getDb();
  const row = await db.externalCheckoutHandoff.findFirst({ where: { id, userId } });
  if (!row) return null;
  const updated = await db.externalCheckoutHandoff.update({ where: { id: row.id }, data: { state: "CANCELED" } });
  return toDTO(updated);
}
