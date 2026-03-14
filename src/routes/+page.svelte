<script lang="ts">
  import Icon from "@iconify/svelte";
  import Fuse from "fuse.js";
  import { toast } from "svelte-sonner";
  import { onMount } from "svelte";
  import { replaceState } from "$app/navigation";
  import { browser } from "$app/environment";
  import { env as publicEnv } from "$env/dynamic/public";
  import type { AssetCategory, AssetView } from "$lib/types";
  import AssetCard from "$lib/components/AssetCard.svelte";
  import Button from "$lib/components/Button.svelte";
  import Dialog from "$lib/components/Dialog.svelte";
  import FilterPane from "$lib/components/FilterPane.svelte";
  import Input from "$lib/components/Input.svelte";
  import SearchField from "$lib/components/SearchField.svelte";
  import SelectField from "$lib/components/SelectField.svelte";
  import TagPicker from "$lib/components/TagPicker.svelte";
  import TitleIconReel from "$lib/components/TitleIconReel.svelte";
  import {
    AssetLibraryApiService,
    type AiConfig,
  } from "$lib/services/asset-library-api";
  import {
    SourceLicensePrefillHelper,
    UNITY_ASSET_STORE_LICENSE,
  } from "$lib/services/source-license-prefill";

  const FILTER_QUERY_KEYS = {
    todo: "todo",
    categories: "categories",
    tags: "tags",
    licenses: "licenses",
    sort: "sort",
  } as const;
  const GITHUB_REPO_URL = "https://github.com/Kellojo/asset-library";
  const SORT_MODE_OPTIONS = [
    { value: "best-match", label: "Best Match" },
    { value: "newest", label: "Newest" },
    { value: "oldest", label: "Oldest" },
    { value: "title-asc", label: "Title A-Z" },
    { value: "size-desc", label: "Largest Size" },
    { value: "needs-metadata", label: "Needs Metadata First" },
  ] as const;
  const AI_REASONING_EFFORT_OPTIONS = [
    { value: "", label: "Auto (unset)" },
    { value: "none", label: "None" },
    { value: "minimal", label: "Minimal" },
    { value: "low", label: "Low" },
    { value: "medium", label: "Medium" },
    { value: "high", label: "High" },
    { value: "xhigh", label: "XHigh" },
  ] as const;
  type SortMode = (typeof SORT_MODE_OPTIONS)[number]["value"];
  const DEFAULT_SORT_MODE: SortMode = "best-match";
  const THEME_STORAGE_KEY = "asset-library-theme";
  const DEFAULT_UPLOAD_PARALLELISM = 4;
  const MAX_UPLOAD_PARALLELISM = 16;
  type ThemeMode = "light" | "dark";

  const categoryOrder: AssetCategory[] = [
    "model",
    "texture",
    "audio",
    "shader",
    "script",
    "other",
  ];
  const categoryIconByType: Record<AssetCategory, string> = {
    model: "mdi:cube-outline",
    texture: "mdi:image-outline",
    audio: "mdi:music-note-outline",
    shader: "mdi:shimmer",
    script: "mdi:code-tags",
    other: "mdi:file-outline",
  };
  const commonLicenseOptions = [
    "Unknown",
    "Self created",
    "CC0",
    "CC BY 4.0",
    "CC BY-SA 4.0",
    "Royalty Free",
    "Editorial Use Only",
    "All Rights Reserved",
    UNITY_ASSET_STORE_LICENSE,
  ];
  type QueuedUpload = {
    file: File;
    sourceUrl: string;
    licenses: string[];
  };

  let assets: AssetView[] = [];
  let loading = true;

  let isDragging = false;
  let pageDragDepth = 0;
  let editingAssetId: string | null = null;
  let deletingAssetId: string | null = null;
  let editTitle = "";
  let editTags: string[] = [];
  let editLicenses: string[] = [];
  let editSourceUrl = "";
  let editDescription = "";
  let saveInProgress = false;
  let replaceInProgress = false;

  let uploadQueue: QueuedUpload[] = [];
  let queueRunning = false;
  let uploadBatchTotal = 0;
  let uploadProcessedCount = 0;
  let importPrefillOpen = false;
  let importPrefillSourceUrl = "";
  let importPrefillLicenses: string[] = [];
  let pendingImportFiles: File[] = [];
  let importPrefillDialogRef: { requestClose: () => void } | null = null;

  let searchQuery = "";
  let showTodoOnly = false;
  let sortMode: SortMode = DEFAULT_SORT_MODE;
  let selectedCategories: AssetCategory[] = [];
  let selectedFilterTags: string[] = [];
  let selectedFilterLicenses: string[] = [];
  let filterTagQuery = "";
  let filterLicenseQuery = "";
  let didHydrateFiltersFromUrl = false;
  let aiSettingsOpen = false;
  let aiSaving = false;
  let themeMode: ThemeMode = "dark";
  let uploadInputEl: HTMLInputElement | null = null;
  let replaceInputEl: HTMLInputElement | null = null;
  let showBackToTop = false;
  let editDialogRef: { requestClose: () => void } | null = null;
  let aiDialogRef: { requestClose: () => void } | null = null;
  let aiConfig = {
    enabled: false,
    baseUrl: "http://127.0.0.1:1234",
    model: "",
    apiKey: "",
    timeoutMs: 120000,
    temperature: 0.2,
    reasoningEffort: "",
    customInstruction: "",
  };
  const api = new AssetLibraryApiService();
  const sourceLicensePrefillHelper = new SourceLicensePrefillHelper();
  const uploadParallelism = parseUploadParallelism(
    publicEnv.PUBLIC_UPLOAD_PARALLELISM,
  );
  const textPreviews: Record<string, string> = {};
  let fuzzyMatchedAssetIds: Set<string> | null = null;
  let fuzzyRankByAssetId: Map<string, number> | null = null;

  function parseUploadParallelism(rawValue: string | undefined): number {
    const parsed = Number.parseInt(rawValue ?? "", 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      return DEFAULT_UPLOAD_PARALLELISM;
    }
    return Math.min(parsed, MAX_UPLOAD_PARALLELISM);
  }

  $: normalizedSearchQuery = searchQuery.trim();
  $: {
    const q = normalizedSearchQuery;
    if (!q) {
      fuzzyMatchedAssetIds = null;
      fuzzyRankByAssetId = null;
    } else {
      const fuse = new Fuse(assets, {
        threshold: 0.35,
        ignoreLocation: true,
        minMatchCharLength: 2,
        keys: [
          { name: "title", weight: 0.35 },
          { name: "description", weight: 0.25 },
          { name: "tags", weight: 0.2 },
          { name: "fileType", weight: 0.15 },
          { name: "originalName", weight: 0.15 },
          { name: "category", weight: 0.05 },
        ],
      });

      const results = fuse.search(q);
      fuzzyMatchedAssetIds = new Set(results.map((result) => result.item.id));
      fuzzyRankByAssetId = new Map(
        results.map((result, index) => [result.item.id, index]),
      );
    }
  }

  $: visibleAssets = (() => {
    const filteredAssets = assets.filter((asset) => {
      const matchesQuery =
        !normalizedSearchQuery || !!fuzzyMatchedAssetIds?.has(asset.id);
      const matchesTodo = !showTodoOnly || !asset.metadataEdited;
      const matchesCategory =
        selectedCategories.length === 0 ||
        selectedCategories.includes(asset.category);
      const matchesTags = selectedFilterTags.every((selectedTag) =>
        asset.tags.some(
          (assetTag) => assetTag.toLowerCase() === selectedTag.toLowerCase(),
        ),
      );
      const matchesLicenses = selectedFilterLicenses.every((selectedLicense) =>
        (asset.licenses ?? []).some(
          (assetLicense) =>
            assetLicense.toLowerCase() === selectedLicense.toLowerCase(),
        ),
      );
      return (
        matchesQuery &&
        matchesTodo &&
        matchesCategory &&
        matchesTags &&
        matchesLicenses
      );
    });

    return [...filteredAssets].sort((left, right) => {
      if (sortMode === "oldest") {
        return Date.parse(left.uploadDate) - Date.parse(right.uploadDate);
      }

      if (sortMode === "title-asc") {
        return left.title.localeCompare(right.title, undefined, {
          sensitivity: "base",
        });
      }

      if (sortMode === "size-desc") {
        return right.size - left.size;
      }

      if (sortMode === "needs-metadata") {
        if (left.metadataEdited !== right.metadataEdited) {
          return left.metadataEdited ? 1 : -1;
        }
        return Date.parse(right.uploadDate) - Date.parse(left.uploadDate);
      }

      if (sortMode === "best-match") {
        if (normalizedSearchQuery && fuzzyRankByAssetId) {
          const leftRank =
            fuzzyRankByAssetId.get(left.id) ?? Number.MAX_SAFE_INTEGER;
          const rightRank =
            fuzzyRankByAssetId.get(right.id) ?? Number.MAX_SAFE_INTEGER;

          if (leftRank !== rightRank) {
            return leftRank - rightRank;
          }
        }

        return Date.parse(right.uploadDate) - Date.parse(left.uploadDate);
      }

      return Date.parse(right.uploadDate) - Date.parse(left.uploadDate);
    });
  })();

  $: todoCount = assets.filter((asset) => !asset.metadataEdited).length;
  $: allKnownTags = Array.from(
    new Set(
      assets.flatMap((asset) =>
        asset.tags.map((tag) => tag.trim()).filter(Boolean),
      ),
    ),
  ).sort((a, b) => a.localeCompare(b));
  $: categoryCounts = categoryOrder.map((category) => ({
    category,
    count: assets.filter((asset) => asset.category === category).length,
  }));
  $: tagCountMap = assets.reduce<Record<string, number>>((counts, asset) => {
    for (const tag of asset.tags) {
      const key = tag.trim().toLowerCase();
      if (!key) continue;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, {});
  $: licenseCountMap = assets.reduce<Record<string, number>>(
    (counts, asset) => {
      for (const license of asset.licenses ?? []) {
        const key = license.trim().toLowerCase();
        if (!key) continue;
        counts[key] = (counts[key] ?? 0) + 1;
      }
      return counts;
    },
    {},
  );
  $: normalizedFilterTagQuery = filterTagQuery.trim().toLowerCase();
  $: normalizedFilterLicenseQuery = filterLicenseQuery.trim().toLowerCase();
  $: filteredTagRows = allKnownTags
    .filter(
      (tag) =>
        !normalizedFilterTagQuery ||
        tag.toLowerCase().includes(normalizedFilterTagQuery),
    )
    .map((tag) => ({
      tag,
      count: tagCountMap[tag.toLowerCase()] ?? 0,
      selected: selectedFilterTags.some(
        (selected) => selected.toLowerCase() === tag.toLowerCase(),
      ),
    }));
  $: filteredLicenseRows = allKnownLicenses
    .filter(
      (license) =>
        !!licenseCountMap[license.toLowerCase()] &&
        (!normalizedFilterLicenseQuery ||
          license.toLowerCase().includes(normalizedFilterLicenseQuery)),
    )
    .map((license) => ({
      license,
      count: licenseCountMap[license.toLowerCase()] ?? 0,
      selected: selectedFilterLicenses.some(
        (selected) => selected.toLowerCase() === license.toLowerCase(),
      ),
    }));
  $: allKnownLicenses = Array.from(
    new Set(
      [
        ...commonLicenseOptions,
        ...assets.flatMap((asset) =>
          (asset.licenses ?? [])
            .map((license) => license.trim())
            .filter(Boolean),
        ),
      ]
        .map((license) => license.trim())
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b));
  $: uploadPendingCount = Math.max(0, uploadBatchTotal - uploadProcessedCount);
  $: {
    const suggestedLicenses =
      sourceLicensePrefillHelper.getPrefillLicensesForSourceUrl(
        importPrefillSourceUrl,
      );
    if (suggestedLicenses.length > 0) {
      const existingLicenses = new Set(
        importPrefillLicenses.map((license) => license.trim().toLowerCase()),
      );
      const missingLicenses = suggestedLicenses.filter(
        (license) => !existingLicenses.has(license.toLowerCase()),
      );

      if (missingLicenses.length > 0) {
        importPrefillLicenses = [...importPrefillLicenses, ...missingLicenses];
      }
    }
  }

  function hasFilePayload(event: DragEvent): boolean {
    const types = event.dataTransfer?.types;
    return !!types && Array.from(types).includes("Files");
  }

  function titleFromFileName(fileName: string): string {
    const base = fileName.replace(/\.[^/.]+$/, "");
    return base.trim() || fileName;
  }

  function formatCategoryLabel(category: AssetCategory): string {
    return `${category.slice(0, 1).toUpperCase()}${category.slice(1)}`;
  }

  function parseListParam(
    searchParams: URLSearchParams,
    key: string,
  ): string[] {
    const value = searchParams.get(key);
    if (!value) return [];

    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  function syncFiltersFromUrl(): void {
    if (!browser) return;

    const url = new URL(globalThis.location.href);
    const categoriesFromUrl = parseListParam(
      url.searchParams,
      FILTER_QUERY_KEYS.categories,
    );
    const tagsFromUrl = parseListParam(
      url.searchParams,
      FILTER_QUERY_KEYS.tags,
    );
    const licensesFromUrl = parseListParam(
      url.searchParams,
      FILTER_QUERY_KEYS.licenses,
    );
    const knownCategorySet = new Set(categoryOrder);

    selectedCategories = categoriesFromUrl.filter(
      (category): category is AssetCategory =>
        knownCategorySet.has(category as AssetCategory),
    );

    selectedFilterTags = Array.from(
      new Map(tagsFromUrl.map((tag) => [tag.toLowerCase(), tag])).values(),
    );
    selectedFilterLicenses = Array.from(
      new Map(
        licensesFromUrl.map((license) => [license.toLowerCase(), license]),
      ).values(),
    );

    const todoParam = url.searchParams.get(FILTER_QUERY_KEYS.todo);
    showTodoOnly = todoParam === "1" || todoParam === "true";

    const sortParam = url.searchParams.get(FILTER_QUERY_KEYS.sort);
    sortMode = SORT_MODE_OPTIONS.some((option) => option.value === sortParam)
      ? (sortParam as SortMode)
      : DEFAULT_SORT_MODE;
  }

  function applyTheme(theme: ThemeMode): void {
    if (!browser) return;
    themeMode = theme;
    document.documentElement.dataset.theme = theme;
    globalThis.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }

  function toggleTheme(): void {
    applyTheme(themeMode === "dark" ? "light" : "dark");
  }

  function openGitHubRepo(): void {
    if (!browser) return;
    globalThis.open(GITHUB_REPO_URL, "_blank", "noopener,noreferrer");
  }

  function onWindowScroll(): void {
    if (!browser) return;
    showBackToTop = globalThis.scrollY > 420;
  }

  function scrollToTop(): void {
    if (!browser) return;
    globalThis.scrollTo({ top: 0, behavior: "smooth" });
  }

  function initializeTheme(): void {
    if (!browser) return;

    const savedTheme = globalThis.localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme === "light" || savedTheme === "dark") {
      applyTheme(savedTheme);
      return;
    }

    const prefersDark = globalThis.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    applyTheme(prefersDark ? "dark" : "light");
  }

  function syncUrlFromFilters(): void {
    if (!browser || !didHydrateFiltersFromUrl) return;

    const url = new URL(globalThis.location.href);

    url.searchParams.delete(FILTER_QUERY_KEYS.todo);
    url.searchParams.delete(FILTER_QUERY_KEYS.categories);
    url.searchParams.delete(FILTER_QUERY_KEYS.tags);
    url.searchParams.delete(FILTER_QUERY_KEYS.licenses);
    url.searchParams.delete(FILTER_QUERY_KEYS.sort);

    if (showTodoOnly) {
      url.searchParams.set(FILTER_QUERY_KEYS.todo, "1");
    }

    if (selectedCategories.length > 0) {
      url.searchParams.set(
        FILTER_QUERY_KEYS.categories,
        selectedCategories.join(","),
      );
    }

    if (selectedFilterTags.length > 0) {
      url.searchParams.set(
        FILTER_QUERY_KEYS.tags,
        selectedFilterTags.join(","),
      );
    }

    if (selectedFilterLicenses.length > 0) {
      url.searchParams.set(
        FILTER_QUERY_KEYS.licenses,
        selectedFilterLicenses.join(","),
      );
    }

    if (sortMode !== DEFAULT_SORT_MODE) {
      url.searchParams.set(FILTER_QUERY_KEYS.sort, sortMode);
    }

    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    const currentUrl = `${globalThis.location.pathname}${globalThis.location.search}${globalThis.location.hash}`;
    if (nextUrl !== currentUrl) {
      replaceState(nextUrl, globalThis.history.state);
    }
  }

  function queueFiles(files: File[]): void {
    if (!files.length) return;
    importPrefillSourceUrl = "";
    importPrefillLicenses = [];
    pendingImportFiles = files;
    importPrefillOpen = true;
  }

  function cancelImportPrefill(): void {
    importPrefillOpen = false;
    pendingImportFiles = [];
    importPrefillSourceUrl = "";
    importPrefillLicenses = [];
  }

  function closeImportPrefillDialog(): void {
    if (importPrefillDialogRef) {
      importPrefillDialogRef.requestClose();
      return;
    }
    cancelImportPrefill();
  }

  function queuePendingImports(): void {
    const files = pendingImportFiles;
    if (!files.length) return;

    const sourceUrl = importPrefillSourceUrl.trim();
    const licenses = [...importPrefillLicenses];
    const queuedUploads = files.map((file) => ({
      file,
      sourceUrl,
      licenses,
    }));

    const queuedBefore = uploadQueue.length;
    if (!queueRunning && queuedBefore === 0) {
      uploadBatchTotal = 0;
      uploadProcessedCount = 0;
    }

    uploadQueue = [...uploadQueue, ...queuedUploads];
    uploadBatchTotal += files.length;
    toast.success(
      `Queued ${files.length} file${files.length === 1 ? "" : "s"} for upload.`,
    );

    pendingImportFiles = [];
    importPrefillOpen = false;
    void processUploadQueue();
  }

  async function uploadSingleFile(upload: QueuedUpload): Promise<void> {
    const { file, sourceUrl, licenses } = upload;
    const form = new FormData();
    form.set("title", titleFromFileName(file.name));
    form.set("tags", "");
    form.set("sourceUrl", sourceUrl);
    form.set("licenses", licenses.join(","));
    form.set("file", file);

    await api.uploadAsset(form, file.name, () => {});
  }

  async function processUploadQueue(): Promise<void> {
    if (queueRunning) return;
    queueRunning = true;

    let uploadedCount = 0;
    const worker = async (): Promise<void> => {
      while (uploadQueue.length > 0) {
        const nextUpload = uploadQueue[0];
        uploadQueue = uploadQueue.slice(1);

        try {
          await uploadSingleFile(nextUpload);
          uploadedCount += 1;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Upload failed.";
          if (message.toLowerCase().includes("duplicate")) {
            toast.warning(message);
          } else {
            toast.error(message);
          }
        } finally {
          uploadProcessedCount += 1;
        }
      }
    };

    const workerCount = Math.min(uploadParallelism, uploadQueue.length);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));

    queueRunning = false;
    if (uploadedCount > 0) {
      toast.success(
        `Uploaded ${uploadedCount} file${uploadedCount === 1 ? "" : "s"}.`,
      );
      await loadAssets();
    }
  }

  async function loadAssets(): Promise<void> {
    loading = true;
    try {
      assets = await api.listAssets();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load assets.",
      );
    } finally {
      loading = false;
    }
  }

  async function loadAiConfig(): Promise<void> {
    try {
      const config = await api.getAiConfig();
      if (!config) return;
      aiConfig = config;
    } catch {
      // Optional integration; ignore transient failures.
    }
  }

  async function saveAiConfig(): Promise<void> {
    aiSaving = true;

    try {
      aiConfig = await api.saveAiConfig(aiConfig as AiConfig);
      aiSettingsOpen = false;
      toast.success(
        aiConfig.enabled ? "AI auto metadata enabled." : "AI settings saved.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save AI settings.",
      );
    } finally {
      aiSaving = false;
    }
  }

  function onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    pageDragDepth = 0;
    isDragging = false;
    queueFiles(Array.from(event.dataTransfer?.files ?? []));
  }

  function onWindowDragEnter(event: DragEvent): void {
    if (!hasFilePayload(event)) return;
    event.preventDefault();
    pageDragDepth += 1;
    isDragging = true;
  }

  function onWindowDragOver(event: DragEvent): void {
    if (!hasFilePayload(event)) return;
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "copy";
    }
    isDragging = true;
  }

  function onWindowDragLeave(event: DragEvent): void {
    if (!hasFilePayload(event)) return;
    event.preventDefault();
    pageDragDepth = Math.max(0, pageDragDepth - 1);
    if (pageDragDepth === 0) isDragging = false;
  }

  function startEdit(asset: AssetView): void {
    editingAssetId = asset.id;
    editTitle = asset.title;
    editTags = [...asset.tags];
    editLicenses =
      asset.licenses && asset.licenses.length > 0
        ? [...asset.licenses]
        : ["Unknown"];
    editSourceUrl = asset.sourceUrl ?? "";
    editDescription = asset.description ?? "";
  }

  function cancelEdit(): void {
    editingAssetId = null;
    editTitle = "";
    editTags = [];
    editLicenses = [];
    editSourceUrl = "";
    editDescription = "";
  }

  function toggleFilterTag(rawTag: string): void {
    const tag = rawTag.trim();
    if (!tag) return;
    const isSelected = selectedFilterTags.some(
      (current) => current.toLowerCase() === tag.toLowerCase(),
    );
    if (isSelected) {
      selectedFilterTags = selectedFilterTags.filter(
        (current) => current.toLowerCase() !== tag.toLowerCase(),
      );
    } else {
      selectedFilterTags = [...selectedFilterTags, tag];
    }
  }

  function toggleFilterLicense(rawLicense: string): void {
    const license = rawLicense.trim();
    if (!license) return;
    const isSelected = selectedFilterLicenses.some(
      (current) => current.toLowerCase() === license.toLowerCase(),
    );
    if (isSelected) {
      selectedFilterLicenses = selectedFilterLicenses.filter(
        (current) => current.toLowerCase() !== license.toLowerCase(),
      );
    } else {
      selectedFilterLicenses = [...selectedFilterLicenses, license];
    }
  }

  function toggleCategory(category: AssetCategory): void {
    if (selectedCategories.includes(category)) {
      selectedCategories = selectedCategories.filter(
        (item) => item !== category,
      );
      return;
    }
    selectedCategories = [...selectedCategories, category];
  }

  function clearAllFilters(): void {
    selectedCategories = [];
    selectedFilterTags = [];
    selectedFilterLicenses = [];
    filterTagQuery = "";
    filterLicenseQuery = "";
    showTodoOnly = false;
  }

  function onFilterTagQueryKeyDown(event: KeyboardEvent): void {
    if (event.key === "Enter") {
      event.preventDefault();
      const candidate = filteredTagRows[0]?.tag || "";
      if (candidate) toggleFilterTag(candidate);
      return;
    }

    if (
      event.key === "Backspace" &&
      !filterTagQuery &&
      selectedFilterTags.length > 0
    ) {
      event.preventDefault();
      selectedFilterTags = selectedFilterTags.slice(0, -1);
      return;
    }

    if (event.key === "Escape") {
      filterTagQuery = "";
    }
  }

  function onFilterLicenseQueryKeyDown(event: KeyboardEvent): void {
    if (event.key === "Enter") {
      event.preventDefault();
      const candidate = filteredLicenseRows[0]?.license || "";
      if (candidate) toggleFilterLicense(candidate);
      return;
    }

    if (
      event.key === "Backspace" &&
      !filterLicenseQuery &&
      selectedFilterLicenses.length > 0
    ) {
      event.preventDefault();
      selectedFilterLicenses = selectedFilterLicenses.slice(0, -1);
      return;
    }

    if (event.key === "Escape") {
      filterLicenseQuery = "";
    }
  }

  function saveActiveEdit(): void {
    if (!editingAssetId) return;
    void saveMetadata(editingAssetId);
  }

  function triggerReplaceFilePicker(): void {
    replaceInputEl?.click();
  }

  async function replaceActiveAssetFile(event: Event): Promise<void> {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";

    if (!editingAssetId || !file) return;

    replaceInProgress = true;

    try {
      await api.replaceAssetFile(editingAssetId, file);

      toast.success("File replaced. Please review metadata.");
      await loadAssets();
    } catch (errorValue) {
      toast.error(
        errorValue instanceof Error
          ? errorValue.message
          : "Failed to replace file.",
      );
    } finally {
      replaceInProgress = false;
    }
  }

  function closeEditDialog(): void {
    if (editDialogRef) {
      editDialogRef.requestClose();
      return;
    }
    cancelEdit();
  }

  function closeAiDialog(): void {
    if (aiDialogRef) {
      aiDialogRef.requestClose();
      return;
    }
    aiSettingsOpen = false;
  }

  function onWindowKeyDown(event: KeyboardEvent): void {
    if (event.key === "Escape" && editingAssetId) {
      closeEditDialog();
    }
  }

  async function saveMetadata(assetId: string): Promise<void> {
    if (editLicenses.length === 0) {
      toast.error("At least one license is required.");
      return;
    }

    saveInProgress = true;
    try {
      await api.updateAsset(assetId, {
        title: editTitle,
        description: editDescription,
        tags: editTags,
        licenses: editLicenses,
        sourceUrl: editSourceUrl,
      });
      toast.success("Metadata updated.");
      closeEditDialog();
      await loadAssets();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save metadata.",
      );
    } finally {
      saveInProgress = false;
    }
  }

  async function removeAsset(asset: AssetView): Promise<void> {
    const shouldDelete = globalThis.confirm(
      `Delete "${asset.title}"? This cannot be undone.`,
    );
    if (!shouldDelete) return;

    deletingAssetId = asset.id;
    try {
      await api.deleteAsset(asset.id);
      if (editingAssetId === asset.id) cancelEdit();
      toast.success("Asset deleted.");
      await loadAssets();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete asset.",
      );
    } finally {
      deletingAssetId = null;
    }
  }

  async function loadTextPreview(asset: AssetView): Promise<void> {
    if (textPreviews[asset.id] !== undefined) return;
    const text = await api.getTextPreview(asset.textPreviewUrl);
    if (text === null) return;
    textPreviews[asset.id] = text;
  }

  function formatTimeAgo(iso: string): string {
    const uploadedAt = new Date(iso).getTime();
    const now = Date.now();
    const diffMs = Math.max(0, now - uploadedAt);

    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;

    if (diffMs < minute) return "just now";
    if (diffMs < hour) {
      const minutes = Math.floor(diffMs / minute);
      return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
    }
    if (diffMs < day) {
      const hours = Math.floor(diffMs / hour);
      return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    }

    const days = Math.floor(diffMs / day);
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(2)} MB`;
  }

  onMount(loadAssets);
  onMount(loadAiConfig);
  onMount(initializeTheme);
  onMount(onWindowScroll);
  onMount(() => {
    syncFiltersFromUrl();
    didHydrateFiltersFromUrl = true;

    const onPopState = (): void => {
      syncFiltersFromUrl();
    };
    globalThis.addEventListener("popstate", onPopState);
    return () => {
      globalThis.removeEventListener("popstate", onPopState);
    };
  });

  $: {
    // Explicitly reference dependencies so Svelte reruns this block on filter changes.
    didHydrateFiltersFromUrl;
    showTodoOnly;
    selectedCategories;
    selectedFilterTags;
    selectedFilterLicenses;
    sortMode;
    syncUrlFromFilters();
  }
</script>

<svelte:window
  on:dragenter={onWindowDragEnter}
  on:dragover={onWindowDragOver}
  on:dragleave={onWindowDragLeave}
  on:drop={onDrop}
  on:keydown={onWindowKeyDown}
  on:scroll={onWindowScroll}
/>

<main class="assetlib-shell">
  {#if isDragging}
    <div class="assetlib-drop-overlay" aria-hidden="true">
      <div class="assetlib-drop-overlay-card">Drop files to queue upload</div>
    </div>
  {/if}

  <header class="assetlib-glass assetlib-topbar">
    <div class="assetlib-title-wrap">
      <TitleIconReel
        categories={categoryOrder}
        iconByCategory={categoryIconByType}
      />
      <h1>Asset Library</h1>
      <div class="assetlib-title-stats">
        <span>{assets.length}</span>
        {#if uploadPendingCount > 0}
          <span class="active assetlib-upload-indicator" aria-live="polite">
            <Icon
              icon="codex:loader"
              width="1rem"
              height="1rem"
              aria-hidden="true"
            />
            Uploading {uploadPendingCount} left
          </span>
        {/if}
      </div>
    </div>
    <div class="assetlib-topbar-actions">
      <Button
        onclick={toggleTheme}
        title="Toggle light/dark mode"
        iconOnly={true}
      >
        <Icon
          icon={themeMode === "dark"
            ? "mdi:weather-sunny"
            : "mdi:weather-night"}
          width="1rem"
          height="1rem"
          aria-hidden="true"
        />
      </Button>

      <Button onclick={openGitHubRepo} title="Open repository on GitHub">
        <Icon icon="mdi:github" width="1rem" height="1rem" aria-hidden="true" />
        View on GitHub
      </Button>

      <Button
        onclick={() => {
          aiSettingsOpen = true;
        }}
      >
        <Icon
          icon="mingcute:file-ai-fill"
          width="1rem"
          height="1rem"
          aria-hidden="true"
        />
        AI</Button
      >

      <input
        bind:this={uploadInputEl}
        type="file"
        multiple
        class="assetlib-file-input-hidden"
        on:change={(event) => {
          const target = event.currentTarget as HTMLInputElement;
          queueFiles(Array.from(target.files ?? []));
          target.value = "";
        }}
      />
      <Button
        onclick={() => {
          uploadInputEl?.click();
        }}
      >
        <Icon icon="mdi:upload" width="1rem" height="1rem" aria-hidden="true" />
        Import Files
      </Button>
    </div>
  </header>

  <section class="assetlib-glass assetlib-library">
    <div class="assetlib-library-layout">
      <FilterPane
        bind:showTodoOnly
        {todoCount}
        {categoryCounts}
        {selectedCategories}
        {categoryIconByType}
        {formatCategoryLabel}
        {toggleCategory}
        {clearAllFilters}
        {selectedFilterTags}
        {selectedFilterLicenses}
        {filteredTagRows}
        {toggleFilterTag}
        bind:filterTagQuery
        {onFilterTagQueryKeyDown}
        {filteredLicenseRows}
        {toggleFilterLicense}
        bind:filterLicenseQuery
        {onFilterLicenseQueryKeyDown}
      />

      <div class="assetlib-library-main">
        <div class="assetlib-tools">
          <SearchField
            bind:value={searchQuery}
            placeholder="Search title, description, tag, file type, file, category"
          />
          <SelectField bind:value={sortMode} options={SORT_MODE_OPTIONS} />
        </div>

        {#if loading}
          <p>Loading assets...</p>
        {:else if assets.length === 0}
          <p>No assets yet, get started by dragging and dropping files here.</p>
        {:else if visibleAssets.length === 0}
          <p>No assets match this filter.</p>
        {:else}
          <div class="assetlib-grid">
            {#each visibleAssets as asset}
              <AssetCard
                {asset}
                textPreview={textPreviews[asset.id]}
                onEdit={startEdit}
                onLoadText={loadTextPreview}
                {formatSize}
                {formatTimeAgo}
              />
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </section>

  {#if editingAssetId}
    <Dialog
      bind:this={editDialogRef}
      ariaLabel="Edit asset metadata"
      title="Edit Metadata"
      onClose={cancelEdit}
    >
      <label class="assetlib-modal-label">
        <span>Title</span>
        <Input bind:value={editTitle} minlength={2} maxlength={120} />
      </label>

      <input
        bind:this={replaceInputEl}
        type="file"
        class="assetlib-file-input-hidden"
        on:change={replaceActiveAssetFile}
      />

      <label class="assetlib-modal-label">
        <span>Tags</span>
        <TagPicker
          bind:values={editTags}
          allOptions={allKnownTags}
          emptyPlaceholder="Add tags"
          filledPlaceholder="Add another tag"
          dropdownAriaLabel="Tag suggestions"
          optionPrefix="#"
        />
      </label>

      <label class="assetlib-modal-label">
        <span>Description</span>
        <textarea
          bind:value={editDescription}
          class="assetlib-description-input"
          placeholder="Short description"
          rows="3"
          maxlength="240"
        ></textarea>
      </label>

      <label class="assetlib-modal-label">
        <span>Source URL</span>
        <Input
          bind:value={editSourceUrl}
          type="url"
          placeholder="https://example.com/..."
        />
      </label>

      <label class="assetlib-modal-label">
        <span>Licenses</span>
        <TagPicker
          bind:values={editLicenses}
          allOptions={allKnownLicenses}
          emptyPlaceholder="Add licenses"
          filledPlaceholder="Add another license"
          dropdownAriaLabel="License suggestions"
        />
      </label>

      {#snippet actions()}
        <Button
          disabled={saveInProgress ||
            replaceInProgress ||
            deletingAssetId === editingAssetId}
          onclick={triggerReplaceFilePicker}
        >
          {replaceInProgress ? "Replacing..." : "Replace File"}
        </Button>
        <Button
          variant="delete"
          disabled={saveInProgress ||
            replaceInProgress ||
            deletingAssetId === editingAssetId}
          onclick={() => {
            const asset = assets.find((item) => item.id === editingAssetId);
            if (!asset) return;
            void removeAsset(asset);
          }}
        >
          {deletingAssetId === editingAssetId ? "Deleting..." : "Delete"}
        </Button>
        <Button
          variant="emphasized"
          onclick={saveActiveEdit}
          disabled={saveInProgress || replaceInProgress}
        >
          {saveInProgress ? "Saving..." : "Save"}
        </Button>
        <Button onclick={closeEditDialog} disabled={replaceInProgress}
          >Cancel</Button
        >
      {/snippet}
    </Dialog>
  {/if}

  {#if aiSettingsOpen}
    <Dialog
      bind:this={aiDialogRef}
      ariaLabel="AI connection settings"
      title="AI Auto Metadata"
      onClose={() => {
        aiSettingsOpen = false;
      }}
    >
      <p class="assetlib-muted">
        Connect an OpenAI-compatible endpoint to auto-generate tags and a short
        description on upload.
      </p>

      <label class="assetlib-toggle">
        <input type="checkbox" bind:checked={aiConfig.enabled} />
        <span>Enable auto metadata</span>
      </label>

      <label class="assetlib-modal-label">
        <span>Base URL</span>
        <Input
          bind:value={aiConfig.baseUrl}
          placeholder="http://127.0.0.1:1234"
        />
      </label>

      <label class="assetlib-modal-label">
        <span>Model</span>
        <Input bind:value={aiConfig.model} placeholder="qwen2.5-7b-instruct" />
      </label>

      <label class="assetlib-modal-label">
        <span>API Key (optional)</span>
        <Input
          bind:value={aiConfig.apiKey}
          placeholder="leave empty for local dev"
        />
      </label>

      <label class="assetlib-modal-label">
        <span>Timeout (ms)</span>
        <Input
          type="number"
          min="1000"
          step="500"
          bind:value={aiConfig.timeoutMs}
        />
      </label>

      <label class="assetlib-modal-label">
        <span>Temperature</span>
        <Input
          type="number"
          min="0"
          max="2"
          step="0.1"
          bind:value={aiConfig.temperature}
        />
      </label>

      <label class="assetlib-modal-label">
        <span>Reasoning Effort</span>
        <SelectField
          bind:value={aiConfig.reasoningEffort}
          options={AI_REASONING_EFFORT_OPTIONS}
          minWidth="100%"
        />
      </label>

      <label class="assetlib-modal-label">
        <span>Custom Instruction (optional)</span>
        <textarea
          bind:value={aiConfig.customInstruction}
          class="assetlib-description-input"
          placeholder="Example: prioritize game-ready surface keywords and avoid brand names"
          rows="3"
          maxlength="1000"
        ></textarea>
      </label>

      {#snippet actions()}
        <Button variant="emphasized" onclick={saveAiConfig} disabled={aiSaving}>
          {aiSaving ? "Saving..." : "Save"}
        </Button>
        <Button onclick={closeAiDialog}>Cancel</Button>
      {/snippet}
    </Dialog>
  {/if}

  {#if importPrefillOpen}
    <Dialog
      bind:this={importPrefillDialogRef}
      ariaLabel="Bulk import prefills"
      title="Import Prefills"
      onClose={cancelImportPrefill}
    >
      <p class="assetlib-muted">
        Apply shared metadata to {pendingImportFiles.length} file{pendingImportFiles.length ===
        1
          ? ""
          : "s"} before queueing upload.
      </p>

      <label class="assetlib-modal-label">
        <span>Source URL (optional)</span>
        <Input
          bind:value={importPrefillSourceUrl}
          type="url"
          placeholder="https://example.com/..."
        />
      </label>

      <label class="assetlib-modal-label">
        <span>Licenses (optional)</span>
        <TagPicker
          bind:values={importPrefillLicenses}
          allOptions={allKnownLicenses}
          emptyPlaceholder="Add licenses"
          filledPlaceholder="Add another license"
          dropdownAriaLabel="License suggestions"
        />
      </label>

      {#snippet actions()}
        <Button variant="emphasized" onclick={queuePendingImports}
          >Queue Files</Button
        >
        <Button onclick={closeImportPrefillDialog}>Cancel</Button>
      {/snippet}
    </Dialog>
  {/if}

  {#if showBackToTop}
    <Button
      onclick={scrollToTop}
      extraClass="assetlib-back-to-top"
      title="Back to top"
      ariaLabel="Back to top"
      iconOnly={true}
    >
      <Icon icon="mdi:arrow-up" width="1rem" height="1rem" aria-hidden="true" />
    </Button>
  {/if}
</main>
