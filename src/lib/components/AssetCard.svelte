<script lang="ts">
  import Icon from "@iconify/svelte";
  import type { AssetCategory, AssetView } from "$lib/types";
  import AudioPreview from "$lib/components/AudioPreview.svelte";
  import Button from "$lib/components/Button.svelte";
  import ThreeModelPreview from "$lib/components/ThreeModelPreview.svelte";

  const categoryIconByType: Record<AssetCategory, string> = {
    model: "mdi:cube-outline",
    texture: "mdi:image-outline",
    audio: "mdi:music-note-outline",
    shader: "mdi:shimmer",
    script: "mdi:code-tags",
    other: "mdi:file-outline",
  };

  function formatCategoryLabel(category: AssetCategory): string {
    return `${category.slice(0, 1).toUpperCase()}${category.slice(1)}`;
  }

  let {
    asset,
    textPreview = undefined,
    onEdit,
    onLoadText,
    formatSize,
    formatTimeAgo,
  }: {
    asset: AssetView;
    textPreview?: string;
    onEdit: (asset: AssetView) => void;
    onLoadText: (asset: AssetView) => void;
    formatSize: (bytes: number) => string;
    formatTimeAgo: (iso: string) => string;
  } = $props();
</script>

<article class="assetlib-card">
  <div class="assetlib-preview-layer">
    {#if asset.previewKind === "audio"}
      <div class="assetlib-audio-wrap">
        <AudioPreview src={asset.fileUrl} title={asset.title} />
      </div>
    {:else if asset.previewKind === "image"}
      <div class="assetlib-image-wrap">
        <img
          src={asset.fileUrl}
          alt={asset.title}
          loading="lazy"
          draggable="false"
        />
        {#if asset.width && asset.height}
          <div class="assetlib-additionalInfo" aria-hidden="true">
            {asset.width}×{asset.height}
          </div>
        {/if}
      </div>
    {:else if asset.previewKind === "model"}
      <ThreeModelPreview
        src={asset.fileUrl}
        fileName={asset.originalName}
        alt={asset.title}
      />
    {:else if asset.previewKind === "text"}
      <div class="assetlib-text-preview">
        {#if textPreview}
          <pre>{textPreview}</pre>
        {:else}
          <Button onclick={() => onLoadText(asset)}>Load Preview</Button>
          <p class="assetlib-muted">Text preview available.</p>
        {/if}
      </div>
    {:else}
      <div class="assetlib-empty-preview">
        <p class="assetlib-muted">No inline preview.</p>
      </div>
    {/if}
  </div>

  <div class="assetlib-card-overlay">
    <div class="assetlib-card-head">
      <h3>{asset.title}</h3>
      <div class="assetlib-badges">
        {#if !asset.metadataEdited}<span class="assetlib-todo-badge">TODO</span
          >{/if}
        <span
          class="assetlib-type-badge"
          aria-label={formatCategoryLabel(asset.category)}
          title={formatCategoryLabel(asset.category)}
        >
          <Icon
            icon={categoryIconByType[asset.category]}
            width="0.9rem"
            height="0.9rem"
            aria-hidden="true"
          />
        </span>
      </div>
      <div class="assetlib-card-meta">
        <p class="assetlib-last-updated">
          Updated {formatTimeAgo(asset.uploadDate)}
        </p>
        <p class="assetlib-muted assetlib-size">
          {formatSize(asset.size)}
        </p>
      </div>
    </div>
  </div>

  <div class="assetlib-actions">
    {#if asset.sourceUrl?.trim()}
      <Button
        onclick={() => {
          globalThis.open(asset.sourceUrl, "_blank", "noopener,noreferrer");
        }}
        ariaLabel="Open source link"
        title="Open source link"
        iconOnly={true}
      >
        <Icon
          icon="mdi:open-in-new"
          width="1rem"
          height="1rem"
          aria-hidden="true"
        />
      </Button>
    {/if}

    <Button
      onclick={() => onEdit(asset)}
      ariaLabel="Edit metadata"
      title="Edit metadata"
      iconOnly={true}
    >
      <Icon icon="mdi:pencil" width="1rem" height="1rem" aria-hidden="true" />
    </Button>

    <Button
      href={asset.downloadUrl}
      ariaLabel="Download asset"
      title="Download asset"
      iconOnly={true}
    >
      <Icon icon="mdi:download" width="1rem" height="1rem" aria-hidden="true" />
    </Button>
  </div>
</article>

<style>
  .assetlib-card {
    position: relative;
    min-height: 300px;
    border-radius: 12px;
    background: linear-gradient(
      145deg,
      var(--background),
      var(--backgroundLight)
    );
    border: 1px solid var(--borderColor);
    box-shadow: var(--shadow-m);
    overflow: hidden;
  }

  .assetlib-card-head {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.45rem;
    align-items: start;
  }

  .assetlib-card h3 {
    margin: 0;
    min-width: 0;
    font-size: 1rem;
    color: var(--app-text);
    text-shadow: 0 2px 12px var(--backgroundTextContrastShadow);
  }

  .assetlib-card-meta {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.6rem;
  }

  .assetlib-last-updated {
    margin: 0;
    font-size: 0.875rem;
    color: var(--app-text-muted);
    text-shadow: 0 2px 10px var(--backgroundTextContrastShadow);
    opacity: 0;
    transform: translateY(-3px);
    transition:
      opacity 140ms ease,
      transform 140ms ease;
  }

  .assetlib-card:hover .assetlib-last-updated,
  .assetlib-card:focus-within .assetlib-last-updated {
    opacity: 1;
    transform: translateY(0);
  }

  .assetlib-size {
    opacity: 0;
    transform: translateY(-3px);
    transition:
      opacity 140ms ease,
      transform 140ms ease;
  }

  .assetlib-card:hover .assetlib-size,
  .assetlib-card:focus-within .assetlib-size {
    opacity: 1;
    transform: translateY(0);
  }

  .assetlib-badges {
    display: flex;
    gap: 0.25rem;
  }

  .assetlib-type-badge,
  .assetlib-todo-badge {
    font-size: 0.625rem;
    padding: 0.25rem 0.5rem;
    border-radius: 999px;
    border: 1px solid var(--borderHoverColor);
  }

  .assetlib-type-badge {
    width: 1.8rem;
    height: 1.4rem;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--app-text);
    background: var(--backgroundLight);
  }

  .assetlib-todo-badge {
    border-color: var(--warning);
    color: var(--warning);
    background: var(--warningSecondary);
  }

  .assetlib-muted {
    margin: 0;
    font-size: 0.875rem;
    color: var(--app-text-muted);
  }

  .assetlib-card-overlay {
    position: absolute;
    inset: 0;
    z-index: 2;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 0.45rem;
    pointer-events: none;
    background: linear-gradient(
      180deg,
      var(--backgroundTextContrastShadow) 0%,
      transparent 46%,
      var(--backgroundTextContrastShadow) 100%
    );
  }

  .assetlib-preview-layer {
    position: absolute;
    inset: 0;
    z-index: 1;
    background: var(--canvas-bg);
  }

  .assetlib-image-wrap {
    position: absolute;
    inset: 0;
  }

  .assetlib-additionalInfo {
    position: absolute;
    bottom: 0.75rem;
    left: 0.75rem;
    z-index: 4;
    padding: 0.25rem 0.45rem;
    border-radius: 8px;
    font-size: 0.75rem;
    color: var(--app-text);
    background: rgba(0, 0, 0, 0.45);
    backdrop-filter: blur(6px);
    opacity: 0;
    transform: translateY(4px);
    transition:
      opacity 140ms ease,
      transform 140ms ease;
    pointer-events: none;
  }

  .assetlib-card:hover .assetlib-additionalInfo,
  .assetlib-card:focus-within .assetlib-additionalInfo {
    opacity: 1;
    transform: translateY(0);
  }

  .assetlib-preview-layer img {
    width: 100%;
  }

  .assetlib-preview-layer img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    background: var(--canvas-bg);
  }

  .assetlib-preview-layer pre {
    max-width: 100%;
    margin: 0;
    padding: 0.5rem;
    border-radius: 10px;
    border: 1px solid var(--borderHoverColor);
    background: var(--backgroundLight);
    max-height: 100%;
    overflow: auto;
    white-space: pre-wrap;
    font-size: 0.875rem;
    color: var(--app-text-muted);
  }

  .assetlib-audio-wrap,
  .assetlib-text-preview,
  .assetlib-empty-preview {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    padding: 0.75rem;
  }

  .assetlib-text-preview {
    gap: 0.6rem;
    align-content: center;
  }

  .assetlib-text-preview .assetlib-muted,
  .assetlib-empty-preview .assetlib-muted {
    color: var(--app-text);
    text-shadow: 0 2px 10px var(--backgroundTextContrastShadow);
  }

  .assetlib-preview-layer :global(.three-preview) {
    width: 100%;
    height: 100%;
    border: none;
    border-radius: 0;
  }

  .assetlib-actions {
    position: absolute;
    right: 0.75rem;
    bottom: 0.75rem;
    z-index: 3;
    display: flex;
    gap: 0.35rem;
    flex-wrap: wrap;
    opacity: 0;
    transform: translateY(6px);
    pointer-events: none;
    transition:
      opacity 140ms ease,
      transform 140ms ease;
  }

  .assetlib-card:hover .assetlib-actions,
  .assetlib-card:focus-within .assetlib-actions {
    opacity: 1;
    transform: translateY(0);
    pointer-events: auto;
  }

  @media (hover: none) {
    .assetlib-actions {
      opacity: 1;
      transform: translateY(0);
      pointer-events: auto;
    }
  }
</style>
