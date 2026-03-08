import { json, type RequestHandler } from "@sveltejs/kit";
import {
  getLmStudioConfig,
  updateLmStudioConfig,
  type LmStudioConfig,
} from "$lib/server/lmstudio";

export const GET: RequestHandler = async () => {
  const config = await getLmStudioConfig();
  return json({ config });
};

export const PATCH: RequestHandler = async ({ request }) => {
  const body = (await request.json()) as Partial<LmStudioConfig>;

  const next = await updateLmStudioConfig({
    enabled: body.enabled,
    baseUrl: typeof body.baseUrl === "string" ? body.baseUrl : undefined,
    model: typeof body.model === "string" ? body.model : undefined,
    apiKey: typeof body.apiKey === "string" ? body.apiKey : undefined,
    timeoutMs: typeof body.timeoutMs === "number" ? body.timeoutMs : undefined,
  });

  return json({ config: next });
};
