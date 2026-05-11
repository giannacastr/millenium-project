-- AlterTable
ALTER TABLE "User" ALTER COLUMN "pending" SET DEFAULT false;

-- CreateTable
CREATE TABLE "Holding" (
    "id" SERIAL NOT NULL,
    "ticker" TEXT NOT NULL,
    "shares" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Holding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskLimit" (
    "id" SERIAL NOT NULL,
    "singleNameCapPct" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "sectorCapPct" DOUBLE PRECISION NOT NULL DEFAULT 30,
    "grossExposureCapPct" DOUBLE PRECISION NOT NULL DEFAULT 180,
    "netExposureCapPct" DOUBLE PRECISION NOT NULL DEFAULT 70,
    "buyingPowerUsedCapPct" DOUBLE PRECISION NOT NULL DEFAULT 90,
    "maxOrderNotional" DOUBLE PRECISION NOT NULL DEFAULT 5000000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskLimit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Holding_ticker_key" ON "Holding"("ticker");
