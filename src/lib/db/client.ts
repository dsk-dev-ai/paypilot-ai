import { PrismaClient } from "@prisma/client";

export class DbNotConfiguredError extends Error {
  constructor() {
    super("Database is not configured (DATABASE_URL missing)");
    this.name = "DbNotConfiguredError";
  }
}

export function isDbConfigured(): boolean {
  return !!process.env.DATABASE_URL;
}

const globalForPrisma = globalThis as unknown as { __prisma?: PrismaClient };

export function getDb(): PrismaClient {
  if (!isDbConfigured()) throw new DbNotConfiguredError();
  if (!globalForPrisma.__prisma) {
    globalForPrisma.__prisma = new PrismaClient();
  }
  return globalForPrisma.__prisma;
}

export async function pingDb(): Promise<boolean> {
  if (!isDbConfigured()) return false;
  try {
    await getDb().$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

/** Serialize a BigInt column value to a JS number, guarding precision. */
export function bigIntToNumber(value: bigint | null | undefined): number | undefined {
  if (value === null || value === undefined) return undefined;
  const n = Number(value);
  if (!Number.isSafeInteger(n)) {
    throw new Error(`BigInt value out of safe integer range: ${value.toString()}`);
  }
  return n;
}

export function numberToBigInt(value: number): bigint {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`Expected a safe integer, got ${value}`);
  }
  return BigInt(value);
}
