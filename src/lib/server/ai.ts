import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "$env/dynamic/private";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, Output } from "ai";
import { z } from "zod";

export interface AiConfig {
  enabled: boolean;
  baseUrl: string;
  model: string;
  apiKey: string;
  timeoutMs: number;
  temperature: number;
  reasoningEffort:
    | ""
    | "none"
    | "minimal"
    | "low"
    | "medium"
    | "high"
    | "xhigh";
  customInstruction: string;
}

const dataRoot = path.join(process.cwd(), "data");
const configPath = path.join(dataRoot, "ai-config.json");

const defaultConfig: AiConfig = {
  enabled: false,
  baseUrl: "http://127.0.0.1:1234",
  model: "",
  apiKey: "",
  timeoutMs: 120_000,
  temperature: 0.2,
  reasoningEffort: "",
  customInstruction: "",
};

function sanitizeInstruction(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 1_000);
}

function parseEnvBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return undefined;
}

function parseEnvNumber(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.max(1_000, parsed);
}

function clampTemperature(value: number): number {
  return Math.min(2, Math.max(0, value));
}

function parseEnvTemperature(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return undefined;
  return clampTemperature(parsed);
}

function sanitizeReasoningEffort(value: unknown): AiConfig["reasoningEffort"] {
  if (typeof value !== "string") {
    return "";
  }

  const normalized = value.trim().toLowerCase();
  if (
    normalized === "none" ||
    normalized === "minimal" ||
    normalized === "low" ||
    normalized === "medium" ||
    normalized === "high" ||
    normalized === "xhigh"
  ) {
    return normalized;
  }

  return "";
}

function applyEnvOverrides(config: AiConfig): AiConfig {
  return {
    enabled: parseEnvBoolean(env.AI_ENABLED) ?? config.enabled,
    baseUrl: env.AI_BASE_URL?.trim() || config.baseUrl,
    model: env.AI_MODEL?.trim() || config.model,
    apiKey: env.AI_API_KEY ?? config.apiKey,
    timeoutMs: parseEnvNumber(env.AI_TIMEOUT_MS) ?? config.timeoutMs,
    temperature:
      parseEnvTemperature(env.AI_TEMPERATURE) ??
      clampTemperature(config.temperature),
    reasoningEffort:
      sanitizeReasoningEffort(env.AI_REASONING_EFFORT) ||
      config.reasoningEffort,
    customInstruction:
      sanitizeInstruction(env.AI_CUSTOM_INSTRUCTION ?? "") ||
      config.customInstruction,
  };
}

async function ensureConfigFile(): Promise<void> {
  await mkdir(dataRoot, { recursive: true });
  try {
    await readFile(configPath, "utf8");
  } catch {
    await writeFile(configPath, JSON.stringify(defaultConfig, null, 2), "utf8");
  }
}

export async function getAiConfig(): Promise<AiConfig> {
  await ensureConfigFile();
  const raw = await readFile(configPath, "utf8");
  const parsed = JSON.parse(raw) as Partial<AiConfig>;

  const fileConfig: AiConfig = {
    enabled: parsed.enabled ?? defaultConfig.enabled,
    baseUrl: (parsed.baseUrl ?? defaultConfig.baseUrl).trim(),
    model: (parsed.model ?? defaultConfig.model).trim(),
    apiKey: parsed.apiKey ?? defaultConfig.apiKey,
    timeoutMs: parsed.timeoutMs ?? defaultConfig.timeoutMs,
    temperature: clampTemperature(
      typeof parsed.temperature === "number"
        ? parsed.temperature
        : defaultConfig.temperature,
    ),
    reasoningEffort: sanitizeReasoningEffort(parsed.reasoningEffort),
    customInstruction: sanitizeInstruction(
      parsed.customInstruction ?? defaultConfig.customInstruction,
    ),
  };

  return applyEnvOverrides(fileConfig);
}

export async function updateAiConfig(
  updates: Partial<AiConfig>,
): Promise<AiConfig> {
  const current = await getAiConfig();
  const merged: AiConfig = {
    ...current,
    ...updates,
    baseUrl: (updates.baseUrl ?? current.baseUrl).trim(),
    model: (updates.model ?? current.model).trim(),
    timeoutMs: Math.max(1_000, updates.timeoutMs ?? current.timeoutMs),
    temperature: clampTemperature(updates.temperature ?? current.temperature),
    reasoningEffort: sanitizeReasoningEffort(
      updates.reasoningEffort ?? current.reasoningEffort,
    ),
    customInstruction: sanitizeInstruction(
      updates.customInstruction ?? current.customInstruction,
    ),
  };

  await writeFile(configPath, JSON.stringify(merged, null, 2), "utf8");
  return merged;
}

function sanitizeTag(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\- ]+/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 36);
}

function mergeUniqueTags(input: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const tag of input) {
    const clean = sanitizeTag(tag);
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    out.push(clean);
  }
  return out.slice(0, 8);
}

function sanitizeDescription(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 240);
}

interface AutoMetadata {
  tags: string[];
  description: string;
}

const metadataSchema = z.object({
  tags: z.array(z.string()).default([]),
  description: z.string().default(""),
});

export async function generateAutoMetadata(params: {
  title: string;
  originalName: string;
  category: string;
  mimeType: string;
  existingTags: string[];
  existingDescription: string;
  textSnippet?: string;
  imageFile?: {
    mimeType: string;
    bytes: Uint8Array;
  };
  audioFile?: {
    format: "mp3" | "wav";
    bytes: Uint8Array;
  };
}): Promise<AutoMetadata> {
  const config = await getAiConfig();
  if (!config.enabled || !config.baseUrl || !config.model) {
    return {
      tags: params.existingTags,
      description: sanitizeDescription(params.existingDescription),
    };
  }

  const prompt = [
    "TASK: Generate metadata for one digital asset.",
    "OUTPUT CONTRACT (STRICT): Return ONLY a single JSON object.",
    'JSON schema: {"tags": string[], "description": string}',
    "Do not wrap JSON in markdown or code fences.",
    "Do not add extra keys, explanations, comments, or trailing text.",
    "TAGS RULES:",
    "- 3 to 6 tags when possible (never more than 6).",
    "- lowercase only.",
    "- use letters, numbers, and hyphens only.",
    "- each tag should be short (1 to 3 words joined with hyphens).",
    "- avoid generic tags unless they are genuinely descriptive.",
    "DESCRIPTION RULES:",
    "- exactly one sentence.",
    "- 90 to 180 characters when possible (hard max 200).",
    "- concise, concrete, and searchable.",
    "- no quotes, no markdown, no bullet points.",
    "- describe visible/semantic content and style.",
    "- avoid vague phrasing like 'a photo of' or 'this image shows'.",
    "- try to also mention potential uses for game development purposes.",
    `title: ${params.title}`,
    `file_name: ${params.originalName}`,
    `category: ${params.category}`,
    `mime_type: ${params.mimeType}`,
    `existing_tags: ${params.existingTags.join(", ") || "(none)"}`,
    `existing_description: ${params.existingDescription || "(none)"}`,
    config.customInstruction
      ? `custom_instruction: ${config.customInstruction}`
      : "",
    params.textSnippet
      ? `text_sample: ${params.textSnippet.slice(0, 500)}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  const provider = createOpenAI({
    baseURL: `${config.baseUrl.replace(/\/$/, "")}/v1`,
    apiKey: config.apiKey || "lm-studio",
  });

  try {
    const runGeneration = async (withReasoningEffort: boolean) => {
      const providerOptions =
        withReasoningEffort && config.reasoningEffort
          ? { openai: { reasoningEffort: config.reasoningEffort } }
          : undefined;

      return generateText({
        model: provider(config.model),
        output: Output.object({ schema: metadataSchema }),
        temperature: config.temperature,
        maxRetries: 1,
        abortSignal: controller.signal,
        providerOptions,
        system:
          "You generate asset metadata. You MUST follow the user's output contract exactly and return only valid JSON with keys tags and description.",
        prompt,
      });
    };

    let output: z.infer<typeof metadataSchema>;
    try {
      ({ output } = await runGeneration(true));
    } catch (error) {
      if (!config.reasoningEffort) {
        throw error;
      }
      console.warn(
        "AI request with reasoningEffort failed, retrying without reasoningEffort.",
      );
      ({ output } = await runGeneration(false));
    }

    const aiTags = Array.isArray(output.tags)
      ? output.tags.filter(
          (value): value is string => typeof value === "string",
        )
      : [];
    const aiDescription =
      typeof output.description === "string" ? output.description : "";

    return {
      tags: mergeUniqueTags([...params.existingTags, ...aiTags]),
      description:
        sanitizeDescription(aiDescription) ||
        sanitizeDescription(params.existingDescription),
    };
  } catch {
    console.error("AI request failed or timed out.");
    return {
      tags: params.existingTags,
      description: sanitizeDescription(params.existingDescription),
    };
  } finally {
    clearTimeout(timeout);
  }
}
