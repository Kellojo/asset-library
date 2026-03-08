<script lang="ts">
  type SelectOption = {
    value: string;
    label: string;
  };

  let {
    value = $bindable(""),
    label = "",
    options = [],
    disabled = false,
    minWidth = "13rem",
  }: {
    value?: string;
    label?: string;
    options?: readonly SelectOption[];
    disabled?: boolean;
    minWidth?: string;
  } = $props();
</script>

<label class="select-field" style={`--select-min-width: ${minWidth};`}>
  {#if label}
    <span>{label}</span>
  {/if}
  <div class="select-wrap">
    <select bind:value {disabled}>
      {#each options as option}
        <option value={option.value}>{option.label}</option>
      {/each}
    </select>
  </div>
</label>

<style>
  .select-field {
    display: grid;
    gap: 0.35rem;
    justify-items: start;
  }

  span {
    font-size: 0.8rem;
    color: var(--app-text-muted);
    letter-spacing: 0.03em;
  }

  .select-wrap {
    width: 100%;
    position: relative;
  }

  .select-wrap::after {
    content: "";
    position: absolute;
    right: 0.72rem;
    top: 50%;
    width: 0.52rem;
    height: 0.52rem;
    border-right: 2px solid var(--app-text-muted);
    border-bottom: 2px solid var(--app-text-muted);
    transform: translateY(-58%) rotate(45deg);
    pointer-events: none;
  }

  select {
    width: 100%;
    min-width: var(--select-min-width, 13rem);
    border: 1px solid var(--border-2);
    border-radius: 10px;
    background: var(--surface-2);
    color: var(--app-text);
    font: inherit;
    line-height: 1.2;
    padding: 0.5rem 2rem 0.5rem 0.75rem;
    appearance: none;
    -webkit-appearance: none;
    -moz-appearance: none;
  }

  select:focus {
    outline: 2px solid color-mix(in hsl, var(--accent) 45%, transparent 55%);
    outline-offset: 1px;
  }

  @media (max-width: 900px) {
    select {
      min-width: 0;
    }
  }
</style>
