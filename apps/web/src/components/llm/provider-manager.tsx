"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  type LlmProviderType,
  useCreateLlmProvider,
  useDeleteLlmProvider,
  useLlmProviders,
  useUpdateLlmProvider
} from "@/hooks/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ProviderDraft {
  name: string;
  type: LlmProviderType;
  apiBase: string;
  apiKey: string;
  model: string;
  temperature: string;
  maxTokens: string;
  isDefault: boolean;
}

const defaultDraft: ProviderDraft = {
  name: "",
  type: "openai-compatible",
  apiBase: "",
  apiKey: "",
  model: "",
  temperature: "0",
  maxTokens: "",
  isDefault: false
};

function toNumberOrUndefined(value: string) {
  if (value.trim() === "") {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function LlmProviderManager() {
  const { data, isLoading, isError } = useLlmProviders();
  const createMutation = useCreateLlmProvider();
  const updateMutation = useUpdateLlmProvider();
  const deleteMutation = useDeleteLlmProvider();

  const [draft, setDraft] = useState<ProviderDraft>(defaultDraft);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingDraft, setEditingDraft] = useState<ProviderDraft | null>(null);

  const providers = useMemo(() => data?.providers ?? [], [data?.providers]);

  const resetDraft = () => {
    setDraft(defaultDraft);
  };

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    createMutation.mutate(
      {
        name: draft.name.trim(),
        type: draft.type,
        apiBase: draft.apiBase.trim(),
        apiKey: draft.apiKey.trim() || undefined,
        model: draft.model.trim(),
        temperature: toNumberOrUndefined(draft.temperature),
        maxTokens: toNumberOrUndefined(draft.maxTokens),
        isDefault: draft.isDefault
      },
      {
        onSuccess: resetDraft
      }
    );
  };

  const startEditing = (id: number) => {
    const provider = providers.find((item) => item.id === id);
    if (!provider) {
      return;
    }
    setEditingId(id);
    setEditingDraft({
      name: provider.name,
      type: provider.type,
      apiBase: provider.apiBase,
      apiKey: "",
      model: provider.model,
      temperature: provider.temperature !== null ? String(provider.temperature) : "",
      maxTokens: provider.maxTokens !== null ? String(provider.maxTokens) : "",
      isDefault: provider.isDefault
    });
  };

  const cancelEditing = () => {
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
          type: editingDraft.type,
          apiBase: editingDraft.apiBase.trim(),
          apiKey: editingDraft.apiKey.trim() === "" ? undefined : editingDraft.apiKey,
          model: editingDraft.model.trim(),
          temperature: toNumberOrUndefined(editingDraft.temperature),
          maxTokens: toNumberOrUndefined(editingDraft.maxTokens),
          isDefault: editingDraft.isDefault
        }
      },
      {
        onSuccess: cancelEditing
      }
    );
  };

  const clearProviderApiKey = (id: number) => {
    updateMutation.mutate({ id, payload: { apiKey: null } });
  };

  const setProviderDefault = (id: number) => {
    updateMutation.mutate({ id, payload: { isDefault: true } });
  };

  const removeProvider = (id: number) => {
    if (!confirm("Delete this provider configuration?")) {
      return;
    }
    deleteMutation.mutate(id);
  };

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <header>
        <h2 className="text-xl font-semibold text-foreground">LLM Providers</h2>
        <p className="text-sm text-muted-foreground">Configure API endpoints and defaults.</p>
      </header>

      <form className="grid gap-3 md:grid-cols-2" onSubmit={handleCreate}>
        <div className="md:col-span-2">
          <h3 className="text-sm font-semibold text-foreground">Add Provider</h3>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="provider-name">Name</Label>
          <Input
            id="provider-name"
            value={draft.name}
            onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
            required
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="provider-type">Type</Label>
          <select
            id="provider-type"
            className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground"
            value={draft.type}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, type: event.target.value as LlmProviderType }))
            }
          >
            <option value="openai-compatible">OpenAI-compatible</option>
            <option value="local">Local</option>
            <option value="google-gemini">Google Gemini</option>
            <option value="anthropic">Anthropic</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="provider-api-base">API Base URL</Label>
          <Input
            id="provider-api-base"
            value={draft.apiBase}
            onChange={(event) => setDraft((prev) => ({ ...prev, apiBase: event.target.value }))}
            required
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="provider-model">Model</Label>
          <Input
            id="provider-model"
            value={draft.model}
            onChange={(event) => setDraft((prev) => ({ ...prev, model: event.target.value }))}
            required
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="provider-temperature">Temperature</Label>
          <Input
            id="provider-temperature"
            value={draft.temperature}
            onChange={(event) => setDraft((prev) => ({ ...prev, temperature: event.target.value }))}
            type="number"
            step="0.1"
            min="0"
            max="2"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="provider-max-tokens">Max tokens</Label>
          <Input
            id="provider-max-tokens"
            value={draft.maxTokens}
            onChange={(event) => setDraft((prev) => ({ ...prev, maxTokens: event.target.value }))}
            type="number"
            min="1"
          />
        </div>
        <div className="flex flex-col gap-1 md:col-span-2">
          <Label htmlFor="provider-api-key">API Key (optional)</Label>
          <Input
            id="provider-api-key"
            value={draft.apiKey}
            placeholder="sk-..."
            onChange={(event) => setDraft((prev) => ({ ...prev, apiKey: event.target.value }))}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={draft.isDefault}
            onChange={(event) => setDraft((prev) => ({ ...prev, isDefault: event.target.checked }))}
          />
          Set as default provider
        </label>
        <div className="md:col-span-2">
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? "Creating..." : "Add provider"}
          </Button>
        </div>
      </form>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Configured providers</h3>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading providers...</p>
        ) : isError ? (
          <p className="text-sm text-rose-600">Unable to load providers.</p>
        ) : providers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No providers configured yet.</p>
        ) : (
          <ul className="space-y-3">
            {providers.map((provider) => {
              const isEditing = editingId === provider.id && editingDraft;
              return (
                <li key={provider.id} className="rounded-lg border border-border p-4">
                  {isEditing && editingDraft ? (
                    <form className="grid gap-3 md:grid-cols-2" onSubmit={handleUpdate}>
                      <div className="md:col-span-2">
                        <h4 className="text-sm font-semibold text-foreground">Edit provider</h4>
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label htmlFor={`edit-name-${provider.id}`}>Name</Label>
                        <Input
                          id={`edit-name-${provider.id}`}
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
                        <Label htmlFor={`edit-type-${provider.id}`}>Type</Label>
                        <select
                          id={`edit-type-${provider.id}`}
                          className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground"
                          value={editingDraft.type}
                          onChange={(event) =>
                            setEditingDraft((prev) =>
                              prev
                                ? { ...prev, type: event.target.value as LlmProviderType }
                                : prev
                            )
                          }
                        >
                          <option value="openai-compatible">OpenAI-compatible</option>
                          <option value="local">Local</option>
                          <option value="google-gemini">Google Gemini</option>
                          <option value="anthropic">Anthropic</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label htmlFor={`edit-api-base-${provider.id}`}>API Base URL</Label>
                        <Input
                          id={`edit-api-base-${provider.id}`}
                          value={editingDraft.apiBase}
                          onChange={(event) =>
                            setEditingDraft((prev) =>
                              prev ? { ...prev, apiBase: event.target.value } : prev
                            )
                          }
                          required
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label htmlFor={`edit-model-${provider.id}`}>Model</Label>
                        <Input
                          id={`edit-model-${provider.id}`}
                          value={editingDraft.model}
                          onChange={(event) =>
                            setEditingDraft((prev) =>
                              prev ? { ...prev, model: event.target.value } : prev
                            )
                          }
                          required
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label htmlFor={`edit-temperature-${provider.id}`}>Temperature</Label>
                        <Input
                          id={`edit-temperature-${provider.id}`}
                          value={editingDraft.temperature}
                          onChange={(event) =>
                            setEditingDraft((prev) =>
                              prev ? { ...prev, temperature: event.target.value } : prev
                            )
                          }
                          type="number"
                          step="0.1"
                          min="0"
                          max="2"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label htmlFor={`edit-max-tokens-${provider.id}`}>Max tokens</Label>
                        <Input
                          id={`edit-max-tokens-${provider.id}`}
                          value={editingDraft.maxTokens}
                          onChange={(event) =>
                            setEditingDraft((prev) =>
                              prev ? { ...prev, maxTokens: event.target.value } : prev
                            )
                          }
                          type="number"
                          min="1"
                        />
                      </div>
                      <div className="flex flex-col gap-1 md:col-span-2">
                        <Label htmlFor={`edit-api-key-${provider.id}`}>
                          API Key (leave blank to keep unchanged)
                        </Label>
                        <Input
                          id={`edit-api-key-${provider.id}`}
                          value={editingDraft.apiKey}
                          onChange={(event) =>
                            setEditingDraft((prev) =>
                              prev ? { ...prev, apiKey: event.target.value } : prev
                            )
                          }
                        />
                      </div>
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
                        Set as default provider
                      </label>
                      <div className="flex gap-2 md:col-span-2">
                        <Button type="submit" disabled={updateMutation.isPending}>
                          {updateMutation.isPending ? "Saving..." : "Save changes"}
                        </Button>
                        <Button type="button" variant="outline" onClick={cancelEditing}>
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => clearProviderApiKey(provider.id)}
                        >
                          Clear API key
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h4 className="text-sm font-semibold text-foreground">{provider.name}</h4>
                          <p className="text-xs text-muted-foreground">
                            {provider.type} • {provider.model}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => startEditing(provider.id)}>
                            Edit
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setProviderDefault(provider.id)}>
                            Set default
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => removeProvider(provider.id)}>
                            Delete
                          </Button>
                        </div>
                      </div>
                      <dl className="grid gap-1 text-xs text-muted-foreground md:grid-cols-3">
                        <div>
                          <dt className="font-semibold text-foreground">API base</dt>
                          <dd>{provider.apiBase}</dd>
                        </div>
                        <div>
                          <dt className="font-semibold text-foreground">Temperature</dt>
                          <dd>{provider.temperature ?? "—"}</dd>
                        </div>
                        <div>
                          <dt className="font-semibold text-foreground">Max tokens</dt>
                          <dd>{provider.maxTokens ?? "—"}</dd>
                        </div>
                        <div>
                          <dt className="font-semibold text-foreground">Default</dt>
                          <dd>{provider.isDefault ? "Yes" : "No"}</dd>
                        </div>
                        <div>
                          <dt className="font-semibold text-foreground">API key</dt>
                          <dd>{provider.hasApiKey ? "Configured" : "—"}</dd>
                        </div>
                        <div>
                          <dt className="font-semibold text-foreground">Updated</dt>
                          <dd>{new Date(provider.updatedAt).toLocaleString()}</dd>
                        </div>
                      </dl>
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

