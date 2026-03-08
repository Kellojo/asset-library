import { json, type RequestHandler } from "@sveltejs/kit";
import {
  deleteAsset,
  toAssetView,
  updateAssetMetadata,
} from "$lib/server/assets";

function parseTags(input: string): string[] {
  return input
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export const PATCH: RequestHandler = async ({ params, request }) => {
  if (!params.id) {
    return json({ error: "Missing asset id." }, { status: 400 });
  }

  const body = (await request.json()) as {
    title?: unknown;
    description?: unknown;
    tags?: unknown;
    licenses?: unknown;
    sourceUrl?: unknown;
  };

  if (typeof body.title !== "string" || !body.title.trim()) {
    return json({ error: "A title is required." }, { status: 400 });
  }

  let tags: string[] = [];
  if (Array.isArray(body.tags)) {
    tags = body.tags
      .filter((value): value is string => typeof value === "string")
      .map((tag) => tag.trim())
      .filter(Boolean);
  } else if (typeof body.tags === "string") {
    tags = parseTags(body.tags);
  }

  let licenses: string[] = [];
  if (Array.isArray(body.licenses)) {
    licenses = body.licenses
      .filter((value): value is string => typeof value === "string")
      .map((license) => license.trim())
      .filter(Boolean);
  } else if (typeof body.licenses === "string") {
    licenses = parseTags(body.licenses);
  }

  if (licenses.length === 0) {
    return json(
      { error: "At least one license is required." },
      { status: 400 },
    );
  }

  const sourceUrl =
    typeof body.sourceUrl === "string" ? body.sourceUrl.trim() : "";
  const description =
    typeof body.description === "string" ? body.description.trim() : "";

  const record = await updateAssetMetadata(params.id, {
    title: body.title.trim(),
    description,
    tags,
    licenses,
    sourceUrl,
  });

  if (!record) {
    return json({ error: "Asset not found." }, { status: 404 });
  }

  return json({ asset: toAssetView(record) });
};

export const DELETE: RequestHandler = async ({ params }) => {
  if (!params.id) {
    return json({ error: "Missing asset id." }, { status: 400 });
  }

  const deleted = await deleteAsset(params.id);
  if (!deleted) {
    return json({ error: "Asset not found." }, { status: 404 });
  }

  return json({ ok: true });
};
