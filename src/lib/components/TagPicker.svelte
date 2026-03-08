<script lang="ts">
  let {
    values = $bindable([] as string[]),
    allOptions = [],
    emptyPlaceholder = "Add values",
    filledPlaceholder = "Add another value",
    dropdownAriaLabel = "Suggestions",
    optionPrefix = "",
    onValuesChange,
  }: {
    values?: string[];
    allOptions?: readonly string[];
    emptyPlaceholder?: string;
    filledPlaceholder?: string;
    dropdownAriaLabel?: string;
    optionPrefix?: string;
    onValuesChange?: (nextValues: string[]) => void;
  } = $props();

  let query = $state("");
  let dropdownOpen = $state(false);
  let rootEl: HTMLDivElement | null = null;
  let inputEl: HTMLInputElement | null = null;

  const normalizedQuery = $derived(query.trim().toLowerCase());
  const availableOptions = $derived(
    allOptions.filter(
      (option) =>
        !values.some(
          (selected) => selected.toLowerCase() === option.toLowerCase(),
        ) &&
        (!normalizedQuery || option.toLowerCase().includes(normalizedQuery)),
    ),
  );
  const canCreate = $derived(
    query.trim().length > 0 &&
      !values.some(
        (selected) => selected.toLowerCase() === query.trim().toLowerCase(),
      ) &&
      !allOptions.some(
        (option) => option.toLowerCase() === query.trim().toLowerCase(),
      ),
  );

  function updateValues(nextValues: string[]): void {
    values = nextValues;
    onValuesChange?.(nextValues);
  }

  function addValue(rawValue: string): void {
    const value = rawValue.trim();
    if (!value) return;

    const exists = values.some(
      (current) => current.toLowerCase() === value.toLowerCase(),
    );
    if (!exists) {
      updateValues([...values, value]);
    }

    query = "";
    dropdownOpen = false;
  }

  function removeValue(valueToRemove: string): void {
    const index = values.findIndex(
      (value) => value.toLowerCase() === valueToRemove.toLowerCase(),
    );
    if (index === -1) return;

    updateValues([...values.slice(0, index), ...values.slice(index + 1)]);
  }

  function onQueryKeyDown(event: KeyboardEvent): void {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      const candidate = query.trim() || availableOptions[0] || "";
      if (candidate) addValue(candidate);
      return;
    }

    if (event.key === "Backspace" && !query && values.length > 0) {
      event.preventDefault();
      updateValues(values.slice(0, -1));
      return;
    }

    if (event.key === "Escape") {
      dropdownOpen = false;
    }
  }

  function onFocusOut(): void {
    // Defer so the next focused element is available for containment checks.
    globalThis.setTimeout(() => {
      const active = document.activeElement;
      if (!(active instanceof Node) || !rootEl?.contains(active)) {
        dropdownOpen = false;
      }
    }, 0);
  }

  function onInputBlur(): void {
    const active = document.activeElement;
    if (!(active instanceof Node) || !rootEl?.contains(active)) {
      dropdownOpen = false;
    }
  }

  function onInputWrapPointerDown(event: PointerEvent): void {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest(".chip")) return;

    dropdownOpen = true;
    inputEl?.focus();
  }
</script>

<div class="picker" bind:this={rootEl} onfocusout={onFocusOut}>
  <div
    class="input-wrap"
    role="group"
    aria-label={dropdownAriaLabel}
    onpointerdown={onInputWrapPointerDown}
  >
    {#each values as value}
      <span class="chip">
        {value}
        <button
          type="button"
          class="chip-remove"
          onmousedown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onclick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            removeValue(value);
          }}
          aria-label={`Remove ${value}`}
        >
          x
        </button>
      </span>
    {/each}

    <input
      bind:this={inputEl}
      bind:value={query}
      placeholder={values.length ? filledPlaceholder : emptyPlaceholder}
      onfocus={() => {
        dropdownOpen = true;
      }}
      oninput={() => {
        dropdownOpen = true;
      }}
      onblur={onInputBlur}
      onkeydown={onQueryKeyDown}
    />
  </div>

  {#if dropdownOpen && (availableOptions.length > 0 || canCreate)}
    <div class="dropdown" role="listbox" aria-label={dropdownAriaLabel}>
      {#if canCreate}
        <button
          type="button"
          class="option option-create"
          onmousedown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            addValue(query);
          }}
        >
          Create "{query.trim()}"
        </button>
      {/if}

      {#each availableOptions as option}
        <button
          type="button"
          class="option"
          onmousedown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            addValue(option);
          }}
        >
          {optionPrefix}{option}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .picker {
    position: relative;
  }

  .input-wrap {
    width: 100%;
    min-height: 2.3rem;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25rem;
    border-radius: 10px;
    border: 1px solid var(--border-2);
    padding: 0.5rem;
    background: var(--surface-inset);
  }

  input {
    border: none;
    outline: none;
    background: transparent;
    color: var(--app-text);
    padding: 0.25rem;
    min-width: 7rem;
    flex: 1;
    font: inherit;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    border-radius: 999px;
    background: var(--surface-2);
    border: 1px solid var(--border-2);
    color: var(--app-text);
    padding: 0.25rem 0.5rem;
    font-size: 0.875rem;
  }

  .chip-remove {
    border: none;
    background: transparent;
    color: var(--app-text);
    cursor: pointer;
    padding: 0;
    line-height: 1;
    font-size: 0.875rem;
  }

  .dropdown {
    position: absolute;
    left: 0;
    right: 0;
    top: calc(100% + 0.25rem);
    display: grid;
    gap: 0.25rem;
    border-radius: 10px;
    border: 1px solid var(--border-2);
    background: var(--backgroundLightOpaque);
    padding: 0.5rem;
    max-height: 180px;
    overflow: auto;
    z-index: 85;
  }

  .option {
    border: 1px solid transparent;
    background: transparent;
    color: var(--app-text);
    text-align: left;
    border-radius: 8px;
    padding: 0.5rem;
    cursor: pointer;
    font-size: 0.875rem;
  }

  .option:hover {
    background: var(--surface-inset);
    border-color: var(--border-2);
  }

  .option-create {
    color: var(--warning);
    border-color: var(--warning);
    background: var(--warningSecondary);
  }
</style>
