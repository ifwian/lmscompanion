-- CreateTable
CREATE TABLE "rate_limits" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "reset_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "error_events" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scope" TEXT NOT NULL,
    "code" TEXT,
    "message" TEXT NOT NULL,
    "path" TEXT,

    CONSTRAINT "error_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_state" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_state_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "rate_limits_reset_at_idx" ON "rate_limits"("reset_at");

-- CreateIndex
CREATE INDEX "error_events_at_idx" ON "error_events"("at" DESC);
