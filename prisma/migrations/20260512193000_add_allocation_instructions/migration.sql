-- Add allocation lock timestamp to orders
ALTER TABLE "Order"
ADD COLUMN IF NOT EXISTS "allocationLockedAt" TIMESTAMP(3);

-- Persist pre-trade allocation instructions
CREATE TABLE IF NOT EXISTS "OrderAllocationInstruction" (
  "id" SERIAL PRIMARY KEY,
  "orderId" INTEGER NOT NULL,
  "sequence" INTEGER NOT NULL,
  "account" TEXT NOT NULL,
  "weightPct" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderAllocationInstruction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "OrderAllocationInstruction_orderId_sequence_key"
  ON "OrderAllocationInstruction"("orderId", "sequence");
CREATE INDEX IF NOT EXISTS "OrderAllocationInstruction_orderId_idx"
  ON "OrderAllocationInstruction"("orderId");

-- Persist fill-level allocation splits
CREATE TABLE IF NOT EXISTS "OrderFillAllocation" (
  "id" SERIAL PRIMARY KEY,
  "fillId" INTEGER NOT NULL,
  "instructionId" INTEGER NOT NULL,
  "shares" INTEGER NOT NULL,
  "notional" DOUBLE PRECISION NOT NULL,
  CONSTRAINT "OrderFillAllocation_fillId_fkey" FOREIGN KEY ("fillId") REFERENCES "OrderFill"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OrderFillAllocation_instructionId_fkey" FOREIGN KEY ("instructionId") REFERENCES "OrderAllocationInstruction"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "OrderFillAllocation_fillId_idx"
  ON "OrderFillAllocation"("fillId");
CREATE INDEX IF NOT EXISTS "OrderFillAllocation_instructionId_idx"
  ON "OrderFillAllocation"("instructionId");

-- Backfill a single 100% allocation for existing orders that have none yet.
INSERT INTO "OrderAllocationInstruction" ("orderId", "sequence", "account", "weightPct")
SELECT o."id", 1, o."account", 100
FROM "Order" o
LEFT JOIN "OrderAllocationInstruction" i ON i."orderId" = o."id"
WHERE i."orderId" IS NULL;
