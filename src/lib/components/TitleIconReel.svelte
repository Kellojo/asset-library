<script lang="ts">
  import Icon from "@iconify/svelte";
  import type { AssetCategory } from "$lib/types";

  export let categories: AssetCategory[] = [];
  export let iconByCategory: Record<AssetCategory, string>;
</script>

<div class="assetlib-title-icon-reel" aria-hidden="true">
  <div class="assetlib-title-icon-track">
    {#each categories as category}
      <span class="assetlib-title-icon-cell">
        <Icon
          icon={iconByCategory[category]}
          width="1.15rem"
          height="1.15rem"
        />
      </span>
    {/each}
    {#if categories.length > 0}
      <span class="assetlib-title-icon-cell">
        <Icon
          icon={iconByCategory[categories[0]]}
          width="1.15rem"
          height="1.15rem"
        />
      </span>
    {/if}
  </div>
</div>

<style>
  .assetlib-title-icon-reel {
    position: relative;
    width: 1.7rem;
    height: 1.7rem;
    overflow: hidden;
  }

  .assetlib-title-icon-reel::before,
  .assetlib-title-icon-reel::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    height: 0.38rem;
    pointer-events: none;
    z-index: 1;
  }

  .assetlib-title-icon-reel::before {
    top: 0;
    background: linear-gradient(
      180deg,
      color-mix(in oklab, var(--backgroundLight), transparent 12%) 0%,
      transparent 100%
    );
  }

  .assetlib-title-icon-reel::after {
    bottom: 0;
    background: linear-gradient(
      0deg,
      color-mix(in oklab, var(--backgroundLight), transparent 12%) 0%,
      transparent 100%
    );
  }

  .assetlib-title-icon-track {
    display: grid;
    grid-auto-rows: 1.7rem;
    animation: assetlib-title-icon-scroll 8.4s linear infinite;
    will-change: transform;
  }

  .assetlib-title-icon-cell {
    width: 1.7rem;
    height: 1.7rem;
    display: grid;
    place-items: center;
    color: var(--app-text);
  }

  @keyframes assetlib-title-icon-scroll {
    0%,
    11% {
      transform: translate3d(0rem, 0rem, 0);
    }

    13%,
    24% {
      transform: translate3d(0.07rem, -1.7rem, 0);
    }

    26%,
    37% {
      transform: translate3d(-0.08rem, -3.4rem, 0);
    }

    39%,
    50% {
      transform: translate3d(0.06rem, -5.1rem, 0);
    }

    52%,
    63% {
      transform: translate3d(-0.07rem, -6.8rem, 0);
    }

    65%,
    76% {
      transform: translate3d(0.08rem, -8.5rem, 0);
    }

    78%,
    100% {
      transform: translate3d(0rem, -10.2rem, 0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .assetlib-title-icon-track {
      animation: none;
    }
  }
</style>
