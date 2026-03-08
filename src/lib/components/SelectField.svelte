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
  <select bind:value {disabled}>
    {#each options as option}
      <option value={option.value}>{option.label}</option>
    {/each}
  </select>
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

  select {
    width: 100%;
    min-width: var(--select-min-width, 13rem);
    border: 1px solid var(--border-2);
    border-radius: 10px;
    background: var(--surface-2);
    color: var(--app-text);
    font: inherit;
    line-height: 1.2;
    padding: 0.53rem 0.7rem;
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
