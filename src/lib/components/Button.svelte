<script lang="ts">
  import type { Snippet } from "svelte";

  type ButtonVariant = "standard" | "delete" | "emphasized";

  const variantClassByType: Record<ButtonVariant, string> = {
    standard: "assetlib-btn-standard",
    delete: "assetlib-btn-delete",
    emphasized: "assetlib-btn-emphasized",
  };

  let {
    children,
    variant = "standard",
    type = "button",
    disabled = false,
    href = undefined,
    extraClass = "",
    title = undefined,
    ariaLabel = undefined,
    iconOnly = false,
    onclick,
  }: {
    children?: Snippet;
    variant?: ButtonVariant;
    type?: "button" | "submit" | "reset";
    disabled?: boolean;
    href?: string;
    extraClass?: string;
    title?: string;
    ariaLabel?: string;
    iconOnly?: boolean;
    onclick?: (event: MouseEvent) => void;
  } = $props();
</script>

{#if href}
  <a
    class={`assetlib-btn ${variantClassByType[variant]} ${extraClass}`.trim()}
    class:icon-only={iconOnly}
    {href}
    {title}
    aria-label={ariaLabel}
    {onclick}
  >
    {@render children?.()}
  </a>
{:else}
  <button
    {type}
    class={`assetlib-btn ${variantClassByType[variant]} ${extraClass}`.trim()}
    class:icon-only={iconOnly}
    {disabled}
    {title}
    aria-label={ariaLabel}
    {onclick}
  >
    {@render children?.()}
  </button>
{/if}

<style>
  .assetlib-btn {
    padding: 0.5rem 0.75rem;
    border-radius: 9px;
    border: 1px solid transparent;
    font-weight: 600;
    font-size: 0.875rem;
    cursor: pointer;
    background: transparent;
    color: var(--app-text);
    text-decoration: none;
    text-align: center;

    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .assetlib-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .icon-only {
    width: 2rem;
    min-width: 2rem;
    height: 2rem;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .assetlib-btn-standard {
    background: var(--backgroundLight);
    color: var(--app-text);
    border: 1px solid var(--borderColor);
  }

  .assetlib-btn-delete {
    background: var(--error);
    color: var(--primaryText);
    border: 1px solid var(--errorSecondary);
  }

  .assetlib-btn-delete:hover:not(:disabled) {
    filter: brightness(1.06);
  }

  .assetlib-btn-emphasized {
    background: var(--accent-strong);
    color: var(--primaryTextInverted);
  }
</style>
