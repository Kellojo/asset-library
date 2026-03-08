import { readFile } from "node:fs/promises";
import { error, type RequestHandler } from "@sveltejs/kit";
import { getAssetById, getStoredFilePath } from "$lib/server/assets";

export const GET: RequestHandler = async ({ params }) => {
  if (!params.id) {
    throw error(400, "Missing asset id");
  }

  const asset = await getAssetById(params.id);
  if (!asset) {
    throw error(404, "Asset not found");
  }

  try {
    const bytes = await readFile(getStoredFilePath(asset.storedName));
    return new Response(bytes, {
      headers: {
        "content-type": asset.mimeType,
        "content-length": String(asset.size),
        "content-disposition": `attachment; filename="${encodeURIComponent(asset.originalName)}"`,
      },
    });
  } catch {
    throw error(404, "Asset file missing on disk");
  }
};
