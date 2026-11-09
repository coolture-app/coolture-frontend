import { DestroyRef, DOCUMENT, inject } from '@angular/core';

/** An overlay's side of the browser's history, so that Back closes it and the page stays put. */
export interface BackClosable {
  readonly isOpen: () => boolean;
  /** Adds the overlay's history entry. A `url` shows in the address bar while it's open. */
  opened: (url?: string) => void;
  /** Goes back past that entry, and the pop then finishes closing, as the browser's Back does. */
  close: () => void;
  /** Closes at once and leaves history alone, for when the router is taking the user elsewhere. */
  abandon: () => void;
}

/**
 * Call from an injection context. The router takes the return from the overlay's entry for a skipped
 * navigation and scrolls to the top on its next frame, so the overlay stays over the page until that
 * has happened, puts the page's scroll back, and only then calls `closed`.
 */
export function backClosable(key: string, closed: () => void): BackClosable {
  const document = inject(DOCUMENT);
  const view = document.defaultView;
  let open = false;
  let leaving = false;
  let pageY = 0;
  let returnFocus: HTMLElement | null = null;

  const finish = (): void => {
    open = false;
    leaving = false;
    closed();
    document.documentElement.style.overflow = '';
    returnFocus?.focus({ preventScroll: true });
    returnFocus = null;
  };

  const onPop = (): void => {
    if (!open || leaving) {
      return;
    }
    leaving = true;
    setTimeout(() =>
      requestAnimationFrame(() =>
        setTimeout(() => {
          view?.scrollTo({ top: pageY, behavior: 'instant' });
          finish();
        }),
      ),
    );
  };

  view?.addEventListener('popstate', onPop);
  inject(DestroyRef).onDestroy(() => view?.removeEventListener('popstate', onPop));

  return {
    isOpen: () => open,
    opened: (url) => {
      open = true;
      leaving = false;
      pageY = view?.scrollY ?? 0;
      returnFocus = document.activeElement as HTMLElement | null;
      // The same router state, so Back only leaves this entry and stays on the page.
      view?.history.pushState({ ...view.history.state, [key]: true }, '', url);
      document.documentElement.style.overflow = 'hidden';
    },
    close: () => {
      if (view?.history.state?.[key]) {
        view.history.back();
      } else {
        finish();
      }
    },
    abandon: () => {
      if (open) {
        returnFocus = null;
        finish();
      }
    },
  };
}
