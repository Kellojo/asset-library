import { json, type RequestHandler } from "@sveltejs/kit";
import { getAiConfig, updateAiConfig, type AiConfig } from "$lib/server/ai";

export const GET: RequestHandler = async () => {
  const config = await getAiConfig();
  return json({ config });
};

export const PATCH: RequestHandler = async ({ request }) => {
  const body = (await request.json()) as Partial<AiConfig>;

  const next = await updateAiConfig({
    enabled: body.enabled,
    baseUrl: typeof body.baseUrl === "string" ? body.baseUrl : undefined,
    model: typeof body.model === "string" ? body.model : undefined,
    apiKey: typeof body.apiKey === "string" ? body.apiKey : undefined,
    timeoutMs: typeof body.timeoutMs === "number" ? body.timeoutMs : undefined,
    temperature:
      typeof body.temperature === "number" ? body.temperature : undefined,
    disableThinking:
      typeof body.disableThinking === "boolean"
        ? body.disableThinking
        : undefined,
    reasoningEffort:
      typeof body.reasoningEffort === "string"
        ? body.reasoningEffort
        : undefined,
    customInstruction:
      typeof body.customInstruction === "string"
        ? body.customInstruction
        : undefined,
  });

  return json({ config: next });
};
