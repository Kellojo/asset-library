import { readFile } from "node:fs/promises";
import { error, json, type RequestHandler } from "@sveltejs/kit";
import {
  DuplicateAssetError,
  getAssetById,
  getStoredFilePath,
  replaceAssetFile,
  toAssetView,
} from "$lib/server/assets";

const FILE_CACHE_CONTROL = "public, max-age=31536000, immutable";

function parseRangeHeader(
  rangeHeader: string,
  totalSize: number,
): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
  if (!match) return null;

  const startRaw = match[1];
  const endRaw = match[2];

  if (!startRaw && !endRaw) return null;

  if (!startRaw) {
    const tailLength = Number.parseInt(endRaw, 10);
    if (!Number.isFinite(tailLength) || tailLength <= 0) return null;
    const start = Math.max(0, totalSize - tailLength);
    return { start, end: totalSize - 1 };
  }

  const start = Number.parseInt(startRaw, 10);
  if (!Number.isFinite(start) || start < 0 || start >= totalSize) return null;

  const parsedEnd = endRaw ? Number.parseInt(endRaw, 10) : totalSize - 1;
  if (!Number.isFinite(parsedEnd)) return null;

  const end = Math.min(parsedEnd, totalSize - 1);
  if (end < start) return null;

  return { start, end };
}

async function resolveAssetOrThrow(id: string | undefined) {
  if (!id) {
    throw error(400, "Missing asset id");
  }

  const asset = await getAssetById(id);
  if (!asset) {
    throw error(404, "Asset not found");
  }

  return asset;
}

function buildCacheHeaders(
  asset: Awaited<ReturnType<typeof resolveAssetOrThrow>>,
) {
  return {
    "cache-control": FILE_CACHE_CONTROL,
    etag: `W/\"${asset.id}-${asset.size}\"`,
    "last-modified": new Date(asset.uploadDate).toUTCString(),
  };
}

export const GET: RequestHandler = async ({ params, request }) => {
  const asset = await resolveAssetOrThrow(params.id);

  let bytes: Buffer;
  try {
    bytes = await readFile(getStoredFilePath(asset.storedName));
  } catch {
    throw error(404, "Asset file missing on disk");
  }

  const totalSize = bytes.byteLength;
  const rangeHeader = request.headers.get("range");

  if (rangeHeader) {
    const range = parseRangeHeader(rangeHeader, totalSize);
    if (!range) {
      return new Response(null, {
        status: 416,
        headers: {
          "accept-ranges": "bytes",
          "content-range": `bytes */${totalSize}`,
          ...buildCacheHeaders(asset),
        },
      });
    }

    const chunk = bytes.subarray(range.start, range.end + 1);
    return new Response(new Uint8Array(chunk), {
      status: 206,
      headers: {
        "accept-ranges": "bytes",
        "content-type": asset.mimeType,
        "content-length": String(chunk.byteLength),
        "content-range": `bytes ${range.start}-${range.end}/${totalSize}`,
        ...buildCacheHeaders(asset),
      },
    });
  }

  return new Response(new Uint8Array(bytes), {
    headers: {
      "accept-ranges": "bytes",
      "content-type": asset.mimeType,
      "content-length": String(totalSize),
      "content-disposition": `inline; filename="${encodeURIComponent(asset.originalName)}"`,
      ...buildCacheHeaders(asset),
    },
  });
};

export const HEAD: RequestHandler = async ({ params }) => {
  const asset = await resolveAssetOrThrow(params.id);

  return new Response(null, {
    headers: {
      "accept-ranges": "bytes",
      "content-type": asset.mimeType,
      "content-length": String(asset.size),
      "content-disposition": `inline; filename="${encodeURIComponent(asset.originalName)}"`,
      ...buildCacheHeaders(asset),
    },
  });
};

export const PATCH: RequestHandler = async ({ params, request }) => {
  if (!params.id) {
    return json({ error: "Missing asset id." }, { status: 400 });
  }

  const form = await request.formData();
  const fileValue = form.get("file");
  if (!(fileValue instanceof File)) {
    return json({ error: "A replacement file is required." }, { status: 400 });
  }

  const arrayBuffer = await fileValue.arrayBuffer();

  try {
    const updated = await replaceAssetFile(params.id, {
      fileName: fileValue.name,
      mimeType: fileValue.type,
      size: fileValue.size,
      bytes: new Uint8Array(arrayBuffer),
    });

    if (!updated) {
      return json({ error: "Asset not found." }, { status: 404 });
    }

    return json({ asset: toAssetView(updated) });
  } catch (errorValue) {
    if (errorValue instanceof DuplicateAssetError) {
      return json(
        {
          error: `Replacement skipped. This file already exists as "${errorValue.existingAsset.title}".`,
          duplicate: true,
          asset: toAssetView(errorValue.existingAsset),
        },
        { status: 409 },
      );
    }

    return json({ error: "Failed to replace file." }, { status: 500 });
  }
};
