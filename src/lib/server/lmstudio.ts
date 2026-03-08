import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "$env/dynamic/private";

export interface LmStudioConfig {
  enabled: boolean;
  baseUrl: string;
  model: string;
  apiKey: string;
  timeoutMs: number;
}

const dataRoot = path.join(process.cwd(), "data");
const configPath = path.join(dataRoot, "lmstudio.json");

const defaultConfig: LmStudioConfig = {
  enabled: false,
  baseUrl: "http://127.0.0.1:1234",
  model: "",
  apiKey: "",
  timeoutMs: 12_000,
};

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

function applyEnvOverrides(config: LmStudioConfig): LmStudioConfig {
  return {
    enabled: parseEnvBoolean(env.LMSTUDIO_ENABLED) ?? config.enabled,
    baseUrl: env.LMSTUDIO_BASE_URL?.trim() || config.baseUrl,
    model: env.LMSTUDIO_MODEL?.trim() || config.model,
    apiKey: env.LMSTUDIO_API_KEY ?? config.apiKey,
    timeoutMs: parseEnvNumber(env.LMSTUDIO_TIMEOUT_MS) ?? config.timeoutMs,
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

export async function getLmStudioConfig(): Promise<LmStudioConfig> {
  await ensureConfigFile();
  const raw = await readFile(configPath, "utf8");
  const parsed = JSON.parse(raw) as Partial<LmStudioConfig>;

  const fileConfig: LmStudioConfig = {
    enabled: parsed.enabled ?? defaultConfig.enabled,
    baseUrl: (parsed.baseUrl ?? defaultConfig.baseUrl).trim(),
    model: (parsed.model ?? defaultConfig.model).trim(),
    apiKey: parsed.apiKey ?? defaultConfig.apiKey,
    timeoutMs: parsed.timeoutMs ?? defaultConfig.timeoutMs,
  };

  return applyEnvOverrides(fileConfig);
}

export async function updateLmStudioConfig(
  updates: Partial<LmStudioConfig>,
): Promise<LmStudioConfig> {
  const current = await getLmStudioConfig();
  const merged: LmStudioConfig = {
    ...current,
    ...updates,
    baseUrl: (updates.baseUrl ?? current.baseUrl).trim(),
    model: (updates.model ?? current.model).trim(),
    timeoutMs: Math.max(1_000, updates.timeoutMs ?? current.timeoutMs),
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

export async function generateAutoTags(params: {
  title: string;
  originalName: string;
  category: string;
  mimeType: string;
  existingTags: string[];
  textSnippet?: string;
}): Promise<string[]> {
  const config = await getLmStudioConfig();
  if (!config.enabled || !config.baseUrl || !config.model) {
    return params.existingTags;
  }

  const prompt = [
    "Generate concise asset tags.",
    "Return ONLY a comma-separated list with up to 6 tags.",
    "Use lowercase, no punctuation besides hyphen.",
    `title: ${params.title}`,
    `file_name: ${params.originalName}`,
    `category: ${params.category}`,
    `mime_type: ${params.mimeType}`,
    params.textSnippet
      ? `text_sample: ${params.textSnippet.slice(0, 500)}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

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
                "You create short tagging vocabularies for digital assets. Output comma-separated tags only.",
            },
            { role: "user", content: prompt },
          ],
        }),
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      return params.existingTags;
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = payload.choices?.[0]?.message?.content ?? "";
    const aiTags = parseTagsFromText(text);
    return mergeUniqueTags([...params.existingTags, ...aiTags]);
  } catch {
    return params.existingTags;
  } finally {
    clearTimeout(timeout);
  }
}
