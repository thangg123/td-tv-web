/**
 * The one confirmation overlay. Every irreversible action in the app routes
 * through it, so "delete" means the same thing on every page.
 *
 * It stays mounted while closed and renders nothing: focus restoration has to
 * observe the open → closed transition, which an unmount would swallow.
 */

import { useEffect, useId, useRef } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, ReactElement, RefObject } from 'react';
import Button from '@/components/ui/Button';

const FOCUSABLE =
  'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel: string;
  tone?: 'danger' | 'default';
  onConfirm: () => void;
  onDismiss: () => void;
  /** Where focus lands when the trigger is gone — confirming often unmounts it. */
  fallbackFocusRef?: RefObject<HTMLElement | null>;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  tone = 'default',
  onConfirm,
  onDismiss,
  fallbackFocusRef,
}: ConfirmDialogProps): ReactElement | null {
  const titleId = useId();
  const messageId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  /*
   * The trigger is read from the document rather than passed in, because the
   * callers only learn *which* row was pressed, never which element. Capturing
   * has to happen before focus moves, which is why the cancel button is focused
   * here instead of through `autoFocus` — that fires during the same commit and
   * would leave `activeElement` pointing at the dialog.
   *
   * Restoration deliberately waits for the closing commit: confirming a delete
   * unmounts the trigger, and `isConnected` only tells the truth once the DOM
   * has caught up.
   */
  useEffect(() => {
    if (open) {
      triggerRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
      return;
    }
    const trigger = triggerRef.current;
    if (!trigger) return;
    triggerRef.current = null;
    if (trigger.isConnected) trigger.focus();
    else fallbackFocusRef?.current?.focus();
  }, [open, fallbackFocusRef]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      /*
       * `stopImmediatePropagation`, not `stopPropagation`: the header drawer
       * binds its own Escape handler to this same `document`, and
       * stopPropagation does nothing about listeners already attached to the
       * target the event is currently at. One press must close the topmost
       * overlay only.
       */
      event.stopImmediatePropagation();
      onDismiss();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onDismiss]);

  // Without this, Tab walks straight out of a modal into the page behind it.
  const confineTab = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return;
    const panel = panelRef.current;
    if (!panel) return;
    const focusable = panel.querySelectorAll<HTMLElement>(FOCUSABLE);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    const edge = event.shiftKey ? first : last;
    if (document.activeElement !== edge) return;
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  };

  if (!open) return null;

  return (
    // z-[55] clears the sticky header (z-50) and stays under the nav drawer (z-60).
    // The insets are `max(gutter, safe-area)` so the card clears a notch or a
    // home indicator without leaving a fat margin on a phone that has neither.
    <div
      className="fixed inset-0 z-[55] flex items-center justify-center px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]"
    >
      <div
        className="absolute inset-0 bg-ink-deep/80 backdrop-blur-sm"
        onClick={onDismiss}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={message ? messageId : undefined}
        onKeyDown={confineTab}
        // A long message must scroll inside the card, never push the buttons
        // off a 667px screen.
        className="relative max-h-full w-full max-w-[26rem] animate-fade-up overflow-y-auto overscroll-contain rounded-card border border-outline bg-surface-1 p-5 shadow-lift sm:p-6"
      >
        <h2 id={titleId} className="text-section font-semibold text-text-high">
          {title}
        </h2>
        {message ? (
          <p id={messageId} className="mt-2.5 text-sm leading-relaxed text-text-mid">
            {message}
          </p>
        ) : null}

        {/* Cancel comes first in the DOM so it takes the opening focus — the
            destructive action is never the default. */}
        <div className="mt-7 flex flex-wrap justify-end gap-2.5">
          <Button variant="secondary" onClick={onDismiss}>
            {cancelLabel}
          </Button>
          {tone === 'danger' ? (
            <Button variant="danger" icon="trash" onClick={onConfirm}>
              {confirmLabel}
            </Button>
          ) : (
            <Button variant="primary" onClick={onConfirm}>
              {confirmLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
