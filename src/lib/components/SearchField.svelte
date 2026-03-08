<script lang="ts">
  let {
    value = $bindable(""),
    placeholder = "",
    onkeydown,
  }: {
    value?: string;
    placeholder?: string;
    onkeydown?: (event: KeyboardEvent) => void;
  } = $props();
</script>

<div class="search-field">
  <input type="search" bind:value {placeholder} {onkeydown} />
</div>

<style>
  .search-field {
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

  input::-webkit-search-decoration,
  input::-webkit-search-cancel-button,
  input::-webkit-search-results-button,
  input::-webkit-search-results-decoration {
    -webkit-appearance: none;
  }
</style>
