-- Add partial-cancel order status
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'CANCELLED_PARTIAL';

-- Add fill state fields to orders
ALTER TABLE "Order"
ADD COLUMN IF NOT EXISTS "fillStartedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "fillCompletedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "arrivalPrice" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "averageFillPrice" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "filledQuantity" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "remainingQuantity" INTEGER NOT NULL DEFAULT 0;

UPDATE "Order"
SET "filledQuantity" = 0,
    "remainingQuantity" = "quantity"
WHERE "remainingQuantity" = 0;

-- Persist individual fills
CREATE TABLE IF NOT EXISTS "OrderFill" (
  "id" SERIAL PRIMARY KEY,
  "orderId" INTEGER NOT NULL,
  "sequence" INTEGER NOT NULL,
  "quantity" INTEGER NOT NULL,
  "price" DOUBLE PRECISION NOT NULL,
  "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderFill_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "OrderFill_orderId_sequence_key" ON "OrderFill"("orderId", "sequence");
CREATE INDEX IF NOT EXISTS "OrderFill_orderId_idx" ON "OrderFill"("orderId");