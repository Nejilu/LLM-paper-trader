"use client";

import { FormEvent, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  RunFrequency,
  useCreateRunSchedule,
  useDeleteRunSchedule,
  useLlmProviders,
  usePortfolioPrompts,
  usePortfolioRunSchedules,
  useUpdateRunSchedule
} from "@/hooks/api";

interface Props {
  portfolioId?: number;
}

interface FormState {
  promptId: string;
  providerId: string;
  frequency: RunFrequency;
  timeOfDay: string;
  dayOfWeek: string;
  dayOfMonth: string;
  isActive: boolean;
}

const defaultForm: FormState = {
  promptId: "",
  providerId: "",
  frequency: "daily",
  timeOfDay: "09:00",
  dayOfWeek: "1",
  dayOfMonth: "1",
  isActive: true
};

const daysOfWeek: Array<{ value: string; label: string }> = [
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" }
];

const daysOfMonth = Array.from({ length: 31 }, (_, index) => {
  const value = (index + 1).toString();
  return { value, label: value };
});

export function LlmAutomationPanel({ portfolioId }: Props) {
  const { data: providersData } = useLlmProviders();
  const { data: promptsData } = usePortfolioPrompts(portfolioId);
  const schedulesQuery = usePortfolioRunSchedules(portfolioId);
  const createSchedule = useCreateRunSchedule(portfolioId);
  const updateSchedule = useUpdateRunSchedule(portfolioId);
  const deleteSchedule = useDeleteRunSchedule(portfolioId);

  const providers = useMemo(() => providersData?.providers ?? [], [providersData?.providers]);
  const prompts = useMemo(() => promptsData?.prompts ?? [], [promptsData?.prompts]);
  const schedules = useMemo(() => schedulesQuery.data?.schedules ?? [], [schedulesQuery.data?.schedules]);

  const [form, setForm] = useState<FormState>({ ...defaultForm });
  const [message, setMessage] = useState<
    | {
        text: string;
        tone: "info" | "error" | "success";
      }
    | null
  >(null);

  if (!portfolioId) {
    return null;
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);

    if (form.frequency === "weekly" && form.dayOfWeek.trim() === "") {
      setMessage({
        text: "Choose a weekday for a weekly automation.",
        tone: "error"
      });
      return;
    }

    if (form.frequency === "monthly" && form.dayOfMonth.trim() === "") {
      setMessage({
        text: "Choose a day of the month for a monthly automation.",
        tone: "error"
      });
      return;
    }

    const payload = {
      promptId: form.promptId ? Number(form.promptId) : undefined,
      providerId: form.providerId ? Number(form.providerId) : undefined,
      frequency: form.frequency,
      timeOfDay: form.timeOfDay,
      dayOfWeek: form.frequency === "weekly" ? Number(form.dayOfWeek) : undefined,
      dayOfMonth: form.frequency === "monthly" ? Number(form.dayOfMonth) : undefined,
      isActive: form.isActive
    };

    createSchedule.mutate(payload, {
      onSuccess: () => {
        setForm({ ...defaultForm });
        setMessage({ text: "Automation saved successfully.", tone: "success" });
      },
      onError: (error) => {
        setMessage({
          text: (error as Error)?.message ?? "Unable to save the automation.",
          tone: "error"
        });
      }
    });
  };

  const handleToggleActive = (scheduleId: number, nextActive: boolean) => {
    setMessage(null);
    updateSchedule.mutate(
      { id: scheduleId, payload: { isActive: nextActive } },
      {
        onError: (error) => {
          setMessage({
            text: (error as Error)?.message ?? "Unable to update the automation.",
            tone: "error"
          });
        }
      }
    );
  };

  const handleDelete = (scheduleId: number) => {
    setMessage(null);
    deleteSchedule.mutate(scheduleId, {
      onError: (error) => {
        setMessage({
          text: (error as Error)?.message ?? "Unable to delete the automation.",
          tone: "error"
        });
      }
    });
  };

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <header>
        <h2 className="text-xl font-semibold text-foreground">Automations</h2>
        <p className="text-sm text-muted-foreground">
          Schedule automated model runs for this portfolio.
        </p>
      </header>

      <form className="grid gap-3 md:grid-cols-2" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-1">
          <Label htmlFor="automation-prompt">Prompt</Label>
          <select
            id="automation-prompt"
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
          <Label htmlFor="automation-provider">Provider</Label>
          <select
            id="automation-provider"
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
          <Label htmlFor="automation-frequency">Frequency</Label>
          <select
            id="automation-frequency"
            className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground"
            value={form.frequency}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, frequency: event.target.value as RunFrequency }))
            }
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="automation-time">Time</Label>
          <Input
            id="automation-time"
            type="time"
            value={form.timeOfDay}
            onChange={(event) => setForm((prev) => ({ ...prev, timeOfDay: event.target.value }))}
          />
        </div>
        {form.frequency === "weekly" ? (
          <div className="flex flex-col gap-1">
            <Label htmlFor="automation-weekday">Day of the week</Label>
            <select
              id="automation-weekday"
              className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground"
              value={form.dayOfWeek}
              onChange={(event) => setForm((prev) => ({ ...prev, dayOfWeek: event.target.value }))}
            >
              {daysOfWeek.map((day) => (
                <option key={day.value} value={day.value}>
                  {day.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        {form.frequency === "monthly" ? (
          <div className="flex flex-col gap-1">
            <Label htmlFor="automation-monthday">Day of the month</Label>
            <select
              id="automation-monthday"
              className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground"
              value={form.dayOfMonth}
              onChange={(event) => setForm((prev) => ({ ...prev, dayOfMonth: event.target.value }))}
            >
              {daysOfMonth.map((day) => (
                <option key={day.value} value={day.value}>
                  {day.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))}
          />
          Activate the automation immediately
        </label>
        <div className="md:col-span-2 flex gap-2">
          <Button type="submit" disabled={createSchedule.isPending}>
            {createSchedule.isPending ? "Saving..." : "Add automation"}
          </Button>
          <Button type="button" variant="outline" onClick={() => setForm({ ...defaultForm })}>
            Reset
          </Button>
        </div>
      </form>

      {message ? (
        <p
          className={`text-sm ${
            message.tone === "error"
              ? "text-rose-600"
              : message.tone === "success"
                ? "text-emerald-600"
                : "text-muted-foreground"
          }`}
        >
          {message.text}
        </p>
      ) : null}

      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Active schedules
        </h3>
        {schedulesQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading automations...</p>
        ) : schedulesQuery.isError ? (
          <p className="text-sm text-rose-600">Unable to load automations.</p>
        ) : schedules.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No automations are configured for this portfolio yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {schedules.map((schedule) => (
              <li
                key={schedule.id}
                className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-foreground"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <p className="font-semibold">{describeSchedule(schedule)}</p>
                    <p className="text-xs text-muted-foreground">
                      {schedule.prompt ? `Prompt: ${schedule.prompt.name}` : "Default prompt"} • {" "}
                      {schedule.provider ? `Provider: ${schedule.provider.name}` : "Default provider"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleToggleActive(schedule.id, !schedule.isActive)}
                      disabled={updateSchedule.isPending}
                    >
                      {schedule.isActive ? "Pause" : "Activate"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(schedule.id)}
                      disabled={deleteSchedule.isPending}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Status: {schedule.isActive ? "Active" : "Paused"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function describeSchedule(schedule: {
  frequency: RunFrequency;
  timeOfDay: string;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
}) {
  switch (schedule.frequency) {
    case "daily":
      return `Daily run at ${schedule.timeOfDay}`;
    case "weekly": {
      const label =
        daysOfWeek.find((day) => Number(day.value) === schedule.dayOfWeek)?.label ?? "unknown day";
      return `Weekly run on ${label} at ${schedule.timeOfDay}`;
    }
    case "monthly": {
      if (schedule.dayOfMonth) {
        return `Monthly run on day ${schedule.dayOfMonth} at ${schedule.timeOfDay}`;
      }
      return `Monthly run at ${schedule.timeOfDay}`;
    }
    default:
      return `Automation scheduled at ${schedule.timeOfDay}`;
  }
}
