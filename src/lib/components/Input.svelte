<script lang="ts">
  import type { HTMLInputTypeAttribute } from "svelte/elements";

  let {
    value = $bindable<string | number>(""),
    type = "text",
    placeholder = "",
    minlength,
    maxlength,
    min,
    max,
    step,
  }: {
    value?: string | number;
    type?: HTMLInputTypeAttribute;
    placeholder?: string;
    minlength?: number;
    maxlength?: number;
    min?: number | string;
    max?: number | string;
    step?: number | string;
  } = $props();
</script>

<div class="input-wrap">
  <input
    bind:value
    {type}
    {placeholder}
    {minlength}
    {maxlength}
    {min}
    {max}
    {step}
  />
</div>

<style>
  .input-wrap {
    width: 100%;
    min-height: 2.3rem;
    display: flex;
    align-items: center;
    border-radius: 10px;
    border: 1px solid var(--borderHoverColor);
    padding: 0.5rem;
    background: var(--surface-inset);
  }

  input {
    width: 100%;
    border: none;
    outline: none;
    background: transparent;
    color: var(--app-text);
    padding: 0.25rem;
    font: inherit;
  }
</style>
