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
  let backdropPressed = false;

  function openAsModal(dialog: HTMLDialogElement): { destroy: () => void } {
    dialog.classList.remove("is-closing");
    if (!dialog.open) {
      dialog.showModal();
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

    if (dialogEl.classList.contains("is-closing")) {
      return;
    }

    dialogEl.classList.add("is-closing");
    globalThis.setTimeout(() => {
      dialogEl?.classList.remove("is-closing");
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

  function onDialogMouseDown(event: MouseEvent): void {
    backdropPressed = event.target === event.currentTarget;
  }

  function onDialogClick(event: MouseEvent): void {
    const clickedBackdrop = event.target === event.currentTarget;
    if (clickedBackdrop && backdropPressed) {
      requestClose();
    }
    backdropPressed = false;
  }
</script>

<dialog
  bind:this={dialogEl}
  class="assetlib-modal assetlib-glass"
  use:openAsModal
  aria-label={ariaLabel}
  oncancel={onDialogCancel}
  onmousedown={onDialogMouseDown}
  onclick={onDialogClick}
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
