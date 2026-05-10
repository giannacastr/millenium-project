-- Migrate UserType enum to desk roles
CREATE TYPE "UserType_new" AS ENUM ('EQUITY_TRADER', 'RISK_OFFICER', 'PRIME_BROKER');

ALTER TABLE "User" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "type" TYPE "UserType_new" USING (
  CASE "type"::text
    WHEN 'STAFF' THEN 'EQUITY_TRADER'::"UserType_new"
    WHEN 'PARTNER' THEN 'PRIME_BROKER'::"UserType_new"
    ELSE 'EQUITY_TRADER'::"UserType_new"
  END
);

ALTER TABLE "UserInvite" ALTER COLUMN "userType" TYPE "UserType_new" USING (
  CASE "userType"::text
    WHEN 'STAFF' THEN 'EQUITY_TRADER'::"UserType_new"
    WHEN 'PARTNER' THEN 'PRIME_BROKER'::"UserType_new"
    ELSE 'EQUITY_TRADER'::"UserType_new"
  END
);

DROP TYPE "UserType";
ALTER TYPE "UserType_new" RENAME TO "UserType";

-- Order enums and tables
CREATE TYPE "OrderDirection" AS ENUM ('BUY', 'SELL', 'SHORT');
CREATE TYPE "OrderTypeEnum" AS ENUM ('MARKET', 'LIMIT', 'VWAP');
CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'IN_REVIEW', 'RISK_APPROVED', 'ACKNOWLEDGED', 'PARTIALLY_FILLED', 'FULLY_FILLED', 'REJECTED', 'CANCELLED');

CREATE TABLE "Order" (
    "id" SERIAL NOT NULL,
    "ticketKey" TEXT NOT NULL,
    "title" TEXT,
    "direction" "OrderDirection" NOT NULL,
    "ticker" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "orderType" "OrderTypeEnum" NOT NULL,
    "limitPrice" DECIMAL(18,4),
    "account" TEXT NOT NULL,
    "strategy" TEXT NOT NULL,
    "notes" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'DRAFT',
    "traderId" INTEGER NOT NULL,
    "reviewedById" INTEGER,
    "riskApprovedWithConditions" BOOLEAN NOT NULL DEFAULT false,
    "brokerRejectReason" TEXT,
    "brokerRejectCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrderActivity" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "actorName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderActivity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RiskBreachLog" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "checkType" TEXT NOT NULL,
    "breachDetail" TEXT,
    "resolution" TEXT,
    "actorUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskBreachLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Order_ticketKey_key" ON "Order"("ticketKey");
CREATE INDEX "Order_status_idx" ON "Order"("status");
CREATE INDEX "Order_traderId_idx" ON "Order"("traderId");
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");
CREATE INDEX "OrderActivity_orderId_idx" ON "OrderActivity"("orderId");
CREATE INDEX "RiskBreachLog_orderId_idx" ON "RiskBreachLog"("orderId");

ALTER TABLE "Order" ADD CONSTRAINT "Order_traderId_fkey" FOREIGN KEY ("traderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrderActivity" ADD CONSTRAINT "OrderActivity_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RiskBreachLog" ADD CONSTRAINT "RiskBreachLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
