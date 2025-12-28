-- CreateTable
CREATE TABLE IF NOT EXISTS "Portfolio" (
    "id" SERIAL PRIMARY KEY,
    "name" TEXT NOT NULL DEFAULT 'Default',
    "baseCurrency" TEXT NOT NULL DEFAULT 'USD',
    "cashBalance" DECIMAL NOT NULL DEFAULT 100000
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Position" (
    "id" SERIAL PRIMARY KEY,
    "portfolioId" INTEGER NOT NULL,
    "symbol" TEXT NOT NULL,
    "qty" DECIMAL NOT NULL,
    "avgPrice" DECIMAL NOT NULL,
    CONSTRAINT "Position_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Trade" (
    "id" SERIAL PRIMARY KEY,
    "portfolioId" INTEGER NOT NULL,
    "symbol" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "qty" DECIMAL NOT NULL,
    "price" DECIMAL NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Trade_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SymbolResolution" (
    "id" SERIAL PRIMARY KEY,
    "query" TEXT NOT NULL,
    "resultSymbol" TEXT NOT NULL,
    "mic" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "LlmProvider" (
    "id" SERIAL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'openai-compatible',
    "apiBase" TEXT NOT NULL,
    "apiKey" TEXT,
    "model" TEXT NOT NULL,
    "temperature" DOUBLE PRECISION DEFAULT 0,
    "maxTokens" INTEGER,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PortfolioPrompt" (
    "id" SERIAL PRIMARY KEY,
    "portfolioId" INTEGER NOT NULL,
    "providerId" INTEGER,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "systemPrompt" TEXT NOT NULL,
    "userTemplate" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PortfolioPrompt_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PortfolioPrompt_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "LlmProvider" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "LlmExecution" (
    "id" SERIAL PRIMARY KEY,
    "portfolioId" INTEGER NOT NULL,
    "promptId" INTEGER,
    "providerId" INTEGER,
    "status" TEXT NOT NULL,
    "requestPayload" TEXT NOT NULL,
    "responseJson" TEXT,
    "responseText" TEXT,
    "errorMessage" TEXT,
    "executedOrders" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LlmExecution_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LlmExecution_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "PortfolioPrompt" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LlmExecution_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "LlmProvider" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SymbolResolution_query_idx" ON "SymbolResolution"("query");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LlmProvider_isDefault_idx" ON "LlmProvider"("isDefault");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PortfolioPrompt_portfolioId_idx" ON "PortfolioPrompt"("portfolioId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PortfolioPrompt_providerId_idx" ON "PortfolioPrompt"("providerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LlmExecution_portfolioId_idx" ON "LlmExecution"("portfolioId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LlmExecution_promptId_idx" ON "LlmExecution"("promptId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LlmExecution_providerId_idx" ON "LlmExecution"("providerId");
