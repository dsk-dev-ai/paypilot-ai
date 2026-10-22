import { describe, expect, test } from "vitest";
import {
  GENESIS_HASH,
  ledgerEntryHash,
  verifyLedgerChain,
  type LedgerChainEntry,
} from "@/lib/mandate/ledger";

function chain(): LedgerChainEntry[] {
  const firstInput = {
    seq: 1,
    at: "2026-10-22T00:00:00.000Z",
    type: "CONSENT_GRANTED",
    subjectId: "c_1",
    detail: { planId: "p_1", contentHash: "abc" },
  };
  const firstHash = ledgerEntryHash(GENESIS_HASH, firstInput);
  const secondInput = {
    seq: 2,
    at: "2026-10-22T00:01:00.000Z",
    type: "PAYMENT_CAPTURED",
    subjectId: "o_1",
    detail: { amountMinor: 3998 },
  };
  const secondHash = ledgerEntryHash(firstHash, secondInput);
  return [
    { ...firstInput, prevHash: GENESIS_HASH, hash: firstHash },
    { ...secondInput, prevHash: firstHash, hash: secondHash },
  ];
}

describe("ledger chain", () => {
  test("verifies a valid chain", () => {
    const result = verifyLedgerChain(chain());
    expect(result.ok).toBe(true);
    expect(result.count).toBe(2);
    expect(result.head).toBe(chain()[1].hash);
  });

  test("detects a tampered entry", () => {
    const entries = chain();
    entries[1] = { ...entries[1], detail: { amountMinor: 1 } };
    const result = verifyLedgerChain(entries);
    expect(result.ok).toBe(false);
    expect(result.brokenAtSeq).toBe(2);
    expect(result.reason).toBe("entry hash mismatch");
  });

  test("detects a broken parent link", () => {
    const entries = chain();
    entries[1] = { ...entries[1], prevHash: GENESIS_HASH };
    const result = verifyLedgerChain(entries);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("prevHash mismatch");
  });

  test("detects a sequence gap", () => {
    const entries = chain();
    entries[1] = { ...entries[1], seq: 3 };
    const result = verifyLedgerChain(entries);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("sequence gap");
  });

  test("an empty chain is valid and starts at genesis", () => {
    const result = verifyLedgerChain([]);
    expect(result).toMatchObject({ ok: true, count: 0, head: GENESIS_HASH });
  });
});
