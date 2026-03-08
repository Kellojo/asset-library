import { readFile } from "node:fs/promises";
import { error, json, type RequestHandler } from "@sveltejs/kit";
import { getAssetById, getStoredFilePath } from "$lib/server/assets";

const decoder = new TextDecoder();

export const GET: RequestHandler = async ({ params }) => {
  if (!params.id) {
    throw error(400, "Missing asset id");
  }

  const asset = await getAssetById(params.id);
  if (!asset) {
    throw error(404, "Asset not found");
  }

  if (asset.previewKind !== "text") {
    return json({ text: "" });
  }

  try {
    const bytes = await readFile(getStoredFilePath(asset.storedName));
    const clipped = bytes.subarray(0, 32_000);
    return json({ text: decoder.decode(clipped) });
  } catch {
    throw error(404, "Asset file missing on disk");
  }
};
