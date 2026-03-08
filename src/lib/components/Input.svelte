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

<div class="assetlib-tag-input-wrap">
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
