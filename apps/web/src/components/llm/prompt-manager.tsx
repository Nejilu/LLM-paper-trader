"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  PortfolioPrompt,
  useCreatePortfolioPrompt,
  useDeletePortfolioPrompt,
  useLlmProviders,
  usePortfolioPrompts,
  useUpdatePortfolioPrompt
} from "@/hooks/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PromptFormState {
  name: string;
  description: string;
  systemPrompt: string;
  userTemplate: string;
  providerId: string;
  isDefault: boolean;
  isActive: boolean;
}

const defaultPromptForm: PromptFormState = {
  name: "",
  description: "",
  systemPrompt: "",
  userTemplate: "",
  providerId: "",
  isDefault: false,
  isActive: true
};

interface Props {
  portfolioId?: number;
}

function toNumberOrNull(value: string) {
  if (value.trim() === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function PortfolioPromptManager({ portfolioId }: Props) {
  const { data: providersData } = useLlmProviders();
  const { data, isLoading, isError } = usePortfolioPrompts(portfolioId);
  const createMutation = useCreatePortfolioPrompt(portfolioId);
  const updateMutation = useUpdatePortfolioPrompt(portfolioId);
  const deleteMutation = useDeletePortfolioPrompt(portfolioId);

  const providers = useMemo(() => providersData?.providers ?? [], [providersData?.providers]);
  const prompts = useMemo(() => data?.prompts ?? [], [data?.prompts]);

  const [form, setForm] = useState<PromptFormState>(defaultPromptForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingDraft, setEditingDraft] = useState<PromptFormState | null>(null);

  if (!portfolioId) {
    return (
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-foreground">Prompts</h2>
        <p className="text-sm text-muted-foreground">Select a portfolio to manage prompts.</p>
      </section>
    );
  }

  const resetForm = () => {
    setForm(defaultPromptForm);
  };

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    createMutation.mutate(
      {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        systemPrompt: form.systemPrompt,
        userTemplate: form.userTemplate,
        providerId: toNumberOrNull(form.providerId) ?? undefined,
        isDefault: form.isDefault,
        isActive: form.isActive
      },
      {
        onSuccess: resetForm
      }
    );
  };

  const beginEdit = (prompt: PortfolioPrompt) => {
    setEditingId(prompt.id);
    setEditingDraft({
      name: prompt.name,
      description: prompt.description ?? "",
      systemPrompt: prompt.systemPrompt,
      userTemplate: prompt.userTemplate,
      providerId: prompt.providerId !== null ? String(prompt.providerId) : "",
      isDefault: prompt.isDefault,
      isActive: prompt.isActive
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingDraft(null);
  };

  const handleUpdate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (editingId === null || !editingDraft) {
      return;
    }
    updateMutation.mutate(
      {
        id: editingId,
        payload: {
          name: editingDraft.name.trim(),
          description: editingDraft.description.trim() || null,
          systemPrompt: editingDraft.systemPrompt,
          userTemplate: editingDraft.userTemplate,
          providerId: toNumberOrNull(editingDraft.providerId),
          isDefault: editingDraft.isDefault,
          isActive: editingDraft.isActive
        }
      },
      {
        onSuccess: cancelEdit
      }
    );
  };

  const removePrompt = (promptId: number) => {
    if (!confirm("Delete this prompt template?")) {
      return;
    }
    deleteMutation.mutate(promptId);
  };

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <header>
        <h2 className="text-xl font-semibold text-foreground">Prompts</h2>
        <p className="text-sm text-muted-foreground">Portfolio-specific LLM instructions.</p>
      </header>

      <form className="grid gap-3" onSubmit={handleCreate}>
        <h3 className="text-sm font-semibold text-foreground">Create prompt</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="prompt-name">Name</Label>
            <Input
              id="prompt-name"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="prompt-provider">Provider</Label>
            <select
              id="prompt-provider"
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
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="prompt-description">Description</Label>
          <Input
            id="prompt-description"
            value={form.description}
            onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
            placeholder="Optional notes"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="prompt-system">System prompt</Label>
          <textarea
            id="prompt-system"
            value={form.systemPrompt}
            onChange={(event) => setForm((prev) => ({ ...prev, systemPrompt: event.target.value }))}
            className="min-h-[120px] rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground"
            placeholder="Optional system instructions"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="prompt-template">User template</Label>
          <textarea
            id="prompt-template"
            value={form.userTemplate}
            onChange={(event) => setForm((prev) => ({ ...prev, userTemplate: event.target.value }))}
            className="min-h-[160px] rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground"
            placeholder="Template with placeholders ({{PORTFOLIO_JSON}} etc.)"
          />
        </div>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(event) => setForm((prev) => ({ ...prev, isDefault: event.target.checked }))}
            />
            Set as default prompt
          </label>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))}
            />
            Prompt is active
          </label>
        </div>
        <Button type="submit" disabled={createMutation.isLoading}>
          {createMutation.isLoading ? "Creating..." : "Save prompt"}
        </Button>
      </form>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Existing prompts</h3>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading prompts...</p>
        ) : isError ? (
          <p className="text-sm text-rose-600">Unable to load prompts.</p>
        ) : prompts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No prompts yet.</p>
        ) : (
          <ul className="space-y-3">
            {prompts.map((prompt) => {
              const isEditing = editingId === prompt.id && editingDraft;
              return (
                <li key={prompt.id} className="rounded-lg border border-border p-4">
                  {isEditing && editingDraft ? (
                    <form className="space-y-3" onSubmit={handleUpdate}>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="flex flex-col gap-1">
                          <Label htmlFor={`edit-prompt-name-${prompt.id}`}>Name</Label>
                          <Input
                            id={`edit-prompt-name-${prompt.id}`}
                            value={editingDraft.name}
                            onChange={(event) =>
                              setEditingDraft((prev) =>
                                prev ? { ...prev, name: event.target.value } : prev
                              )
                            }
                            required
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <Label htmlFor={`edit-prompt-provider-${prompt.id}`}>Provider</Label>
                          <select
                            id={`edit-prompt-provider-${prompt.id}`}
                            className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground"
                            value={editingDraft.providerId}
                            onChange={(event) =>
                              setEditingDraft((prev) =>
                                prev ? { ...prev, providerId: event.target.value } : prev
                              )
                            }
                          >
                            <option value="">Use default provider</option>
                            {providers.map((provider) => (
                              <option key={provider.id} value={provider.id}>
                                {provider.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label htmlFor={`edit-prompt-description-${prompt.id}`}>Description</Label>
                        <Input
                          id={`edit-prompt-description-${prompt.id}`}
                          value={editingDraft.description}
                          onChange={(event) =>
                            setEditingDraft((prev) =>
                              prev ? { ...prev, description: event.target.value } : prev
                            )
                          }
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label htmlFor={`edit-prompt-system-${prompt.id}`}>System prompt</Label>
                        <textarea
                          id={`edit-prompt-system-${prompt.id}`}
                          value={editingDraft.systemPrompt}
                          onChange={(event) =>
                            setEditingDraft((prev) =>
                              prev ? { ...prev, systemPrompt: event.target.value } : prev
                            )
                          }
                          className="min-h-[120px] rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label htmlFor={`edit-prompt-template-${prompt.id}`}>User template</Label>
                        <textarea
                          id={`edit-prompt-template-${prompt.id}`}
                          value={editingDraft.userTemplate}
                          onChange={(event) =>
                            setEditingDraft((prev) =>
                              prev ? { ...prev, userTemplate: event.target.value } : prev
                            )
                          }
                          className="min-h-[160px] rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground"
                        />
                      </div>
                      <div className="flex flex-wrap gap-4">
                        <label className="flex items-center gap-2 text-sm text-foreground">
                          <input
                            type="checkbox"
                            checked={editingDraft.isDefault}
                            onChange={(event) =>
                              setEditingDraft((prev) =>
                                prev ? { ...prev, isDefault: event.target.checked } : prev
                              )
                            }
                          />
                          Default prompt
                        </label>
                        <label className="flex items-center gap-2 text-sm text-foreground">
                          <input
                            type="checkbox"
                            checked={editingDraft.isActive}
                            onChange={(event) =>
                              setEditingDraft((prev) =>
                                prev ? { ...prev, isActive: event.target.checked } : prev
                              )
                            }
                          />
                          Active
                        </label>
                      </div>
                      <div className="flex gap-2">
                        <Button type="submit" disabled={updateMutation.isLoading}>
                          {updateMutation.isLoading ? "Saving..." : "Save"}
                        </Button>
                        <Button type="button" variant="outline" onClick={cancelEdit}>
                          Cancel
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h4 className="text-sm font-semibold text-foreground">{prompt.name}</h4>
                          <p className="text-xs text-muted-foreground">
                            {prompt.description ?? "No description"}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => beginEdit(prompt)}>
                            Edit
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => removePrompt(prompt.id)}>
                            Delete
                          </Button>
                        </div>
                      </div>
                      <dl className="grid gap-1 text-xs text-muted-foreground md:grid-cols-3">
                        <div>
                          <dt className="font-semibold text-foreground">Provider</dt>
                          <dd>{prompt.provider?.name ?? "Default"}</dd>
                        </div>
                        <div>
                          <dt className="font-semibold text-foreground">Default</dt>
                          <dd>{prompt.isDefault ? "Yes" : "No"}</dd>
                        </div>
                        <div>
                          <dt className="font-semibold text-foreground">Active</dt>
                          <dd>{prompt.isActive ? "Yes" : "No"}</dd>
                        </div>
                      </dl>
                      <details className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                        <summary className="cursor-pointer text-foreground">System prompt</summary>
                        <pre className="mt-2 whitespace-pre-wrap text-xs text-foreground">{prompt.systemPrompt || "—"}</pre>
                      </details>
                      <details className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                        <summary className="cursor-pointer text-foreground">User template</summary>
                        <pre className="mt-2 whitespace-pre-wrap text-xs text-foreground">{prompt.userTemplate || "—"}</pre>
                      </details>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

