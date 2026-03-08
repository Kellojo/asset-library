<script lang="ts">
  import Icon from "@iconify/svelte";
  import Button from "$lib/components/Button.svelte";

  let {
    open = $bindable(false),
    hasUploadedBefore = false,
    queueRunning = false,
    batchTotal = 0,
    processedCount = 0,
    pendingCount = 0,
    succeededCount = 0,
    failedCount = 0,
    currentFileName = "",
    currentFileProgress = 0,
    progressPercent = 0,
    lastError = "",
  }: {
    open?: boolean;
    hasUploadedBefore?: boolean;
    queueRunning?: boolean;
    batchTotal?: number;
    processedCount?: number;
    pendingCount?: number;
    succeededCount?: number;
    failedCount?: number;
    currentFileName?: string;
    currentFileProgress?: number;
    progressPercent?: number;
    lastError?: string;
  } = $props();
</script>

<div class="assetlib-upload-progress-root">
  {#if hasUploadedBefore}
    <Button
      extraClass="assetlib-upload-progress-toggle"
      ariaLabel="Toggle upload progress"
      title="Toggle upload progress"
      onclick={() => {
        open = !open;
      }}
    >
      <span
        class="assetlib-upload-progress-trigger"
        aria-expanded={open}
        aria-controls="assetlib-upload-progress-popup"
      >
        <Icon
          icon="mdi:upload"
          width="0.95rem"
          height="0.95rem"
          aria-hidden="true"
        />
        <span>Uploads</span>
        {#if queueRunning || batchTotal > 0}
          <span class="assetlib-upload-progress-badge">{pendingCount}</span>
        {/if}
      </span>
    </Button>
  {/if}

  {#if hasUploadedBefore && open && batchTotal > 0}
    <section
      id="assetlib-upload-progress-popup"
      class="assetlib-upload-progress-popup assetlib-glass"
      aria-label="Upload progress"
    >
      <div class="assetlib-upload-progress-head">
        <strong>Upload Progress</strong>
      </div>

      <p class="assetlib-upload-progress-status">
        {queueRunning ? "Uploading" : "Finished"}
        {processedCount}/{batchTotal}
        ({progressPercent}%)
      </p>
      <div class="assetlib-upload-progress-bar" aria-hidden="true">
        <span style={`width: ${progressPercent}%`}></span>
      </div>

      {#if currentFileName}
        <p class="assetlib-upload-progress-current" title={currentFileName}>
          Current: {currentFileName} ({currentFileProgress}%)
        </p>
      {/if}

      <div class="assetlib-upload-progress-stats">
        <span>Success {succeededCount}</span>
        <span>Failed {failedCount}</span>
        <span>Queued {pendingCount}</span>
      </div>

      {#if lastError}
        <p class="assetlib-upload-progress-error" title={lastError}>
          Last error: {lastError}
        </p>
      {/if}
    </section>
  {/if}
</div>

<style>
  .assetlib-upload-progress-root {
    position: relative;
    z-index: var(--z-static-status);
    display: grid;
    justify-items: end;
  }

  :global(.assetlib-upload-progress-toggle) {
    padding-inline: 0.6rem;
  }

  .assetlib-upload-progress-trigger {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }

  .assetlib-upload-progress-badge {
    min-width: 1.25rem;
    border-radius: 999px;
    border: 1px solid var(--border-2);
    padding: 0.1rem 0.35rem;
    text-align: center;
    font-size: 0.75rem;
    background: var(--surface-inset);
  }

  .assetlib-upload-progress-popup {
    position: absolute;
    top: calc(100% + 0.4rem);
    right: 0;
    z-index: calc(var(--z-static-status) + 1);
    width: min(20rem, calc(100vw - 2rem));
    padding: 0.65rem;
    border-radius: 12px;
    display: grid;
    gap: 0.5rem;
    transform-origin: top right;
    animation: assetlib-upload-popup-in 110ms ease-out;
  }

  .assetlib-upload-progress-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .assetlib-upload-progress-head strong {
    font-size: 0.8rem;
    letter-spacing: 0.02em;
  }

  .assetlib-upload-progress-status,
  .assetlib-upload-progress-current,
  .assetlib-upload-progress-error {
    margin: 0;
    font-size: 0.75rem;
  }

  .assetlib-upload-progress-current,
  .assetlib-upload-progress-error {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .assetlib-upload-progress-error {
    color: var(--error);
  }

  .assetlib-upload-progress-bar {
    width: 100%;
    height: 0.45rem;
    border-radius: 999px;
    background: var(--surface-inset);
    border: 1px solid var(--border-2);
    overflow: hidden;
  }

  .assetlib-upload-progress-bar span {
    display: block;
    height: 100%;
    width: 0;
    background: linear-gradient(90deg, var(--accent), var(--accent-strong));
    transition: width 120ms linear;
  }

  .assetlib-upload-progress-stats {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.35rem;
  }

  .assetlib-upload-progress-stats span {
    border: 1px solid var(--border-2);
    background: var(--surface-inset);
    border-radius: 8px;
    padding: 0.25rem 0.35rem;
    text-align: center;
    font-size: 0.7rem;
  }

  @media (max-width: 900px) {
    .assetlib-upload-progress-popup {
      right: -0.15rem;
      width: min(18rem, calc(100vw - 1.2rem));
    }
  }

  @keyframes assetlib-upload-popup-in {
    from {
      opacity: 0;
      transform: translateY(-3px) scale(0.985);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
</style>
