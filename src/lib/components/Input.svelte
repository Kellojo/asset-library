<script lang="ts">
  import type { HTMLInputTypeAttribute } from "svelte/elements";

  let {
    value = $bindable(""),
    type = "text",
    placeholder = "",
    minlength,
    maxlength,
  }: {
    value?: string;
    type?: HTMLInputTypeAttribute;
    placeholder?: string;
    minlength?: number;
    maxlength?: number;
  } = $props();
</script>

<div class="assetlib-tag-input-wrap">
  <input bind:value {type} {placeholder} {minlength} {maxlength} />
</div>
