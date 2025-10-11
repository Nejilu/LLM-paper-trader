-- CreateTable
CREATE TABLE IF NOT EXISTS "LlmRunSchedule" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "portfolioId" INTEGER NOT NULL,
    "promptId" INTEGER,
    "providerId" INTEGER,
    "frequency" TEXT NOT NULL,
    "timeOfDay" TEXT NOT NULL,
    "dayOfWeek" INTEGER,
    "dayOfMonth" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LlmRunSchedule_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LlmRunSchedule_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "PortfolioPrompt" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LlmRunSchedule_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "LlmProvider" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LlmRunSchedule_portfolioId_idx" ON "LlmRunSchedule"("portfolioId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LlmRunSchedule_promptId_idx" ON "LlmRunSchedule"("promptId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LlmRunSchedule_providerId_idx" ON "LlmRunSchedule"("providerId");
