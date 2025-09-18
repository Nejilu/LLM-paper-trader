import type { Application } from "express";
import { prisma } from "@paper-trading/db";
import type { LlmExecution, LlmProvider, PortfolioPrompt as PrismaPortfolioPrompt } from "@paper-trading/db";
import { z } from "zod";
import { runLlmPlan } from "./llmService";
import { ARBITRAGE_JSON_SCHEMA } from "./llmSchema";
import { getPortfolioRecord, parsePortfolioIdStrict } from "./portfolioService";

const providerInputSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["openai-compatible", "local"]).default("openai-compatible"),
  apiBase: z.string().min(1),
  apiKey: z.string().optional(),
  model: z.string().min(1),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  isDefault: z.boolean().optional()
});

const providerUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(["openai-compatible", "local"]).optional(),
  apiBase: z.string().min(1).optional(),
  apiKey: z.union([z.string(), z.null()]).optional(),
  model: z.string().min(1).optional(),
  temperature: z.number().min(0).max(2).nullable().optional(),
  maxTokens: z.number().int().positive().nullable().optional(),
  isDefault: z.boolean().optional()
});

const promptInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  systemPrompt: z.string().optional(),
  userTemplate: z.string().optional(),
  providerId: z.number().int().positive().optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional()
});

const promptUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  systemPrompt: z.string().optional(),
  userTemplate: z.string().optional(),
  providerId: z.number().int().positive().nullable().optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional()
});

const llmRunSchema = z.object({
  promptId: z.number().int().positive().optional(),
  providerId: z.number().int().positive().optional(),
  overrides: z
    .object({
      temperature: z.number().min(0).max(2).optional(),
      maxTokens: z.number().int().positive().optional(),
      model: z.string().min(1).optional()
    })
    .optional(),
  dryRun: z.boolean().optional()
});

export function registerLlmRoutes(app: Application) {
  app.get("/api/llm/schema", (_req, res) => {
    res.json(ARBITRAGE_JSON_SCHEMA);
  });

  app.get("/api/llm/providers", async (_req, res) => {
    try {
      const providers = await prisma.llmProvider.findMany({
        orderBy: { createdAt: "asc" }
      });
      res.json({ providers: providers.map(mapProvider) });
    } catch (error) {
      console.error("List providers failed", error);
      res.status(500).json({ error: "Unable to fetch LLM providers" });
    }
  });

  app.post("/api/llm/providers", async (req, res) => {
    try {
      const body = providerInputSchema.parse(req.body ?? {});
      const created = await prisma.$transaction(async (tx) => {
        if (body.isDefault) {
          await tx.llmProvider.updateMany({ data: { isDefault: false }, where: { isDefault: true } });
        }

        return tx.llmProvider.create({
          data: {
            name: body.name,
            type: body.type,
            apiBase: body.apiBase.trim(),
            apiKey: body.apiKey ?? null,
            model: body.model,
            temperature: body.temperature ?? null,
            maxTokens: body.maxTokens ?? null,
            isDefault: body.isDefault ?? false
          }
        });
      });

      res.status(201).json({ provider: mapProvider(created) });
    } catch (error) {
      console.error("Create provider failed", error);
      res.status(400).json({ error: error instanceof Error ? error.message : "Invalid provider payload" });
    }
  });

  app.put("/api/llm/providers/:id", async (req, res) => {
    try {
      const providerId = Number.parseInt(req.params.id, 10);
      if (!Number.isFinite(providerId)) {
        return res.status(400).json({ error: "Invalid provider id" });
      }
      const body = providerUpdateSchema.parse(req.body ?? {});

      const provider = await prisma.llmProvider.findUnique({ where: { id: providerId } });
      if (!provider) {
        return res.status(404).json({ error: "Provider not found" });
      }

      const updated = await prisma.$transaction(async (tx) => {
        if (body.isDefault) {
          await tx.llmProvider.updateMany({
            where: { NOT: { id: providerId } },
            data: { isDefault: false }
          });
        }

        const data: Record<string, unknown> = {};
        if (body.name !== undefined) data.name = body.name;
        if (body.type !== undefined) data.type = body.type;
        if (body.apiBase !== undefined) data.apiBase = body.apiBase.trim();
        if (body.model !== undefined) data.model = body.model;
        if (body.temperature !== undefined) data.temperature = body.temperature ?? null;
        if (body.maxTokens !== undefined) data.maxTokens = body.maxTokens ?? null;
        if (body.isDefault !== undefined) data.isDefault = body.isDefault;
        if (body.apiKey !== undefined) data.apiKey = body.apiKey ?? null;

        return tx.llmProvider.update({ where: { id: providerId }, data });
      });

      res.json({ provider: mapProvider(updated) });
    } catch (error) {
      console.error("Update provider failed", error);
      res.status(400).json({ error: error instanceof Error ? error.message : "Invalid provider update" });
    }
  });

  app.delete("/api/llm/providers/:id", async (req, res) => {
    try {
      const providerId = Number.parseInt(req.params.id, 10);
      if (!Number.isFinite(providerId)) {
        return res.status(400).json({ error: "Invalid provider id" });
      }

      await prisma.llmProvider.delete({ where: { id: providerId } });
      res.json({ success: true });
    } catch (error) {
      console.error("Delete provider failed", error);
      res.status(400).json({ error: error instanceof Error ? error.message : "Unable to delete provider" });
    }
  });

  app.get("/api/portfolios/:id/prompts", async (req, res) => {
    try {
      const portfolioId = parsePortfolioIdStrict(req.params.id);
      await getPortfolioRecord(portfolioId);

      const prompts = await prisma.portfolioPrompt.findMany({
        where: { portfolioId },
        orderBy: { createdAt: "asc" },
        include: { provider: true }
      });

      res.json({ prompts: prompts.map((prompt) => mapPrompt(prompt)) });
    } catch (error) {
      console.error("List prompts failed", error);
      res.status(400).json({ error: error instanceof Error ? error.message : "Unable to fetch prompts" });
    }
  });

  app.post("/api/portfolios/:id/prompts", async (req, res) => {
    try {
      const portfolioId = parsePortfolioIdStrict(req.params.id);
      await getPortfolioRecord(portfolioId);
      const body = promptInputSchema.parse(req.body ?? {});

      if (body.providerId) {
        const providerExists = await prisma.llmProvider.findUnique({ where: { id: body.providerId } });
        if (!providerExists) {
          return res.status(404).json({ error: "Provider not found" });
        }
      }

      const created = await prisma.$transaction(async (tx) => {
        if (body.isDefault) {
          await tx.portfolioPrompt.updateMany({
            where: { portfolioId },
            data: { isDefault: false }
          });
        }

        return tx.portfolioPrompt.create({
          data: {
            portfolioId,
            providerId: body.providerId ?? null,
            name: body.name,
            description: body.description ?? null,
            systemPrompt: body.systemPrompt ?? "",
            userTemplate: body.userTemplate ?? "",
            isDefault: body.isDefault ?? false,
            isActive: body.isActive ?? true
          },
          include: { provider: true }
        });
      });

      res.status(201).json({ prompt: mapPrompt(created) });
    } catch (error) {
      console.error("Create prompt failed", error);
      res.status(400).json({ error: error instanceof Error ? error.message : "Invalid prompt payload" });
    }
  });

  app.put("/api/portfolios/:id/prompts/:promptId", async (req, res) => {
    try {
      const portfolioId = parsePortfolioIdStrict(req.params.id);
      await getPortfolioRecord(portfolioId);
      const promptId = Number.parseInt(req.params.promptId, 10);
      if (!Number.isFinite(promptId)) {
        return res.status(400).json({ error: "Invalid prompt id" });
      }

      const body = promptUpdateSchema.parse(req.body ?? {});
      const prompt = await prisma.portfolioPrompt.findUnique({ where: { id: promptId }, include: { provider: true } });
      if (!prompt || prompt.portfolioId !== portfolioId) {
        return res.status(404).json({ error: "Prompt not found" });
      }

      if (body.providerId) {
        const providerExists = await prisma.llmProvider.findUnique({ where: { id: body.providerId } });
        if (!providerExists) {
          return res.status(404).json({ error: "Provider not found" });
        }
      }

      const updated = await prisma.$transaction(async (tx) => {
        if (body.isDefault) {
          await tx.portfolioPrompt.updateMany({
            where: { portfolioId, NOT: { id: promptId } },
            data: { isDefault: false }
          });
        }

        const data: Record<string, unknown> = {};
        if (body.name !== undefined) data.name = body.name;
        if (body.description !== undefined) data.description = body.description ?? null;
        if (body.systemPrompt !== undefined) data.systemPrompt = body.systemPrompt ?? "";
        if (body.userTemplate !== undefined) data.userTemplate = body.userTemplate ?? "";
        if (body.providerId !== undefined) data.providerId = body.providerId ?? null;
        if (body.isDefault !== undefined) data.isDefault = body.isDefault;
        if (body.isActive !== undefined) data.isActive = body.isActive;

        return tx.portfolioPrompt.update({
          where: { id: promptId },
          data,
          include: { provider: true }
        });
      });

      res.json({ prompt: mapPrompt(updated) });
    } catch (error) {
      console.error("Update prompt failed", error);
      res.status(400).json({ error: error instanceof Error ? error.message : "Invalid prompt update" });
    }
  });

  app.delete("/api/portfolios/:id/prompts/:promptId", async (req, res) => {
    try {
      const portfolioId = parsePortfolioIdStrict(req.params.id);
      const promptId = Number.parseInt(req.params.promptId, 10);
      if (!Number.isFinite(promptId)) {
        return res.status(400).json({ error: "Invalid prompt id" });
      }

      const prompt = await prisma.portfolioPrompt.findUnique({ where: { id: promptId } });
      if (!prompt || prompt.portfolioId !== portfolioId) {
        return res.status(404).json({ error: "Prompt not found" });
      }

      await prisma.portfolioPrompt.delete({ where: { id: promptId } });
      res.json({ success: true });
    } catch (error) {
      console.error("Delete prompt failed", error);
      res.status(400).json({ error: error instanceof Error ? error.message : "Unable to delete prompt" });
    }
  });

  app.get("/api/portfolios/:id/llm/executions", async (req, res) => {
    try {
      const portfolioId = parsePortfolioIdStrict(req.params.id);
      await getPortfolioRecord(portfolioId);

      const executions = await prisma.llmExecution.findMany({
        where: { portfolioId },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          provider: true,
          prompt: { include: { provider: true } }
        }
      });

      res.json({ executions: executions.map((execution) => mapExecution(execution)) });
    } catch (error) {
      console.error("List executions failed", error);
      res.status(400).json({ error: error instanceof Error ? error.message : "Unable to fetch LLM executions" });
    }
  });

  app.post("/api/portfolios/:id/llm/run", async (req, res) => {
    try {
      const portfolioId = parsePortfolioIdStrict(req.params.id);
      await getPortfolioRecord(portfolioId);
      const body = llmRunSchema.parse(req.body ?? {});

      const prompt = body.promptId
        ? await prisma.portfolioPrompt.findFirst({
            where: { id: body.promptId, portfolioId },
            include: { provider: true }
          })
        : await prisma.portfolioPrompt.findFirst({
            where: { portfolioId, isDefault: true, isActive: true },
            include: { provider: true }
          });

      if (body.promptId && !prompt) {
        return res.status(404).json({ error: "Prompt not found" });
      }

      const provider = await resolveProvider(body.providerId, prompt?.providerId ?? prompt?.provider?.id ?? null);
      if (!provider) {
        return res.status(400).json({ error: "No LLM provider configured" });
      }

      const execution = await prisma.llmExecution.create({
        data: {
          portfolioId,
          promptId: prompt?.id ?? null,
          providerId: provider.id,
          status: "pending",
          requestPayload: JSON.stringify(body)
        }
      });

      try {
        const result = await runLlmPlan({
          portfolioId,
          prompt: prompt ? mapPromptForRun(prompt) : null,
          provider,
          overrides: body.overrides,
          dryRun: body.dryRun ?? false
        });

        const status = result.executed ? "completed" : body.dryRun ? "dry-run" : "planned";

        await prisma.llmExecution.update({
          where: { id: execution.id },
          data: {
            status,
            responseText: result.assistantMessage,
            responseJson: JSON.stringify(result.plan),
            executedOrders: JSON.stringify(result.trades),
            errorMessage: null
          }
        });

        res.json({
          executionId: execution.id,
          status,
          plan: result.plan,
          trades: result.trades,
          executed: result.executed,
          snapshot: result.snapshot ?? null,
          provider: mapProvider(provider),
          prompt: prompt ? mapPrompt(prompt) : null,
          context: result.context,
          messages: result.messages,
          systemPrompt: result.systemPrompt,
          userPrompt: result.userPrompt,
          assistantMessage: result.assistantMessage
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "LLM run failed";
        await prisma.llmExecution.update({
          where: { id: execution.id },
          data: {
            status: "error",
            errorMessage: message,
            responseText: error instanceof Error && "stack" in error ? String(error.stack) : null
          }
        });
        console.error("LLM run failed", error);
        res.status(400).json({ error: message });
      }
    } catch (error) {
      console.error("Run LLM pipeline failed", error);
      res.status(400).json({ error: error instanceof Error ? error.message : "Unable to run LLM pipeline" });
    }
  });
}

function mapProvider(provider: LlmProvider) {
  return {
    id: provider.id,
    name: provider.name,
    type: provider.type,
    apiBase: provider.apiBase,
    model: provider.model,
    temperature: provider.temperature,
    maxTokens: provider.maxTokens,
    isDefault: provider.isDefault,
    hasApiKey: Boolean(provider.apiKey),
    createdAt: provider.createdAt.toISOString(),
    updatedAt: provider.updatedAt.toISOString()
  };
}

function mapPrompt(prompt: PrismaPortfolioPrompt & { provider?: LlmProvider | null }) {
  return {
    id: prompt.id,
    portfolioId: prompt.portfolioId,
    name: prompt.name,
    description: prompt.description,
    systemPrompt: prompt.systemPrompt,
    userTemplate: prompt.userTemplate,
    providerId: prompt.providerId,
    isDefault: prompt.isDefault,
    isActive: prompt.isActive,
    createdAt: prompt.createdAt.toISOString(),
    updatedAt: prompt.updatedAt.toISOString(),
    provider: prompt.provider ? mapProvider(prompt.provider) : null
  };
}

function mapPromptForRun(prompt: PrismaPortfolioPrompt) {
  return {
    id: prompt.id,
    systemPrompt: prompt.systemPrompt,
    userTemplate: prompt.userTemplate
  };
}

function parseJsonSafely<T>(value: string | null): T | null {
  if (!value) {
    return null;
  }
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    console.error("Failed to parse JSON payload", error);
    return null;
  }
}

function mapExecution(execution: LlmExecution & {
  provider?: LlmProvider | null;
  prompt?: (PrismaPortfolioPrompt & { provider?: LlmProvider | null }) | null;
}) {
  return {
    id: execution.id,
    portfolioId: execution.portfolioId,
    promptId: execution.promptId,
    providerId: execution.providerId,
    status: execution.status,
    request: parseJsonSafely<Record<string, unknown>>(execution.requestPayload),
    responseJson: parseJsonSafely<Record<string, unknown>>(execution.responseJson ?? null),
    executedOrders: parseJsonSafely<unknown[]>(execution.executedOrders ?? null),
    responseText: execution.responseText,
    errorMessage: execution.errorMessage,
    createdAt: execution.createdAt.toISOString(),
    provider: execution.provider ? mapProvider(execution.provider) : null,
    prompt: execution.prompt ? mapPrompt(execution.prompt) : null
  };
}

async function resolveProvider(explicitId?: number, fallbackId?: number | null) {
  if (explicitId) {
    const provider = await prisma.llmProvider.findUnique({ where: { id: explicitId } });
    if (provider) {
      return provider;
    }
  }

  if (fallbackId) {
    const provider = await prisma.llmProvider.findUnique({ where: { id: fallbackId } });
    if (provider) {
      return provider;
    }
  }

  const defaultProvider = await prisma.llmProvider.findFirst({
    where: { isDefault: true },
    orderBy: { createdAt: "asc" }
  });
  if (defaultProvider) {
    return defaultProvider;
  }

  return prisma.llmProvider.findFirst({ orderBy: { createdAt: "asc" } });
}



