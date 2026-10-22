import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { isDbConfigured, getDb } from "@/lib/db/client";
import { upsertListing } from "@/lib/db/listings";
import { createMandate, getMandate, listMandates, deleteMandate } from "@/lib/db/mandates";
import {
  addListingToPlan,
  updatePlanItemQuantity,
  approvePlanSnapshot,
} from "@/lib/db/plans";
import { createOrder, getOrder, transitionOrder, recordPaymentAttempt, listPaymentAttempts, canTransition } from "@/lib/db/orders";
import { recordAuditEvent, listAuditEvents } from "@/lib/db/audit";
import { createNotification, listNotifications, markNotificationRead } from "@/lib/db/notifications";
import { newUserId } from "@/lib/db/session";
import { parseMoney } from "@/lib/core/money";

const dbAvailable = isDbConfigured();

describe.skipIf(!dbAvailable)("repository layer against live PostgreSQL", () => {
  let userId: string;

  beforeAll(async () => {
    if (!dbAvailable) return;
    userId = newUserId();
    await getDb().user.create({ data: { id: userId } });
  });

  afterAll(async () => {
    if (!dbAvailable) return;
    const db = getDb();
    await db.user.delete({ where: { id: userId } }).catch(() => undefined);
  });

  test("listing upsert is idempotent and round-trips", async () => {
    const listing = {
      id: "testprov:SKU1",
      provider: "testprov",
      externalId: "SKU1",
      title: "Test Widget",
      canonicalUrl: "https://example.com/item/1",
      price: parseMoney("10.50", "INR"),
      availability: "IN_STOCK" as const,
      brand: "Acme",
      region: "IN" as const,
      fetchedAt: new Date().toISOString(),
      attributes: { color: "red", warranty: 12 },
    };
    const a = await upsertListing(listing);
    const b = await upsertListing({ ...listing, title: "Test Widget v2" });
    expect(a.recordId).toBe(b.recordId);
    expect(b.title).toBe("Test Widget v2");
    expect(b.price.amountMinor).toBe(1050);
    expect(b.attributes.color).toBe("red");
  });

  test("mandate CRUD with ownership", async () => {
    const m = await createMandate(userId, {
      name: "Test mandate",
      budgetMinor: 500000,
      currency: "INR",
      minUnspentMinor: 10000,
      preferredBrands: ["Acme"],
    });
    expect(m.budgetMinor).toBe(500000);
    expect(await getMandate(userId, m.id)).not.toBeNull();
    expect((await listMandates(userId)).some((x) => x.id === m.id)).toBe(true);
    expect(await deleteMandate("u_00000000000000000000000000000000", m.id)).toBe(false);
    expect(await deleteMandate(userId, m.id)).toBe(true);
  });

  test("plan add/quantity/approval snapshot", async () => {
    const listing = await upsertListing({
      id: "testprov:SKU2",
      provider: "testprov",
      externalId: "SKU2",
      title: "Plan Widget",
      canonicalUrl: "https://example.com/item/2",
      price: parseMoney("99.00", "INR"),
      availability: "IN_STOCK" as const,
      region: "IN" as const,
      fetchedAt: new Date().toISOString(),
      attributes: {},
    });
    let plan = await addListingToPlan(userId, "INR", listing.recordId, 2);
    expect(plan.items).toHaveLength(1);
    expect(plan.subtotalMinor).toBe(19800);
    plan = await addListingToPlan(userId, "INR", listing.recordId, 1);
    expect(plan.items[0].quantity).toBe(3);
    const item = plan.items[0];
    plan = (await updatePlanItemQuantity(userId, item.id, 1))!;
    expect(plan.items[0].quantity).toBe(1);
    plan = (await approvePlanSnapshot(userId, plan.id))!;
    expect(plan.status).toBe("APPROVED");
    expect(plan.items[0].approvedPriceMinor).toBe(9900);
    const empty = (await updatePlanItemQuantity(userId, item.id, 0))!;
    expect(empty.items).toHaveLength(0);
  });

  test("order lifecycle: idempotency, transitions, payment attempts", async () => {
    const input = {
      userId,
      currency: "INR",
      subtotalMinor: 10000,
      totalMinor: 10000,
      amountIsEstimate: false,
      idempotencyKey: `test-${userId}-1`,
      items: [
        {
          title: "Widget",
          provider: "testprov",
          externalId: "W1",
          canonicalUrl: "https://example.com/w1",
          quantity: 1,
          unitPriceMinor: 10000,
        },
      ],
    };
    const o1 = await createOrder(input);
    const o2 = await createOrder(input);
    expect(o1.id).toBe(o2.id);
    const p1 = await transitionOrder(userId, o1.id, "PENDING_APPROVAL", {
      paymentProvider: "paypal",
      providerReference: "PAYPAL-TEST-1",
    });
    expect(p1!.state).toBe("PENDING_APPROVAL");
    // idempotent repeat
    const p2 = await transitionOrder(userId, o1.id, "PENDING_APPROVAL");
    expect(p2!.state).toBe("PENDING_APPROVAL");
    // invalid transition rejected
    await expect(transitionOrder(userId, o1.id, "PAID")).rejects.toThrow(/Invalid order transition/);
    // ownership: wrong user cannot read
    expect(await getOrder("u_00000000000000000000000000000000", o1.id)).toBeNull();
    await transitionOrder(userId, o1.id, "APPROVED");
    await transitionOrder(userId, o1.id, "CAPTURING");
    await recordPaymentAttempt({
      orderId: o1.id,
      provider: "paypal",
      status: "COMPLETED",
      amountMinor: 10000,
      currency: "INR",
      providerReference: "CAP-1",
    });
    const done = await transitionOrder(userId, o1.id, "PAID");
    expect(done!.state).toBe("PAID");
    const attempts = await listPaymentAttempts(o1.id);
    expect(attempts).toHaveLength(1);
    expect(attempts[0].status).toBe("COMPLETED");
    expect(canTransition("PAID", "CANCELED")).toBe(false);
    expect(canTransition("CAPTURING", "PAID")).toBe(true);
  });

  test("audit events and notifications are user-scoped", async () => {
    await recordAuditEvent("TEST", "smoke test event", { userId, metadata: { k: "v" } });
    const events = await listAuditEvents(userId);
    expect(events.some((e) => e.message === "smoke test event")).toBe(true);
    await createNotification(userId, "ORDER", "Title", "Body");
    const notes = await listNotifications(userId);
    expect(notes).toHaveLength(1);
    expect(await markNotificationRead(userId, notes[0].id)).toBe(true);
    expect((await listNotifications(userId))[0].readAt).not.toBeNull();
    expect(await markNotificationRead("u_00000000000000000000000000000000", notes[0].id)).toBe(false);
  });
});
