"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { LlmAutomationPanel } from "@/components/llm/run-automation-panel";
import { LlmExecutionHistory } from "@/components/llm/execution-history";
import { LlmProviderManager } from "@/components/llm/provider-manager";
import { PortfolioPromptManager } from "@/components/llm/prompt-manager";
import { LlmRunnerPanel } from "@/components/llm/runner-panel";
import { usePortfolios } from "@/hooks/api";

export default function LlmConsolePage() {
  const { data: portfoliosData } = usePortfolios();
  const portfolios = useMemo(() => portfoliosData?.portfolios ?? [], [portfoliosData?.portfolios]);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!selectedPortfolioId && portfolios.length > 0) {
      setSelectedPortfolioId(portfolios[0].id);
    }
  }, [portfolios, selectedPortfolioId]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-6 py-8">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">LLM Automation Console</h1>
          <p className="text-sm text-muted-foreground">
            Manage providers, prompts, and run paper-trading automations per portfolio.
          </p>
        </div>
        <Link href="/" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
          Back to dashboard
        </Link>
      </header>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Portfolio</h2>
        {portfolios.length === 0 ? (
          <p className="text-sm text-muted-foreground">Create a portfolio first to configure prompts.</p>
        ) : (
          <select
            className="w-full max-w-xs rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground"
            value={selectedPortfolioId ?? ""}
            onChange={(event) =>
              setSelectedPortfolioId(event.target.value ? Number(event.target.value) : undefined)
            }
          >
            {portfolios.map((portfolio) => (
              <option key={portfolio.id} value={portfolio.id}>
                {portfolio.name} ({portfolio.baseCurrency})
              </option>
            ))}
          </select>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <div className="flex flex-col gap-6">
          <LlmProviderManager />
          <PortfolioPromptManager portfolioId={selectedPortfolioId} />
        </div>
        <div className="flex flex-col gap-6">
          <LlmAutomationPanel portfolioId={selectedPortfolioId} />
          <LlmRunnerPanel portfolioId={selectedPortfolioId} />
          <LlmExecutionHistory portfolioId={selectedPortfolioId} />
        </div>
      </div>
    </main>
  );
}

