import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { TextDecoder } from "node:util";
import type {
  AssetCategory,
  AssetPreviewKind,
  AssetRecord,
  AssetView,
} from "$lib/types";
import { generateAutoTags } from "$lib/server/lmstudio";

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
const scriptExtensions = new Set([".js", ".ts", ".py", ".lua", ".json", ".cs"]);
const textDecoder = new TextDecoder();

const DEFAULT_LICENSE = "Unknown";

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

export async function readAssets(): Promise<AssetRecord[]> {
  await ensureStorage();
  const raw = await readFile(metadataPath, "utf8");
  const parsed = JSON.parse(raw) as AssetRecord[];
  const normalized = parsed.map((record) => ({
    ...record,
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
  const id = randomUUID();
  const ext = path.extname(params.fileName);
  const storedName = `${id}${ext}`;
  const category = getCategory(params.fileName, params.mimeType);
  const previewKind = getPreviewKind(
    category,
    params.fileName,
    params.mimeType,
  );

  const textSnippet =
    previewKind === "text"
      ? textDecoder.decode(params.bytes.slice(0, 4_000))
      : undefined;

  const autoTags = await generateAutoTags({
    title: params.title,
    originalName: params.fileName,
    category,
    mimeType: params.mimeType || "application/octet-stream",
    existingTags: params.tags,
    textSnippet,
  });

  await writeFile(path.join(uploadsDir, storedName), params.bytes);

  const record: AssetRecord = {
    id,
    title: params.title,
    tags: autoTags,
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
    mimeType: params.mimeType || "application/octet-stream",
    size: params.size,
    category,
    previewKind,
  };

  records.unshift(record);
  await writeAssets(records);
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
    tags: updates.tags,
    licenses: updates.licenses,
    sourceUrl: updates.sourceUrl,
    metadataEdited: true,
  };

  await writeAssets(records);
  return records[index];
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
