"use client";

import { useMemo, useState } from "react";
import { LlmExecutionDto, useLlmExecutions } from "@/hooks/api";

interface Props {
  portfolioId?: number;
}

function formatJson(value: unknown) {
  if (value == null) {
    return "—";
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    return String(value);
  }
}

export function LlmExecutionHistory({ portfolioId }: Props) {
  const { data, isLoading, isError } = useLlmExecutions(portfolioId);
  const executions = useMemo(() => data?.executions ?? [], [data?.executions]);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (!portfolioId) {
    return null;
  }

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <header>
        <h2 className="text-xl font-semibold text-foreground">Execution history</h2>
        <p className="text-sm text-muted-foreground">Recent LLM runs for this portfolio.</p>
      </header>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading executions...</p>
      ) : isError ? (
        <p className="text-sm text-rose-600">Unable to load executions.</p>
      ) : executions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No executions recorded yet.</p>
      ) : (
        <ul className="space-y-3">
          {executions.map((execution) => {
            const isExpanded = expandedId === execution.id;
            return (
              <li key={execution.id} className="rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {execution.status.toUpperCase()} • {new Date(execution.createdAt).toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Provider: {execution.provider?.name ?? "Default"} • Prompt: {execution.prompt?.name ?? "Default"}
                    </p>
                    {execution.errorMessage ? (
                      <p className="text-xs text-rose-600">{execution.errorMessage}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="text-xs font-semibold text-brand-600 hover:text-brand-700"
                    onClick={() => setExpandedId(isExpanded ? null : execution.id)}
                  >
                    {isExpanded ? "Hide details" : "View details"}
                  </button>
                </div>
                {isExpanded ? <ExecutionDetails execution={execution} /> : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function ExecutionDetails({ execution }: { execution: LlmExecutionDto }) {
  return (
    <div className="mt-3 space-y-3 text-xs text-muted-foreground">
      <details className="rounded-md border border-border bg-muted/40 p-3" open>
        <summary className="cursor-pointer text-foreground">Request payload</summary>
        <pre className="mt-2 whitespace-pre-wrap text-[11px] text-foreground">{formatJson(execution.request)}</pre>
      </details>
      <details className="rounded-md border border-border bg-muted/40 p-3">
        <summary className="cursor-pointer text-foreground">Plan / response JSON</summary>
        <pre className="mt-2 whitespace-pre-wrap text-[11px] text-foreground">{formatJson(execution.responseJson)}</pre>
      </details>
      <details className="rounded-md border border-border bg-muted/40 p-3">
        <summary className="cursor-pointer text-foreground">Executed orders</summary>
        <pre className="mt-2 whitespace-pre-wrap text-[11px] text-foreground">{formatJson(execution.executedOrders)}</pre>
      </details>
      <details className="rounded-md border border-border bg-muted/40 p-3">
        <summary className="cursor-pointer text-foreground">Assistant response</summary>
        <pre className="mt-2 whitespace-pre-wrap text-[11px] text-foreground">{execution.responseText ?? "—"}</pre>
      </details>
    </div>
  );
}

