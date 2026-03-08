<script lang="ts">
  import type { Snippet } from "svelte";

  const DIALOG_CLOSE_ANIMATION_MS = 160;

  let {
    ariaLabel,
    title = "",
    onClose,
    children,
    actions,
  }: {
    ariaLabel: string;
    title?: string;
    onClose?: () => void;
    children?: Snippet;
    actions?: Snippet;
  } = $props();

  let dialogEl: HTMLDialogElement | null = null;
  let isClosing = $state(false);

  function openAsModal(dialog: HTMLDialogElement): { destroy: () => void } {
    isClosing = false;
    if (!dialog.open) {
      dialog.show();
    }

    return {
      destroy: () => {
        if (dialog.open) {
          dialog.close();
        }
      },
    };
  }

  export function requestClose(): void {
    if (!dialogEl || !dialogEl.open) {
      onClose?.();
      return;
    }

    if (isClosing) {
      return;
    }

    isClosing = true;
    globalThis.setTimeout(() => {
      isClosing = false;
      if (dialogEl?.open) {
        dialogEl.close();
      }
      onClose?.();
    }, DIALOG_CLOSE_ANIMATION_MS);
  }

  function onDialogCancel(event: Event): void {
    event.preventDefault();
    requestClose();
  }
</script>

<div
  class="assetlib-modal-backdrop"
  class:is-closing={isClosing}
  aria-hidden="true"
  onclick={requestClose}
></div>

<dialog
  bind:this={dialogEl}
  class="assetlib-modal assetlib-glass"
  class:is-closing={isClosing}
  use:openAsModal
  aria-label={ariaLabel}
  oncancel={onDialogCancel}
>
  {#if title}
    <h2>{title}</h2>
  {/if}
  {@render children?.()}
  {#if actions}
    <div class="assetlib-modal-actions">
      {@render actions()}
    </div>
  {/if}
</dialog>
