-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "consentHash" TEXT,
ADD COLUMN     "consentId" TEXT;

-- CreateTable
CREATE TABLE "PurchaseConsent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "mandateId" TEXT,
    "currency" TEXT NOT NULL,
    "subtotalMinor" BIGINT NOT NULL,
    "itemCount" INTEGER NOT NULL,
    "decision" TEXT NOT NULL DEFAULT 'ALLOW',
    "snapshot" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "PurchaseConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "userId" TEXT,
    "subjectId" TEXT,
    "detail" JSONB,
    "prevHash" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fulfillment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DELIVERED',
    "items" JSONB NOT NULL,
    "deliveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Fulfillment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseConsent_contentHash_key" ON "PurchaseConsent"("contentHash");

-- CreateIndex
CREATE INDEX "PurchaseConsent_userId_approvedAt_idx" ON "PurchaseConsent"("userId", "approvedAt");

-- CreateIndex
CREATE INDEX "PurchaseConsent_planId_idx" ON "PurchaseConsent"("planId");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerEntry_seq_key" ON "LedgerEntry"("seq");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerEntry_hash_key" ON "LedgerEntry"("hash");

-- CreateIndex
CREATE INDEX "LedgerEntry_createdAt_idx" ON "LedgerEntry"("createdAt");

-- CreateIndex
CREATE INDEX "LedgerEntry_subjectId_idx" ON "LedgerEntry"("subjectId");

-- CreateIndex
CREATE INDEX "LedgerEntry_type_idx" ON "LedgerEntry"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Fulfillment_orderId_key" ON "Fulfillment"("orderId");

-- CreateIndex
CREATE INDEX "Fulfillment_userId_deliveredAt_idx" ON "Fulfillment"("userId", "deliveredAt");

-- CreateIndex
CREATE INDEX "Order_consentId_idx" ON "Order"("consentId");

-- AddForeignKey
ALTER TABLE "PurchaseConsent" ADD CONSTRAINT "PurchaseConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseConsent" ADD CONSTRAINT "PurchaseConsent_planId_fkey" FOREIGN KEY ("planId") REFERENCES "ShoppingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fulfillment" ADD CONSTRAINT "Fulfillment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
