import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
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
const dbPath = path.join(dataRoot, "assets.db");
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

type AssetRow = {
  id: string;
  title: string;
  description: string;
  tags_json: string;
  licenses_json: string;
  source_url: string;
  metadata_edited: number;
  upload_date: string;
  original_name: string;
  stored_name: string;
  file_type: string;
  hash: string | null;
  mime_type: string;
  size: number;
  category: string;
  preview_kind: string;
  width: number | null;
  height: number | null;
};

let db: DatabaseSync | undefined;
let storageReady: Promise<void> | undefined;

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
): Promise<void> {
  const database = getDb();
  const rows = database
    .prepare(
      "SELECT id, stored_name FROM assets WHERE hash IS NULL OR TRIM(hash) = ''",
    )
    .all() as Array<{ id: string; stored_name: string }>;

  if (rows.length === 0) {
    return;
  }

  const updateHash = database.prepare("UPDATE assets SET hash = ? WHERE id = ?");
  for (const row of rows) {
    try {
      const fileBytes = await readFile(path.join(uploadsDir, row.stored_name));
      updateHash.run(computeAssetHash(fileBytes), row.id);
    } catch {
      // Ignore missing files and keep legacy records untouched.
    }
  }
}

function getDb(): DatabaseSync {
  if (db) {
    return db;
  }

  db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA synchronous = NORMAL");
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec(`
    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      tags_json TEXT NOT NULL,
      licenses_json TEXT NOT NULL,
      source_url TEXT NOT NULL,
      metadata_edited INTEGER NOT NULL,
      upload_date TEXT NOT NULL,
      original_name TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      file_type TEXT NOT NULL,
      hash TEXT,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      category TEXT NOT NULL,
      preview_kind TEXT NOT NULL,
      width INTEGER,
      height INTEGER
    );
  `);
  db.exec(
    "CREATE INDEX IF NOT EXISTS idx_assets_upload_date ON assets(upload_date DESC)",
  );
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_assets_hash ON assets(hash)");

  return db;
}

function parseStringArray(value: string, fallback: string[] = []): string[] {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return fallback;
    }
    return parsed
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  } catch {
    return fallback;
  }
}

function normalizeImportedRecord(record: AssetRecord): AssetRecord {
  const normalizedLicenses = Array.isArray(record.licenses)
    ? record.licenses.map((license) => license.trim()).filter(Boolean)
    : [];

  return {
    ...record,
    fileType:
      typeof record.fileType === "string" && record.fileType.trim()
        ? record.fileType.trim().toLowerCase()
        : getFileType(record.originalName, record.mimeType),
    hash:
      typeof record.hash === "string" && record.hash.trim()
        ? record.hash.trim()
        : undefined,
    description:
      typeof record.description === "string" ? record.description.trim() : "",
    sourceUrl: typeof record.sourceUrl === "string" ? record.sourceUrl : "",
    licenses:
      normalizedLicenses.length > 0
        ? normalizedLicenses
        : [DEFAULT_LICENSE],
    metadataEdited: record.metadataEdited ?? true,
    previewKind: getPreviewKind(
      record.category,
      record.originalName,
      record.mimeType,
    ),
  };
}

function rowToAssetRecord(row: AssetRow): AssetRecord {
  const category = (row.category || "other") as AssetCategory;
  const fallbackPreviewKind = getPreviewKind(
    category,
    row.original_name,
    row.mime_type,
  );

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    tags: parseStringArray(row.tags_json),
    licenses: (() => {
      const parsed = parseStringArray(row.licenses_json);
      return parsed.length > 0 ? parsed : [DEFAULT_LICENSE];
    })(),
    sourceUrl: row.source_url,
    metadataEdited: Boolean(row.metadata_edited),
    uploadDate: row.upload_date,
    originalName: row.original_name,
    storedName: row.stored_name,
    fileType:
      typeof row.file_type === "string" && row.file_type.trim()
        ? row.file_type.trim().toLowerCase()
        : getFileType(row.original_name, row.mime_type),
    hash: row.hash?.trim() || undefined,
    mimeType: row.mime_type,
    size: Number(row.size),
    category,
    previewKind:
      row.preview_kind === "audio" ||
      row.preview_kind === "image" ||
      row.preview_kind === "model" ||
      row.preview_kind === "text" ||
      row.preview_kind === "none"
        ? row.preview_kind
        : fallbackPreviewKind,
    width: typeof row.width === "number" ? row.width : undefined,
    height: typeof row.height === "number" ? row.height : undefined,
  };
}

function insertRecord(database: DatabaseSync, record: AssetRecord): void {
  database
    .prepare(
      `
        INSERT INTO assets (
          id,
          title,
          description,
          tags_json,
          licenses_json,
          source_url,
          metadata_edited,
          upload_date,
          original_name,
          stored_name,
          file_type,
          hash,
          mime_type,
          size,
          category,
          preview_kind,
          width,
          height
        ) VALUES (
          @id,
          @title,
          @description,
          @tags_json,
          @licenses_json,
          @source_url,
          @metadata_edited,
          @upload_date,
          @original_name,
          @stored_name,
          @file_type,
          @hash,
          @mime_type,
          @size,
          @category,
          @preview_kind,
          @width,
          @height
        )
      `,
    )
    .run({
      id: record.id,
      title: record.title,
      description: record.description,
      tags_json: JSON.stringify(record.tags),
      licenses_json: JSON.stringify(record.licenses),
      source_url: record.sourceUrl,
      metadata_edited: record.metadataEdited ? 1 : 0,
      upload_date: record.uploadDate,
      original_name: record.originalName,
      stored_name: record.storedName,
      file_type: record.fileType,
      hash: record.hash ?? null,
      mime_type: record.mimeType,
      size: record.size,
      category: record.category,
      preview_kind: record.previewKind,
      width: record.width ?? null,
      height: record.height ?? null,
    });
}

async function migrateLegacyJsonIfNeeded(database: DatabaseSync): Promise<void> {
  const countResult = database
    .prepare("SELECT COUNT(*) AS count FROM assets")
    .get() as { count: number };
  if (Number(countResult.count) > 0) {
    return;
  }

  let raw: string;
  try {
    raw = await readFile(metadataPath, "utf8");
  } catch {
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return;
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    return;
  }

  const records = parsed
    .filter((entry): entry is AssetRecord => {
      return (
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as AssetRecord).id === "string" &&
        typeof (entry as AssetRecord).storedName === "string"
      );
    })
    .map((entry) => normalizeImportedRecord(entry));

  database.exec("BEGIN IMMEDIATE");
  try {
    for (const record of records) {
      try {
        insertRecord(database, record);
      } catch {
        // Skip malformed or duplicate legacy entries during migration.
      }
    }
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

async function ensureStorage(): Promise<void> {
  if (!storageReady) {
    storageReady = (async () => {
      await mkdir(dataRoot, { recursive: true });
      await mkdir(uploadsDir, { recursive: true });
      const database = getDb();
      await migrateLegacyJsonIfNeeded(database);
    })();
  }

  try {
    await storageReady;
  } catch (error) {
    storageReady = undefined;
    throw error;
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

function getFileType(fileName: string, mimeType: string): string {
  const ext = path.extname(fileName).toLowerCase();
  if (ext.startsWith(".") && ext.length > 1) {
    return ext.slice(1);
  }

  const subtype = mimeType.split("/")[1]?.split(";")[0]?.trim().toLowerCase();
  if (!subtype) return "unknown";

  return subtype
    .replace("x-", "")
    .replace("svg+xml", "svg")
    .replace("jpeg", "jpg")
    .replace("mpeg", "mp3")
    .replace(/\+xml$/i, "");
}

export async function readAssets(): Promise<AssetRecord[]> {
  await ensureStorage();
  const database = getDb();
  const rows = database
    .prepare(
      `
        SELECT
          id,
          title,
          description,
          tags_json,
          licenses_json,
          source_url,
          metadata_edited,
          upload_date,
          original_name,
          stored_name,
          file_type,
          hash,
          mime_type,
          size,
          category,
          preview_kind,
          width,
          height
        FROM assets
        ORDER BY upload_date DESC
      `,
    )
    .all() as AssetRow[];

  return rows.map(rowToAssetRecord);
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
  const database = getDb();
  const incomingHash = computeAssetHash(params.bytes);
  await ensureAssetHashes();
  const duplicateRow = database
    .prepare(
      `
        SELECT
          id,
          title,
          description,
          tags_json,
          licenses_json,
          source_url,
          metadata_edited,
          upload_date,
          original_name,
          stored_name,
          file_type,
          hash,
          mime_type,
          size,
          category,
          preview_kind,
          width,
          height
        FROM assets
        WHERE hash = ?
        LIMIT 1
      `,
    )
    .get(incomingHash) as AssetRow | undefined;
  const duplicate = duplicateRow ? rowToAssetRecord(duplicateRow) : undefined;
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

  const normalizedLicenses = (params.licenses ?? [])
    .map((license) => license.trim())
    .filter(Boolean);
  const normalizedSourceUrl = params.sourceUrl?.trim() ?? "";
  const hasInitialMetadata =
    normalizedSourceUrl.length > 0 || normalizedLicenses.length > 0;

  const record: AssetRecord = {
    id,
    title: params.title,
    description: autoMetadata.description,
    tags: autoMetadata.tags,
    licenses:
      normalizedLicenses.length > 0 ? normalizedLicenses : [DEFAULT_LICENSE],
    sourceUrl: normalizedSourceUrl,
    metadataEdited: hasInitialMetadata,
    uploadDate: new Date().toISOString(),
    originalName: params.fileName,
    storedName,
    fileType: getFileType(
      params.fileName,
      params.mimeType || "application/octet-stream",
    ),
    hash: incomingHash,
    mimeType: params.mimeType || "application/octet-stream",
    size: params.size,
    category,
    previewKind,
    width,
    height,
  };

  await writeFile(path.join(uploadsDir, storedName), params.bytes);

  try {
    insertRecord(database, record);
  } catch (errorValue) {
    await rm(path.join(uploadsDir, storedName), { force: true });

    const message =
      errorValue instanceof Error ? errorValue.message : String(errorValue);
    if (message.includes("UNIQUE constraint failed: assets.hash")) {
      const existing = database
        .prepare(
          `
            SELECT
              id,
              title,
              description,
              tags_json,
              licenses_json,
              source_url,
              metadata_edited,
              upload_date,
              original_name,
              stored_name,
              file_type,
              hash,
              mime_type,
              size,
              category,
              preview_kind,
              width,
              height
            FROM assets
            WHERE hash = ?
            LIMIT 1
          `,
        )
        .get(incomingHash) as AssetRow | undefined;
      if (existing) {
        throw new DuplicateAssetError(rowToAssetRecord(existing));
      }
    }
    throw errorValue;
  }

  return record;
}

export async function getAssetById(
  id: string,
): Promise<AssetRecord | undefined> {
  await ensureStorage();
  const database = getDb();
  const row = database
    .prepare(
      `
        SELECT
          id,
          title,
          description,
          tags_json,
          licenses_json,
          source_url,
          metadata_edited,
          upload_date,
          original_name,
          stored_name,
          file_type,
          hash,
          mime_type,
          size,
          category,
          preview_kind,
          width,
          height
        FROM assets
        WHERE id = ?
        LIMIT 1
      `,
    )
    .get(id) as AssetRow | undefined;

  return row ? rowToAssetRecord(row) : undefined;
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
  await ensureStorage();
  const database = getDb();
  const result = database
    .prepare(
      `
        UPDATE assets
        SET
          title = @title,
          description = @description,
          tags_json = @tags_json,
          licenses_json = @licenses_json,
          source_url = @source_url,
          metadata_edited = 1
        WHERE id = @id
      `,
    )
    .run({
      id,
      title: updates.title,
      description: updates.description,
      tags_json: JSON.stringify(updates.tags),
      licenses_json: JSON.stringify(updates.licenses),
      source_url: updates.sourceUrl,
    });

  if (result.changes === 0) {
    return undefined;
  }

  return getAssetById(id);
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
  const database = getDb();
  await ensureAssetHashes();

  const currentRow = database
    .prepare(
      `
        SELECT
          id,
          title,
          description,
          tags_json,
          licenses_json,
          source_url,
          metadata_edited,
          upload_date,
          original_name,
          stored_name,
          file_type,
          hash,
          mime_type,
          size,
          category,
          preview_kind,
          width,
          height
        FROM assets
        WHERE id = ?
        LIMIT 1
      `,
    )
    .get(id) as AssetRow | undefined;
  if (!currentRow) {
    return undefined;
  }

  const incomingHash = computeAssetHash(replacement.bytes);
  const duplicateRow = database
    .prepare(
      `
        SELECT
          id,
          title,
          description,
          tags_json,
          licenses_json,
          source_url,
          metadata_edited,
          upload_date,
          original_name,
          stored_name,
          file_type,
          hash,
          mime_type,
          size,
          category,
          preview_kind,
          width,
          height
        FROM assets
        WHERE hash = ? AND id != ?
        LIMIT 1
      `,
    )
    .get(incomingHash, id) as AssetRow | undefined;
  const duplicate = duplicateRow ? rowToAssetRecord(duplicateRow) : undefined;
  if (duplicate) {
    throw new DuplicateAssetError(duplicate);
  }

  const current = rowToAssetRecord(currentRow);
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

  const uploadDate = new Date().toISOString();
  try {
    database
      .prepare(
        `
          UPDATE assets
          SET
            original_name = @original_name,
            stored_name = @stored_name,
            file_type = @file_type,
            hash = @hash,
            mime_type = @mime_type,
            size = @size,
            category = @category,
            preview_kind = @preview_kind,
            width = @width,
            height = @height,
            upload_date = @upload_date,
            metadata_edited = 0
          WHERE id = @id
        `,
      )
      .run({
        id,
        original_name: replacement.fileName,
        stored_name: storedName,
        file_type: getFileType(
          replacement.fileName,
          replacement.mimeType || "application/octet-stream",
        ),
        hash: incomingHash,
        mime_type: replacement.mimeType || "application/octet-stream",
        size: replacement.size,
        category,
        preview_kind: previewKind,
        width: width ?? null,
        height: height ?? null,
        upload_date: uploadDate,
      });
  } catch (errorValue) {
    const message =
      errorValue instanceof Error ? errorValue.message : String(errorValue);
    if (message.includes("UNIQUE constraint failed: assets.hash")) {
      const existing = database
        .prepare(
          `
            SELECT
              id,
              title,
              description,
              tags_json,
              licenses_json,
              source_url,
              metadata_edited,
              upload_date,
              original_name,
              stored_name,
              file_type,
              hash,
              mime_type,
              size,
              category,
              preview_kind,
              width,
              height
            FROM assets
            WHERE hash = ? AND id != ?
            LIMIT 1
          `,
        )
        .get(incomingHash, id) as AssetRow | undefined;
      if (existing) {
        throw new DuplicateAssetError(rowToAssetRecord(existing));
      }
    }
    throw errorValue;
  }

  return getAssetById(id);
}

export async function deleteAsset(id: string): Promise<boolean> {
  await ensureStorage();
  const database = getDb();
  const row = database
    .prepare("SELECT stored_name FROM assets WHERE id = ? LIMIT 1")
    .get(id) as { stored_name: string } | undefined;

  if (!row) {
    return false;
  }

  database.prepare("DELETE FROM assets WHERE id = ?").run(id);
  await rm(path.join(uploadsDir, row.stored_name), { force: true });
  return true;
}

export function getStoredFilePath(storedName: string): string {
  return path.join(uploadsDir, storedName);
}
