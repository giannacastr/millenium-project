-- CreateTable RestrictedStock
CREATE TABLE "RestrictedStock" (
    "id" SERIAL NOT NULL,
    "ticker" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestrictedStock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RestrictedStock_ticker_key" ON "RestrictedStock"("ticker");
