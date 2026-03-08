import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "$env/dynamic/private";

export interface AiConfig {
  enabled: boolean;
  baseUrl: string;
  model: string;
  apiKey: string;
  timeoutMs: number;
  customInstruction: string;
}

const dataRoot = path.join(process.cwd(), "data");
const configPath = path.join(dataRoot, "ai-config.json");

const defaultConfig: AiConfig = {
  enabled: false,
  baseUrl: "http://127.0.0.1:1234",
  model: "",
  apiKey: "",
  timeoutMs: 12_000,
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

function applyEnvOverrides(config: AiConfig): AiConfig {
  return {
    enabled: parseEnvBoolean(env.AI_ENABLED) ?? config.enabled,
    baseUrl: env.AI_BASE_URL?.trim() || config.baseUrl,
    model: env.AI_MODEL?.trim() || config.model,
    apiKey: env.AI_API_KEY ?? config.apiKey,
    timeoutMs: parseEnvNumber(env.AI_TIMEOUT_MS) ?? config.timeoutMs,
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

function parseTagsFromText(text: string): string[] {
  const rawParts = text
    .replace(/[\[\]{}]/g, "")
    .split(/[,\n]/)
    .map((part) => part.trim())
    .filter(Boolean);
  return mergeUniqueTags(rawParts);
}

function sanitizeDescription(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 240);
}

function parseDescriptionFromText(text: string): string {
  return sanitizeDescription(text.replace(/^description\s*:\s*/i, ""));
}

interface AutoMetadata {
  tags: string[];
  description: string;
}

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
    "- describe visible/semantic content, style, and likely usage.",
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

  const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
  const canAttachImage =
    !!params.imageFile &&
    params.imageFile.bytes.length > 0 &&
    params.imageFile.bytes.length <= MAX_IMAGE_BYTES &&
    params.imageFile.mimeType.startsWith("image/");

  const userContent = canAttachImage
    ? [
        { type: "text", text: prompt },
        {
          type: "image_url",
          image_url: {
            url: `data:${params.imageFile!.mimeType};base64,${Buffer.from(
              params.imageFile!.bytes,
            ).toString("base64")}`,
          },
        },
      ]
    : prompt;

  try {
    const response = await fetch(
      `${config.baseUrl.replace(/\/$/, "")}/v1/chat/completions`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(config.apiKey
            ? { authorization: `Bearer ${config.apiKey}` }
            : {}),
        },
        body: JSON.stringify({
          model: config.model,
          temperature: 0.2,
          messages: [
            {
              role: "system",
              content:
                "You generate asset metadata. You MUST follow the user's output contract exactly and return only valid JSON with keys tags and description.",
            },
            { role: "user", content: userContent },
          ],
        }),
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      return {
        tags: params.existingTags,
        description: sanitizeDescription(params.existingDescription),
      };
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = payload.choices?.[0]?.message?.content ?? "";
    let aiTags: string[] = [];
    let aiDescription = "";

    try {
      const parsed = JSON.parse(text) as {
        tags?: unknown;
        description?: unknown;
      };
      if (Array.isArray(parsed.tags)) {
        aiTags = parsed.tags.filter(
          (value): value is string => typeof value === "string",
        );
      } else if (typeof parsed.tags === "string") {
        aiTags = parseTagsFromText(parsed.tags);
      }
      if (typeof parsed.description === "string") {
        aiDescription = parsed.description;
      }
    } catch {
      aiTags = parseTagsFromText(text);
      aiDescription = parseDescriptionFromText(text);
    }

    return {
      tags: mergeUniqueTags([...params.existingTags, ...aiTags]),
      description:
        sanitizeDescription(aiDescription) ||
        sanitizeDescription(params.existingDescription),
    };
  } catch {
    return {
      tags: params.existingTags,
      description: sanitizeDescription(params.existingDescription),
    };
  } finally {
    clearTimeout(timeout);
  }
}
