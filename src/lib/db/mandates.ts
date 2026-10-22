import { getDb, bigIntToNumber, numberToBigInt } from "./client";

export type MandateInput = {
  name: string;
  budgetMinor: number;
  currency: string;
  minUnspentMinor?: number;
  preferredBrands?: string[];
  excludedBrands?: string[];
  requiredAttributes?: Record<string, string | number | boolean>;
  maxQuantityPerItem?: number;
  maxTotalItems?: number;
  allowedProviders?: string[];
  excludedProviders?: string[];
  allowedDestinations?: string[];
  maxListingAgeMinutes?: number;
  active?: boolean;
};

export type MandateDTO = {
  id: string;
  userId: string;
  name: string;
  active: boolean;
  budgetMinor: number;
  currency: string;
  minUnspentMinor: number;
  preferredBrands: string[];
  excludedBrands: string[];
  requiredAttributes: Record<string, string | number | boolean>;
  maxQuantityPerItem: number;
  maxTotalItems: number;
  allowedProviders: string[];
  excludedProviders: string[];
  allowedDestinations: string[];
  maxListingAgeMinutes: number;
  createdAt: string;
  updatedAt: string;
};

type MandateRow = {
  id: string;
  userId: string;
  name: string;
  active: boolean;
  budgetMinor: bigint;
  currency: string;
  minUnspentMinor: bigint;
  preferredBrands: string[];
  excludedBrands: string[];
  requiredAttributes: unknown;
  maxQuantityPerItem: number;
  maxTotalItems: number;
  allowedProviders: string[];
  excludedProviders: string[];
  allowedDestinations: string[];
  maxListingAgeMinutes: number;
  createdAt: Date;
  updatedAt: Date;
};

function toDTO(row: MandateRow): MandateDTO {
  const attrs =
    row.requiredAttributes && typeof row.requiredAttributes === "object" && !Array.isArray(row.requiredAttributes)
      ? (row.requiredAttributes as Record<string, string | number | boolean>)
      : {};
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    active: row.active,
    budgetMinor: bigIntToNumber(row.budgetMinor)!,
    currency: row.currency,
    minUnspentMinor: bigIntToNumber(row.minUnspentMinor)!,
    preferredBrands: row.preferredBrands,
    excludedBrands: row.excludedBrands,
    requiredAttributes: attrs,
    maxQuantityPerItem: row.maxQuantityPerItem,
    maxTotalItems: row.maxTotalItems,
    allowedProviders: row.allowedProviders,
    excludedProviders: row.excludedProviders,
    allowedDestinations: row.allowedDestinations,
    maxListingAgeMinutes: row.maxListingAgeMinutes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function createMandate(userId: string, input: MandateInput): Promise<MandateDTO> {
  const row = await getDb().mandate.create({
    data: {
      userId,
      name: input.name,
      active: input.active ?? true,
      budgetMinor: numberToBigInt(input.budgetMinor),
      currency: input.currency,
      minUnspentMinor: numberToBigInt(input.minUnspentMinor ?? 0),
      preferredBrands: input.preferredBrands ?? [],
      excludedBrands: input.excludedBrands ?? [],
      requiredAttributes: input.requiredAttributes ?? {},
      maxQuantityPerItem: input.maxQuantityPerItem ?? 5,
      maxTotalItems: input.maxTotalItems ?? 20,
      allowedProviders: input.allowedProviders ?? [],
      excludedProviders: input.excludedProviders ?? [],
      allowedDestinations: input.allowedDestinations ?? [],
      maxListingAgeMinutes: input.maxListingAgeMinutes ?? 1440,
    },
  });
  return toDTO(row);
}

export async function listMandates(userId: string): Promise<MandateDTO[]> {
  const rows = await getDb().mandate.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toDTO);
}

export async function getMandate(userId: string, id: string): Promise<MandateDTO | null> {
  const row = await getDb().mandate.findFirst({ where: { id, userId } });
  return row ? toDTO(row) : null;
}

export async function updateMandate(
  userId: string,
  id: string,
  input: Partial<MandateInput>
): Promise<MandateDTO | null> {
  const db = getDb();
  const existing = await db.mandate.findFirst({ where: { id, userId } });
  if (!existing) return null;
  const row = await db.mandate.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
      ...(input.budgetMinor !== undefined ? { budgetMinor: numberToBigInt(input.budgetMinor) } : {}),
      ...(input.currency !== undefined ? { currency: input.currency } : {}),
      ...(input.minUnspentMinor !== undefined
        ? { minUnspentMinor: numberToBigInt(input.minUnspentMinor) }
        : {}),
      ...(input.preferredBrands !== undefined ? { preferredBrands: input.preferredBrands } : {}),
      ...(input.excludedBrands !== undefined ? { excludedBrands: input.excludedBrands } : {}),
      ...(input.requiredAttributes !== undefined
        ? { requiredAttributes: input.requiredAttributes }
        : {}),
      ...(input.maxQuantityPerItem !== undefined
        ? { maxQuantityPerItem: input.maxQuantityPerItem }
        : {}),
      ...(input.maxTotalItems !== undefined ? { maxTotalItems: input.maxTotalItems } : {}),
      ...(input.allowedProviders !== undefined ? { allowedProviders: input.allowedProviders } : {}),
      ...(input.excludedProviders !== undefined ? { excludedProviders: input.excludedProviders } : {}),
      ...(input.allowedDestinations !== undefined
        ? { allowedDestinations: input.allowedDestinations }
        : {}),
      ...(input.maxListingAgeMinutes !== undefined
        ? { maxListingAgeMinutes: input.maxListingAgeMinutes }
        : {}),
    },
  });
  return toDTO(row);
}

export async function deleteMandate(userId: string, id: string): Promise<boolean> {
  const db = getDb();
  const existing = await db.mandate.findFirst({ where: { id, userId } });
  if (!existing) return false;
  await db.mandate.delete({ where: { id } });
  return true;
}
