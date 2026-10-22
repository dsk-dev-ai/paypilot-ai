import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { getDb, isDbConfigured } from "./client";

const COOKIE = "pp_uid";
const UID_RE = /^u_[0-9a-f]{32}$/;

export function isValidUserId(id: string): boolean {
  return UID_RE.test(id);
}

export function newUserId(): string {
  return `u_${randomBytes(16).toString("hex")}`;
}

/**
 * Anonymous session identity for v1.0.0: an opaque random user id stored in
 * an httpOnly cookie and persisted as a User row. Every resource query is
 * scoped by this id (ownership checks). Real login can replace this later.
 */
export async function getSessionUserId(): Promise<string> {
  const store = await cookies();
  const existing = store.get(COOKIE)?.value;
  if (existing && isValidUserId(existing)) {
    if (isDbConfigured()) {
      await ensureUser(existing);
    }
    return existing;
  }
  const id = newUserId();
  store.set(COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  if (isDbConfigured()) {
    await ensureUser(id);
  }
  return id;
}

async function ensureUser(id: string): Promise<void> {
  const db = getDb();
  await db.user.upsert({
    where: { id },
    update: {},
    create: { id },
  });
}
