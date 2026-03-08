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
  class="backdrop"
  class:is-closing={isClosing}
  aria-hidden="true"
  onclick={requestClose}
></div>

<dialog
  bind:this={dialogEl}
  class="panel assetlib-glass"
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
    <div class="actions">
      {@render actions()}
    </div>
  {/if}
</dialog>

<style>
  .panel {
    width: min(420px, calc(100% - 2rem));
    max-width: 420px;
    max-height: calc(100dvh - 2rem);
    overflow: visible;
    padding: 1rem;
    display: grid;
    gap: 0.75rem;
    margin: 0;
    position: fixed;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    z-index: var(--z-modal);
    opacity: 0;
    animation: dialog-open 160ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
  }

  .backdrop {
    position: fixed;
    inset: 0;
    z-index: var(--z-modal-backdrop);
    background: hsl(0 0% 0% / 0.62);
    backdrop-filter: blur(2px);
    animation: backdrop-open 160ms ease forwards;
  }

  .backdrop.is-closing {
    animation: backdrop-close 140ms ease forwards;
  }

  .panel.is-closing {
    pointer-events: none;
    animation: dialog-close 140ms ease forwards;
  }

  .panel h2 {
    margin: 0;
    font-size: 1.5rem;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }

  @keyframes dialog-open {
    from {
      opacity: 0;
      transform: translate(-50%, -48%) scale(0.985);
    }
    to {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1);
    }
  }

  @keyframes dialog-close {
    from {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1);
    }
    to {
      opacity: 0;
      transform: translate(-50%, -48%) scale(0.985);
    }
  }

  @keyframes backdrop-open {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes backdrop-close {
    from {
      opacity: 1;
    }
    to {
      opacity: 0;
    }
  }
</style>
