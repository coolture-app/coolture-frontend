import { DestroyRef, DOCUMENT, inject } from '@angular/core';

export interface BackClosableOptions {
  /** Shows in the address bar while the overlay is open. */
  url?: string;
  /** The page stays usable beside the overlay, so it isn't locked and may scroll while open. */
  pageStaysLive?: boolean;
}

/** An overlay's side of the browser's history, so that Back closes it and the page stays put. */
export interface BackClosable {
  readonly isOpen: () => boolean;
  /** Adds the overlay's history entry. */
  opened: (options?: BackClosableOptions) => void;
  /** Changes the address while open, in the same entry, so it still takes one Back to close. */
  showUrl: (url: string) => void;
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
  let live = false;
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
    // A live page may have moved since the overlay opened, and this is before the router's scroll.
    const y = live ? (view?.scrollY ?? 0) : pageY;
    setTimeout(() =>
      requestAnimationFrame(() =>
        setTimeout(() => {
          view?.scrollTo({ top: y, behavior: 'instant' });
          finish();
        }),
      ),
    );
  };

  view?.addEventListener('popstate', onPop);
  inject(DestroyRef).onDestroy(() => view?.removeEventListener('popstate', onPop));

  return {
    isOpen: () => open,
    opened: ({ url, pageStaysLive = false } = {}) => {
      open = true;
      leaving = false;
      live = pageStaysLive;
      pageY = view?.scrollY ?? 0;
      returnFocus = document.activeElement as HTMLElement | null;
      // The same router state, so Back only leaves this entry and stays on the page.
      view?.history.pushState({ ...view.history.state, [key]: true }, '', url);
      if (!live) {
        document.documentElement.style.overflow = 'hidden';
      }
    },
    showUrl: (url) => view?.history.replaceState(view.history.state, '', url),
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
