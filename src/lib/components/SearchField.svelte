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

<div class="assetlib-tag-input-wrap">
  <input type="search" bind:value {placeholder} {onkeydown} />
</div>
