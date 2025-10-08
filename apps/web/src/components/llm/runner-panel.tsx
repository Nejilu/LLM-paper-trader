"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  RunLlmInput,
  RunLlmResponse,
  useLlmProviders,
  usePortfolioPrompts,
  useRunLlm
} from "@/hooks/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  portfolioId?: number;
}

const defaultRunForm = {
  promptId: "",
  providerId: "",
  temperature: "",
  maxTokens: "",
  model: "",
  dryRun: false
};

function toNumber(value: string) {
  if (value.trim() === "") {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function LlmRunnerPanel({ portfolioId }: Props) {
  const { data: providersData } = useLlmProviders();
  const { data: promptsData } = usePortfolioPrompts(portfolioId);
  const runMutation = useRunLlm(portfolioId);

  const providers = useMemo(() => providersData?.providers ?? [], [providersData?.providers]);
  const prompts = useMemo(() => promptsData?.prompts ?? [], [promptsData?.prompts]);

  const [form, setForm] = useState(defaultRunForm);
  const [result, setResult] = useState<RunLlmResponse | null>(null);

  if (!portfolioId) {
    return null;
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload: RunLlmInput = {
      promptId: form.promptId ? Number(form.promptId) : undefined,
      providerId: form.providerId ? Number(form.providerId) : undefined,
      overrides:
        form.temperature || form.maxTokens || form.model
          ? {
              temperature: toNumber(form.temperature),
              maxTokens: toNumber(form.maxTokens),
              model: form.model.trim() || undefined
            }
          : undefined,
      dryRun: form.dryRun
    };

    runMutation.mutate(payload, {
      onSuccess: (data) => {
        setResult(data);
      }
    });
  };

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <header>
        <h2 className="text-xl font-semibold text-foreground">Run LLM</h2>
        <p className="text-sm text-muted-foreground">Trigger a plan for the selected portfolio.</p>
      </header>
      <form className="grid gap-3 md:grid-cols-2" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-1">
          <Label htmlFor="run-prompt">Prompt</Label>
          <select
            id="run-prompt"
            className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground"
            value={form.promptId}
            onChange={(event) => setForm((prev) => ({ ...prev, promptId: event.target.value }))}
          >
            <option value="">Use default prompt</option>
            {prompts.map((prompt) => (
              <option key={prompt.id} value={prompt.id}>
                {prompt.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="run-provider">Provider override</Label>
          <select
            id="run-provider"
            className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground"
            value={form.providerId}
            onChange={(event) => setForm((prev) => ({ ...prev, providerId: event.target.value }))}
          >
            <option value="">Use default provider</option>
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="run-temperature">Temperature override</Label>
          <Input
            id="run-temperature"
            value={form.temperature}
            onChange={(event) => setForm((prev) => ({ ...prev, temperature: event.target.value }))}
            type="number"
            step="0.1"
            min="0"
            max="2"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="run-max-tokens">Max tokens override</Label>
          <Input
            id="run-max-tokens"
            value={form.maxTokens}
            onChange={(event) => setForm((prev) => ({ ...prev, maxTokens: event.target.value }))}
            type="number"
            min="1"
          />
        </div>
        <div className="flex flex-col gap-1 md:col-span-2">
          <Label htmlFor="run-model">Model override</Label>
          <Input
            id="run-model"
            value={form.model}
            onChange={(event) => setForm((prev) => ({ ...prev, model: event.target.value }))}
            placeholder="Leave empty to use provider default"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-foreground md:col-span-2">
          <input
            type="checkbox"
            checked={form.dryRun}
            onChange={(event) => setForm((prev) => ({ ...prev, dryRun: event.target.checked }))}
          />
          Dry run (do not execute trades)
        </label>
        <div className="md:col-span-2 flex gap-2">
          <Button type="submit" disabled={runMutation.isPending}>
            {runMutation.isPending ? "Running..." : "Run LLM"}
          </Button>
          <Button type="button" variant="outline" onClick={() => setResult(null)}>
            Clear result
          </Button>
        </div>
      </form>

      {runMutation.isError ? (
        <p className="text-sm text-rose-600">{(runMutation.error as Error)?.message ?? "Run failed."}</p>
      ) : null}

      {result ? (
        <RunSummary result={result} />
      ) : (
        <p className="text-xs text-muted-foreground">
          Outputs, execution history, and trades refresh automatically after a successful run.
        </p>
      )}
    </section>
  );
}

function RunSummary({ result }: { result: RunLlmResponse }) {
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-muted/40 p-4 text-sm text-foreground">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold">Run status: {result.status.toUpperCase()}</p>
          <p className="text-xs text-muted-foreground">
            Provider: {result.provider?.name ?? "Default"} • Prompt: {result.prompt?.name ?? "Default"}
          </p>
        </div>
        <div className="text-xs text-muted-foreground">
          {result.executed ? "Trades executed" : "No trades executed"}
        </div>
      </header>
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Assistant response</h4>
        <pre className="mt-1 whitespace-pre-wrap rounded-md border border-border bg-card p-3 text-xs text-foreground">
          {result.assistantMessage}
        </pre>
      </div>
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Plan arbitrages</h4>
        {result.plan.arbitrages.length === 0 ? (
          <p className="text-xs text-muted-foreground">No trades suggested.</p>
        ) : (
          <ul className="space-y-1">
            {result.plan.arbitrages.map((order, index) => (
              <li key={`${order.symbol}-${index}`}>
                {order.action} {order.quantity} {order.symbol}
                {order.orderType === "limit" && order.limitPrice ? ` @ ${order.limitPrice}` : ""}
                {order.rationale ? ` — ${order.rationale}` : ""}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}






