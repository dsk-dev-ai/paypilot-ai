import { canonicalJson, equalHex, sha256Hex } from "@/lib/core/canonical";

export const GENESIS_HASH = "0".repeat(64);

export type LedgerInput = {
  seq: number;
  at: string;
  type: string;
  subjectId: string | null;
  detail: Record<string, unknown> | null;
};

export type LedgerChainEntry = LedgerInput & {
  prevHash: string;
  hash: string;
};

/** entryHash = sha256(prevHash + canonicalJson(entry)) */
export function ledgerEntryHash(prevHash: string, entry: LedgerInput): string {
  return sha256Hex(prevHash + canonicalJson(entry));
}

export type LedgerVerification = {
  ok: boolean;
  count: number;
  head: string;
  brokenAtSeq: number | null;
  reason: string | null;
};

export function verifyLedgerChain(entries: LedgerChainEntry[]): LedgerVerification {
  let prev = GENESIS_HASH;
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    if (entry.seq !== i + 1) {
      return { ok: false, count: entries.length, head: prev, brokenAtSeq: entry.seq, reason: "sequence gap" };
    }
    if (!equalHex(entry.prevHash, prev)) {
      return { ok: false, count: entries.length, head: prev, brokenAtSeq: entry.seq, reason: "prevHash mismatch" };
    }
    const expected = ledgerEntryHash(entry.prevHash, {
      seq: entry.seq,
      at: entry.at,
      type: entry.type,
      subjectId: entry.subjectId,
      detail: entry.detail,
    });
    if (!equalHex(expected, entry.hash)) {
      return { ok: false, count: entries.length, head: prev, brokenAtSeq: entry.seq, reason: "entry hash mismatch" };
    }
    prev = entry.hash;
  }
  return { ok: true, count: entries.length, head: prev, brokenAtSeq: null, reason: null };
}
