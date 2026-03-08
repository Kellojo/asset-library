import { json, type RequestHandler } from "@sveltejs/kit";
import {
  DuplicateAssetError,
  readAssets,
  saveAsset,
  toAssetView,
} from "$lib/server/assets";

function parseTags(input: string): string[] {
  return input
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export const GET: RequestHandler = async () => {
  const assets = await readAssets();
  return json({ assets: assets.map(toAssetView) });
};

export const POST: RequestHandler = async ({ request }) => {
  const form = await request.formData();
  const titleValue = form.get("title");
  const tagsValue = form.get("tags");
  const descriptionValue = form.get("description");
  const licensesValue = form.get("licenses");
  const sourceUrlValue = form.get("sourceUrl");
  const fileValue = form.get("file");

  if (typeof titleValue !== "string" || !titleValue.trim()) {
    return json({ error: "A title is required." }, { status: 400 });
  }

  if (!(fileValue instanceof File)) {
    return json({ error: "A file is required." }, { status: 400 });
  }

  const arrayBuffer = await fileValue.arrayBuffer();
  const tags = typeof tagsValue === "string" ? parseTags(tagsValue) : [];
  const description =
    typeof descriptionValue === "string" ? descriptionValue.trim() : "";
  const licenses =
    typeof licensesValue === "string" ? parseTags(licensesValue) : [];
  const sourceUrl =
    typeof sourceUrlValue === "string" ? sourceUrlValue.trim() : "";

  let record;
  try {
    record = await saveAsset({
      title: titleValue.trim(),
      description,
      tags,
      licenses,
      sourceUrl,
      fileName: fileValue.name,
      mimeType: fileValue.type,
      size: fileValue.size,
      bytes: new Uint8Array(arrayBuffer),
    });
  } catch (error) {
    if (error instanceof DuplicateAssetError) {
      return json(
        {
          error: `Duplicate upload skipped. Matching asset already exists: "${error.existingAsset.title}".`,
          duplicate: true,
          asset: toAssetView(error.existingAsset),
        },
        { status: 409 },
      );
    }

    console.error("Error saving asset:", error);
    return json({ error: "Failed to save asset." }, { status: 500 });
  }

  return json({ asset: toAssetView(record) }, { status: 201 });
};
