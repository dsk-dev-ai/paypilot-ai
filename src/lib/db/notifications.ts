import { getDb } from "./client";

export type NotificationDTO = {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

export async function createNotification(
  userId: string,
  type: string,
  title: string,
  body: string
): Promise<void> {
  await getDb().notification.create({ data: { userId, type, title, body } });
}

export async function listNotifications(userId: string, limit = 50): Promise<NotificationDTO[]> {
  const rows = await getDb().notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    title: r.title,
    body: r.body,
    readAt: r.readAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function markNotificationRead(userId: string, id: string): Promise<boolean> {
  const db = getDb();
  const existing = await db.notification.findFirst({ where: { id, userId } });
  if (!existing) return false;
  await db.notification.update({ where: { id }, data: { readAt: new Date() } });
  return true;
}
