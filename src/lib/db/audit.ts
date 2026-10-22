import { getDb } from "./client";

export async function recordAuditEvent(
  type: string,
  message: string,
  opts: {
    userId?: string;
    metadata?: Record<string, string | number | boolean | null>;
  } = {}
): Promise<void> {
  try {
    await getDb().auditEvent.create({
      data: {
        type,
        message: message.slice(0, 500),
        userId: opts.userId ?? null,
        metadata: opts.metadata ?? undefined,
      },
    });
  } catch {
    // Auditing must never break the main flow; fail silently if DB is down.
  }
}

export async function listAuditEvents(userId: string, limit = 100) {
  const rows = await getDb().auditEvent.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    message: r.message,
    metadata: r.metadata,
    createdAt: r.createdAt.toISOString(),
  }));
}
