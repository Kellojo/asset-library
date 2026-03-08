<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import type WaveSurfer from "wavesurfer.js";

  let { src, title }: { src: string; title: string } = $props();

  let waveformEl: HTMLDivElement | null = null;
  let wavesurfer: WaveSurfer | null = null;
  let observer: IntersectionObserver | null = null;

  let isReady = $state(false);
  let isPlaying = $state(false);
  let hasError = $state(false);
  let currentTime = $state(0);
  let duration = $state(0);
  let isLoading = $state(false);
  let hasInitialized = false;

  async function initWaveform(): Promise<void> {
    if (!waveformEl || hasInitialized || isLoading) return;

    isLoading = true;
    hasError = false;

    try {
      const { default: WaveSurfer } = await import("wavesurfer.js");
      if (!waveformEl) return;

      wavesurfer = WaveSurfer.create({
        container: waveformEl,
        url: src,
        height: 92,
        barWidth: 3,
        barGap: 2,
        barRadius: 2,
        normalize: true,
        dragToSeek: true,
        waveColor: "rgba(220, 220, 220, 0.56)",
        progressColor: "rgba(255, 255, 255, 0.95)",
        cursorColor: "rgba(255, 255, 255, 0.7)",
        cursorWidth: 2,
      });

      hasInitialized = true;

      wavesurfer.on("ready", () => {
        isReady = true;
        hasError = false;
        duration = wavesurfer?.getDuration() ?? 0;
        currentTime = 0;
      });

      wavesurfer.on("timeupdate", (time: number) => {
        currentTime = time;
      });

      wavesurfer.on("play", () => {
        isPlaying = true;
      });

      wavesurfer.on("pause", () => {
        isPlaying = false;
      });

      wavesurfer.on("finish", () => {
        isPlaying = false;
        currentTime = duration;
      });

      wavesurfer.on("error", () => {
        hasError = true;
        isReady = false;
        isPlaying = false;
      });
    } catch {
      hasError = true;
    } finally {
      isLoading = false;
    }
  }

  function formatTime(seconds: number): string {
    const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
    const mins = Math.floor(safe / 60);
    const secs = Math.floor(safe % 60)
      .toString()
      .padStart(2, "0");
    return `${mins}:${secs}`;
  }

  async function togglePlayback(): Promise<void> {
    if (!wavesurfer || !isReady) return;
    await wavesurfer.playPause();
  }

  onMount(() => {
    if (!waveformEl) return;

    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          void initWaveform();
          observer?.disconnect();
          observer = null;
          break;
        }
      },
      {
        root: null,
        rootMargin: "150px 0px",
        threshold: 0.01,
      },
    );

    observer.observe(waveformEl);
  });

  onDestroy(() => {
    observer?.disconnect();
    observer = null;
    wavesurfer?.destroy();
    wavesurfer = null;
  });
</script>

<div class="assetlib-audio-preview">
  <div
    bind:this={waveformEl}
    class="assetlib-audio-wave"
    aria-label={`Waveform for ${title}`}
  ></div>

  <div class="assetlib-audio-controls">
    <button
      type="button"
      class="assetlib-audio-toggle"
      onclick={togglePlayback}
      disabled={!isReady}
    >
      {isPlaying ? "Pause" : "Play"}
    </button>
    <p class="assetlib-audio-time">
      {formatTime(currentTime)} / {formatTime(duration)}
    </p>
  </div>

  {#if isLoading}
    <p class="assetlib-audio-time">Loading waveform...</p>
  {/if}

  {#if hasError}
    <p class="assetlib-audio-error">Unable to load audio preview.</p>
  {/if}
</div>

<style>
  .assetlib-audio-preview {
    display: flex;
    flex-direction: column;
    width: 100%;
    gap: 0.75rem;
    padding: 0.75rem;
  }

  .assetlib-audio-wave {
    width: 100%;
    height: clamp(6rem, 35%, 7.5rem);
    background: var(--canvas-bg);
    overflow: hidden;
  }

  .assetlib-audio-controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    min-height: 2.25rem;
  }

  .assetlib-audio-toggle {
    min-width: 5.5rem;
    border: 1px solid var(--borderHoverColor);
    border-radius: 12px;
    background: color-mix(in oklab, var(--backgroundLight), black 8%);
    color: var(--text-main);
    font-weight: 600;
    padding: 0.45rem 0.85rem;
    cursor: pointer;
  }

  .assetlib-audio-toggle:disabled {
    opacity: 0.6;
    cursor: wait;
  }

  .assetlib-audio-time {
    margin: 0;
    font-size: 0.84rem;
    color: var(--text-dim);
    font-variant-numeric: tabular-nums;
  }

  .assetlib-audio-error {
    margin: 0;
    font-size: 0.8rem;
    color: #f6b8b8;
  }
</style>
