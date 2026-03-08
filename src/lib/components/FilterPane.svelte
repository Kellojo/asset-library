<script lang="ts">
  import Icon from "@iconify/svelte";
  import { slide } from "svelte/transition";
  import type { AssetCategory } from "$lib/types";
  import Button from "$lib/components/Button.svelte";
  import SearchField from "$lib/components/SearchField.svelte";

  type CategoryRow = {
    category: AssetCategory;
    count: number;
  };

  type TagRow = {
    tag: string;
    count: number;
    selected: boolean;
  };

  type LicenseRow = {
    license: string;
    count: number;
    selected: boolean;
  };

  let {
    showTodoOnly = $bindable(false),
    todoCount,
    categoryCounts,
    selectedCategories,
    categoryIconByType,
    formatCategoryLabel,
    toggleCategory,
    clearAllFilters,
    selectedFilterTags,
    selectedFilterLicenses,
    filteredTagRows,
    toggleFilterTag,
    filterTagQuery = $bindable(""),
    onFilterTagQueryKeyDown,
    filteredLicenseRows,
    toggleFilterLicense,
    filterLicenseQuery = $bindable(""),
    onFilterLicenseQueryKeyDown,
  }: {
    showTodoOnly?: boolean;
    todoCount: number;
    categoryCounts: CategoryRow[];
    selectedCategories: AssetCategory[];
    categoryIconByType: Record<AssetCategory, string>;
    formatCategoryLabel: (category: AssetCategory) => string;
    toggleCategory: (category: AssetCategory) => void;
    clearAllFilters: () => void;
    selectedFilterTags: string[];
    selectedFilterLicenses: string[];
    filteredTagRows: TagRow[];
    toggleFilterTag: (tag: string) => void;
    filterTagQuery?: string;
    onFilterTagQueryKeyDown: (event: KeyboardEvent) => void;
    filteredLicenseRows: LicenseRow[];
    toggleFilterLicense: (license: string) => void;
    filterLicenseQuery?: string;
    onFilterLicenseQueryKeyDown: (event: KeyboardEvent) => void;
  } = $props();

  const hasActiveFilters = $derived(
    selectedFilterTags.length > 0 ||
      selectedFilterLicenses.length > 0 ||
      selectedCategories.length > 0 ||
      showTodoOnly,
  );

  let statusOpen = $state(true);
  let categoryOpen = $state(true);
  let tagsOpen = $state(true);
  let licensesOpen = $state(true);
</script>

<aside class="pane">
  <div class="head">
    <h3>Filters</h3>
    <Button onclick={clearAllFilters} disabled={!hasActiveFilters}>Clear</Button
    >
  </div>

  <div class="section">
    <button
      type="button"
      class="section-toggle"
      aria-expanded={statusOpen}
      onclick={() => {
        statusOpen = !statusOpen;
      }}
    >
      <span class="title">Status</span>
      <span class="chevron" class:is-open={statusOpen}>
        <Icon
          icon="mdi:chevron-down"
          width="1rem"
          height="1rem"
          aria-hidden="true"
        />
      </span>
    </button>

    {#if statusOpen}
      <div class="section-content" transition:slide={{ duration: 160 }}>
        <button
          type="button"
          class="item"
          class:is-selected={showTodoOnly}
          aria-pressed={showTodoOnly}
          onclick={() => {
            showTodoOnly = !showTodoOnly;
          }}
        >
          <span class="label">
            <Icon
              icon="mdi:checkbox-marked-outline"
              width="0.9rem"
              height="0.9rem"
              aria-hidden="true"
            />
            <span>Only To Do</span>
          </span>
          <span class="count">{todoCount}</span>
        </button>
      </div>
    {/if}
  </div>

  <div class="section">
    <button
      type="button"
      class="section-toggle"
      aria-expanded={categoryOpen}
      onclick={() => {
        categoryOpen = !categoryOpen;
      }}
    >
      <span class="title">Category</span>
      <span class="chevron" class:is-open={categoryOpen}>
        <Icon
          icon="mdi:chevron-down"
          width="1rem"
          height="1rem"
          aria-hidden="true"
        />
      </span>
    </button>

    {#if categoryOpen}
      <div class="section-content" transition:slide={{ duration: 160 }}>
        <div class="list">
          {#each categoryCounts as row}
            <button
              type="button"
              class="item"
              class:is-selected={selectedCategories.includes(row.category)}
              onclick={() => toggleCategory(row.category)}
            >
              <span class="label">
                <Icon
                  icon={categoryIconByType[row.category]}
                  width="0.9rem"
                  height="0.9rem"
                  aria-hidden="true"
                />
                <span>{formatCategoryLabel(row.category)}</span>
              </span>
              <span class="count">{row.count}</span>
            </button>
          {/each}
        </div>
      </div>
    {/if}
  </div>

  <div class="section">
    <button
      type="button"
      class="section-toggle"
      aria-expanded={tagsOpen}
      onclick={() => {
        tagsOpen = !tagsOpen;
      }}
    >
      <span class="title">Tags</span>
      <span class="chevron" class:is-open={tagsOpen}>
        <Icon
          icon="mdi:chevron-down"
          width="1rem"
          height="1rem"
          aria-hidden="true"
        />
      </span>
    </button>

    {#if tagsOpen}
      <div class="section-content" transition:slide={{ duration: 160 }}>
        <SearchField
          bind:value={filterTagQuery}
          placeholder="Filter tags"
          onkeydown={onFilterTagQueryKeyDown}
        />
        <div class="list list-scroll">
          {#each filteredTagRows as row}
            <button
              type="button"
              class="item"
              class:is-selected={row.selected}
              onclick={() => toggleFilterTag(row.tag)}
            >
              <span>{row.tag}</span>
              <span class="count">{row.count}</span>
            </button>
          {/each}
        </div>
      </div>
    {/if}
  </div>

  <div class="section">
    <button
      type="button"
      class="section-toggle"
      aria-expanded={licensesOpen}
      onclick={() => {
        licensesOpen = !licensesOpen;
      }}
    >
      <span class="title">Licenses</span>
      <span class="chevron" class:is-open={licensesOpen}>
        <Icon
          icon="mdi:chevron-down"
          width="1rem"
          height="1rem"
          aria-hidden="true"
        />
      </span>
    </button>

    {#if licensesOpen}
      <div class="section-content" transition:slide={{ duration: 160 }}>
        <SearchField
          bind:value={filterLicenseQuery}
          placeholder="Filter licenses"
          onkeydown={onFilterLicenseQueryKeyDown}
        />
        <div class="list list-scroll">
          {#each filteredLicenseRows as row}
            <button
              type="button"
              class="item"
              class:is-selected={row.selected}
              onclick={() => toggleFilterLicense(row.license)}
            >
              <span>{row.license}</span>
              <span class="count">{row.count}</span>
            </button>
          {/each}
        </div>
      </div>
    {/if}
  </div>
</aside>

<style>
  .pane {
    border: 1px solid var(--borderColor);
    background: var(--background);
    border-radius: 12px;
    padding: 0.75rem;
    display: grid;
    gap: 1.5rem;
    position: sticky;
    top: 0.65rem;
    max-height: calc(100dvh - 2.65rem);
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-width: none;
    --scrollbar-thumb: color-mix(
      in hsl,
      var(--app-text-muted) 55%,
      transparent 45%
    );
    --scrollbar-track: transparent;
  }

  :global(:root[data-theme="light"]) .pane {
    --scrollbar-track: hsl(0 0% 100% / 0.35);
  }

  .pane::-webkit-scrollbar {
    width: 0;
    height: 0;
  }

  .pane:hover,
  .pane:focus-within {
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
  }

  .pane:hover::-webkit-scrollbar,
  .pane:focus-within::-webkit-scrollbar {
    width: 0.55rem;
    height: 0.55rem;
  }

  .pane:hover::-webkit-scrollbar-thumb,
  .pane:focus-within::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb);
    border-radius: 999px;
  }

  .pane:hover::-webkit-scrollbar-track,
  .pane:focus-within::-webkit-scrollbar-track {
    background: var(--scrollbar-track);
    border-radius: 999px;
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.45rem;
  }

  .head h3 {
    margin: 0;
    font-size: 1rem;
  }

  .section {
    display: grid;
    gap: 0.5rem;
  }

  .title {
    font-size: 0.875rem;
    color: var(--app-text-muted);
    letter-spacing: 0.04em;
  }

  .section-toggle {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border: 0;
    background: transparent;
    padding: 0;
    cursor: pointer;
  }

  .chevron {
    display: inline-flex;
    align-items: center;
    color: var(--app-text-muted);
    transition: transform 140ms ease;
  }

  .chevron.is-open {
    transform: rotate(180deg);
  }

  .list {
    display: grid;
    gap: 0.5rem;
  }

  .section-content {
    display: grid;
    gap: 0.5rem;
    overflow: hidden;
  }

  .list-scroll {
    max-height: none;
    overflow: visible;
    padding-right: 0;
  }

  .item {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.45rem;
    border: 1px solid var(--borderHoverColor);
    background: var(--backgroundLight);
    color: var(--app-text);
    border-radius: 9px;
    padding: 0.5rem;
    cursor: pointer;
    text-transform: none;
    font-size: 0.875rem;
  }

  .label {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }

  .item:hover {
    border-color: var(--accent);
  }

  .item.is-selected {
    border-color: var(--accent-strong);
    background: color-mix(
      in hsl,
      var(--backgroundLight) 65%,
      var(--accent) 35%
    );
  }

  .count {
    min-width: 1.65rem;
    text-align: center;
    border-radius: 999px;
    border: 1px solid var(--borderHoverColor);
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
  }

  @media (max-width: 900px) {
    .pane {
      position: static;
      max-height: none;
      overflow: visible;
    }
  }
</style>
