import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { TextDecoder } from "node:util";
import type {
  AssetCategory,
  AssetPreviewKind,
  AssetRecord,
  AssetView,
} from "$lib/types";
import { generateAutoMetadata } from "$lib/server/ai";

const dataRoot = path.join(process.cwd(), "data");
const uploadsDir = path.join(dataRoot, "uploads");
const metadataPath = path.join(dataRoot, "assets.json");

const modelExtensions = new Set([
  ".glb",
  ".gltf",
  ".obj",
  ".fbx",
  ".stl",
  ".blend",
]);
const textureExtensions = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".bmp",
  ".tga",
  ".ktx2",
]);
const audioExtensions = new Set([
  ".mp3",
  ".wav",
  ".ogg",
  ".flac",
  ".m4a",
  ".aac",
]);
const shaderExtensions = new Set([
  ".glsl",
  ".vert",
  ".frag",
  ".wgsl",
  ".hlsl",
  ".shader",
]);
const scriptExtensions = new Set([
  ".js",
  ".ts",
  ".py",
  ".lua",
  ".json",
  ".cs",
  ".cpp",
  ".h",
]);
const textDecoder = new TextDecoder();

const DEFAULT_LICENSE = "Unknown";

export class DuplicateAssetError extends Error {
  existingAsset: AssetRecord;

  constructor(existingAsset: AssetRecord) {
    super("Duplicate asset detected.");
    this.name = "DuplicateAssetError";
    this.existingAsset = existingAsset;
  }
}

function computeAssetHash(bytes: Uint8Array | Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function ensureAssetHashes(
  records: AssetRecord[],
): Promise<{ records: AssetRecord[]; updated: boolean }> {
  let updated = false;

  const withHashes = await Promise.all(
    records.map(async (record) => {
      if (typeof record.hash === "string" && record.hash.trim()) {
        return { ...record, hash: record.hash.trim() };
      }

      try {
        const fileBytes = await readFile(
          path.join(uploadsDir, record.storedName),
        );
        updated = true;
        return {
          ...record,
          hash: computeAssetHash(fileBytes),
        };
      } catch {
        return record;
      }
    }),
  );

  return { records: withHashes, updated };
}

async function ensureStorage(): Promise<void> {
  await mkdir(uploadsDir, { recursive: true });
  try {
    await readFile(metadataPath, "utf8");
  } catch {
    await writeFile(metadataPath, "[]", "utf8");
  }
}

function getCategory(fileName: string, mimeType: string): AssetCategory {
  const ext = path.extname(fileName).toLowerCase();
  if (mimeType.startsWith("audio/") || audioExtensions.has(ext)) return "audio";
  if (mimeType.startsWith("image/") || textureExtensions.has(ext))
    return "texture";
  if (modelExtensions.has(ext)) return "model";
  if (shaderExtensions.has(ext)) return "shader";
  if (scriptExtensions.has(ext) || mimeType.startsWith("text/"))
    return "script";
  return "other";
}

function getPreviewKind(
  category: AssetCategory,
  fileName: string,
  mimeType: string,
): AssetPreviewKind {
  if (category === "audio") return "audio";
  if (category === "texture") return "image";
  if (category === "shader" || category === "script") return "text";

  if (category === "model") {
    const ext = path.extname(fileName).toLowerCase();
    if ([".glb", ".gltf", ".obj", ".stl", ".fbx"].includes(ext)) {
      return "model";
    }
    if (mimeType === "model/gltf-binary" || mimeType === "model/gltf+json") {
      return "model";
    }
  }

  return "none";
}

function getAudioAttachmentFormat(
  fileName: string,
  mimeType: string,
): "mp3" | "wav" | undefined {
  const ext = path.extname(fileName).toLowerCase();
  if (
    mimeType === "audio/wav" ||
    mimeType === "audio/x-wav" ||
    ext === ".wav"
  ) {
    return "wav";
  }
  if (mimeType === "audio/mpeg" || ext === ".mp3") {
    return "mp3";
  }
  return undefined;
}

export async function readAssets(): Promise<AssetRecord[]> {
  await ensureStorage();
  const raw = await readFile(metadataPath, "utf8");
  const parsed = JSON.parse(raw) as AssetRecord[];
  const normalized = parsed.map((record) => ({
    ...record,
    hash:
      typeof record.hash === "string" && record.hash.trim()
        ? record.hash.trim()
        : undefined,
    description:
      typeof record.description === "string" ? record.description.trim() : "",
    sourceUrl: typeof record.sourceUrl === "string" ? record.sourceUrl : "",
    licenses: (() => {
      const normalizedLicenses = Array.isArray(record.licenses)
        ? record.licenses
            .filter((value): value is string => typeof value === "string")
            .map((license) => license.trim())
            .filter(Boolean)
        : [];

      return normalizedLicenses.length > 0
        ? normalizedLicenses
        : [DEFAULT_LICENSE];
    })(),
    // Legacy records created before this field existed are treated as already edited.
    metadataEdited: record.metadataEdited ?? true,
    previewKind: getPreviewKind(
      record.category,
      record.originalName,
      record.mimeType,
    ),
  }));
  return normalized.sort((a, b) => b.uploadDate.localeCompare(a.uploadDate));
}

async function writeAssets(records: AssetRecord[]): Promise<void> {
  await writeFile(metadataPath, JSON.stringify(records, null, 2), "utf8");
}

export function toAssetView(record: AssetRecord): AssetView {
  return {
    ...record,
    fileUrl: `/api/assets/${record.id}/file`,
    downloadUrl: `/api/assets/${record.id}/download`,
    textPreviewUrl: `/api/assets/${record.id}/text`,
  };
}

export async function saveAsset(params: {
  title: string;
  description?: string;
  tags: string[];
  licenses?: string[];
  sourceUrl?: string;
  fileName: string;
  mimeType: string;
  size: number;
  bytes: Uint8Array;
}): Promise<AssetRecord> {
  await ensureStorage();
  const records = await readAssets();
  const incomingHash = computeAssetHash(params.bytes);
  const { records: recordsWithHashes, updated } =
    await ensureAssetHashes(records);
  if (updated) {
    await writeAssets(recordsWithHashes);
  }

  const duplicate = recordsWithHashes.find(
    (record) => record.hash === incomingHash,
  );
  if (duplicate) {
    throw new DuplicateAssetError(duplicate);
  }

  const id = randomUUID();
  const ext = path.extname(params.fileName);
  const storedName = `${id}${ext}`;
  const category = getCategory(params.fileName, params.mimeType);
  const previewKind = getPreviewKind(
    category,
    params.fileName,
    params.mimeType,
  );

  // Attempt to read image dimensions for textures/images
  let width: number | undefined;
  let height: number | undefined;
  if (previewKind === "image") {
    try {
      const { default: sizeOf } = await import("image-size");
      const dims = sizeOf(Buffer.from(params.bytes));
      if (
        dims &&
        typeof dims.width === "number" &&
        typeof dims.height === "number"
      ) {
        width = dims.width;
        height = dims.height;
      }
    } catch (err) {
      // Non-fatal: if image-size isn't available or fails, continue without dims
      // eslint-disable-next-line no-console
      console.warn("Could not determine image dimensions:", err);
    }
  }

  const textSnippet =
    previewKind === "text"
      ? textDecoder.decode(params.bytes.slice(0, 4_000))
      : undefined;

  const autoMetadata = await generateAutoMetadata({
    title: params.title,
    originalName: params.fileName,
    category,
    mimeType: params.mimeType || "application/octet-stream",
    existingTags: params.tags,
    existingDescription: params.description ?? "",
    textSnippet,
    imageFile:
      category === "texture"
        ? {
            mimeType: params.mimeType || "application/octet-stream",
            bytes: params.bytes,
          }
        : undefined,
    audioFile:
      category === "audio"
        ? (() => {
            const format = getAudioAttachmentFormat(
              params.fileName,
              params.mimeType || "application/octet-stream",
            );
            if (!format) return undefined;
            return {
              format,
              bytes: params.bytes,
            };
          })()
        : undefined,
  });

  await writeFile(path.join(uploadsDir, storedName), params.bytes);

  const record: AssetRecord = {
    id,
    title: params.title,
    description: autoMetadata.description,
    tags: autoMetadata.tags,
    licenses: (() => {
      const normalizedLicenses = (params.licenses ?? [])
        .map((license) => license.trim())
        .filter(Boolean);
      return normalizedLicenses.length > 0
        ? normalizedLicenses
        : [DEFAULT_LICENSE];
    })(),
    sourceUrl: params.sourceUrl?.trim() ?? "",
    metadataEdited: false,
    uploadDate: new Date().toISOString(),
    originalName: params.fileName,
    storedName,
    hash: incomingHash,
    mimeType: params.mimeType || "application/octet-stream",
    size: params.size,
    category,
    previewKind,
    width,
    height,
  };

  recordsWithHashes.unshift(record);
  await writeAssets(recordsWithHashes);
  return record;
}

export async function getAssetById(
  id: string,
): Promise<AssetRecord | undefined> {
  const records = await readAssets();
  return records.find((record) => record.id === id);
}

export async function updateAssetMetadata(
  id: string,
  updates: {
    title: string;
    description: string;
    tags: string[];
    licenses: string[];
    sourceUrl: string;
  },
): Promise<AssetRecord | undefined> {
  const records = await readAssets();
  const index = records.findIndex((record) => record.id === id);
  if (index === -1) return undefined;

  const current = records[index];
  records[index] = {
    ...current,
    title: updates.title,
    description: updates.description,
    tags: updates.tags,
    licenses: updates.licenses,
    sourceUrl: updates.sourceUrl,
    metadataEdited: true,
  };

  await writeAssets(records);
  return records[index];
}

export async function replaceAssetFile(
  id: string,
  replacement: {
    fileName: string;
    mimeType: string;
    size: number;
    bytes: Uint8Array;
  },
): Promise<AssetRecord | undefined> {
  await ensureStorage();
  const records = await readAssets();
  const { records: recordsWithHashes, updated } =
    await ensureAssetHashes(records);
  const index = recordsWithHashes.findIndex((record) => record.id === id);
  if (index === -1) {
    if (updated) {
      await writeAssets(recordsWithHashes);
    }
    return undefined;
  }

  const incomingHash = computeAssetHash(replacement.bytes);
  const duplicate = recordsWithHashes.find(
    (record) => record.id !== id && record.hash === incomingHash,
  );
  if (duplicate) {
    throw new DuplicateAssetError(duplicate);
  }

  const current = recordsWithHashes[index];
  const ext = path.extname(replacement.fileName);
  const storedName = `${id}${ext}`;
  const category = getCategory(replacement.fileName, replacement.mimeType);
  const previewKind = getPreviewKind(
    category,
    replacement.fileName,
    replacement.mimeType,
  );

  let width: number | undefined;
  let height: number | undefined;
  if (previewKind === "image") {
    try {
      const { default: sizeOf } = await import("image-size");
      const dims = sizeOf(Buffer.from(replacement.bytes));
      if (
        dims &&
        typeof dims.width === "number" &&
        typeof dims.height === "number"
      ) {
        width = dims.width;
        height = dims.height;
      }
    } catch {
      // Ignore image dimension probe failures.
    }
  }

  await writeFile(path.join(uploadsDir, storedName), replacement.bytes);
  if (storedName !== current.storedName) {
    await rm(path.join(uploadsDir, current.storedName), { force: true });
  }

  recordsWithHashes[index] = {
    ...current,
    originalName: replacement.fileName,
    storedName,
    hash: incomingHash,
    mimeType: replacement.mimeType || "application/octet-stream",
    size: replacement.size,
    category,
    previewKind,
    width,
    height,
    uploadDate: new Date().toISOString(),
    // Replacement can invalidate descriptive metadata; flag for review.
    metadataEdited: false,
  };

  await writeAssets(recordsWithHashes);
  return recordsWithHashes[index];
}

export async function deleteAsset(id: string): Promise<boolean> {
  const records = await readAssets();
  const index = records.findIndex((record) => record.id === id);
  if (index === -1) return false;

  const [removed] = records.splice(index, 1);
  await writeAssets(records);
  await rm(path.join(uploadsDir, removed.storedName), { force: true });
  return true;
}

export function getStoredFilePath(storedName: string): string {
  return path.join(uploadsDir, storedName);
}
