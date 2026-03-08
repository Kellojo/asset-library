export type AssetCategory =
  | "audio"
  | "texture"
  | "shader"
  | "script"
  | "model"
  | "other";
export type AssetPreviewKind = "audio" | "image" | "model" | "text" | "none";

export interface AssetRecord {
  id: string;
  title: string;
  description: string;
  tags: string[];
  licenses: string[];
  sourceUrl: string;
  metadataEdited: boolean;
  uploadDate: string;
  originalName: string;
  storedName: string;
  fileType: string;
  hash?: string;
  mimeType: string;
  size: number;
  category: AssetCategory;
  previewKind: AssetPreviewKind;
  width?: number;
  height?: number;
}

export interface AssetView extends AssetRecord {
  fileUrl: string;
  downloadUrl: string;
  textPreviewUrl: string;
}
