import {
  DestroyRef,
  effect,
  inject,
  signal,
  Signal,
  untracked,
  WritableSignal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, EMPTY, Observable, Subject, switchMap, tap } from 'rxjs';
import { PaginatedResponse } from '../models/common/paginated-response.model';

const PAGE = 20;
const SEARCH_DELAY_MS = 300;

export interface PageRequest {
  /** The search's words, trimmed; undefined when empty. */
  q?: string;
  cursor?: string;
  limit: number;
}

export interface SearchedPagesOptions<T> {
  /** Which list is shown, as one value: a change loads it afresh. */
  list: () => unknown;
  /** What the search belongs to: a change empties it. The list itself when left out. */
  searchScope?: () => unknown;
  fetch: (request: PageRequest) => Observable<PaginatedResponse<T>>;
}

export interface SearchedPages<T> {
  /** Writable, so a row can leave without a reload. */
  readonly items: WritableSignal<T[]>;
  /** The search as typed, before its pause. */
  readonly typed: Signal<string>;
  readonly loading: Signal<boolean>;
  readonly failed: Signal<boolean>;
  readonly hasMore: Signal<boolean>;
  search: (text: string) => void;
  clearSearch: () => void;
  loadMore: () => void;
  retry: () => void;
}

/**
 * A list read page by page, with a search that waits for a pause in typing. A newer list or search replaces the
 * request in flight, so an answer for one that changed since never shows. Call in a constructor or field.
 */
export function searchedPages<T>(options: SearchedPagesOptions<T>): SearchedPages<T> {
  const destroyRef = inject(DestroyRef);
  const typed = signal('');
  const q = signal('');
  const items = signal<T[]>([]);
  const loading = signal(false);
  const failed = signal(false);
  const hasMore = signal(false);
  let cursor: string | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const loads = new Subject<boolean>();
  loads
    .pipe(
      switchMap((fresh) => {
        if (fresh) {
          items.set([]);
          cursor = undefined;
          hasMore.set(false);
        }
        loading.set(true);
        failed.set(false);
        return options.fetch({ q: q() || undefined, cursor, limit: PAGE }).pipe(
          tap({
            next: (page) => {
              items.update((shown) => [...shown, ...page.items]);
              cursor = page.page.nextCursor;
              hasMore.set(page.page.hasMore);
              loading.set(false);
            },
            error: (err) => {
              console.error('Error loading a list', err);
              failed.set(true);
              loading.set(false);
            },
          }),
          catchError(() => EMPTY),
        );
      }),
      takeUntilDestroyed(destroyRef),
    )
    .subscribe();

  const clearSearch = (): void => {
    clearTimeout(timer);
    typed.set('');
    q.set('');
  };

  effect(() => {
    (options.searchScope ?? options.list)();
    untracked(clearSearch);
  });
  effect(() => {
    options.list();
    q();
    untracked(() => loads.next(true));
  });
  destroyRef.onDestroy(() => clearTimeout(timer));

  return {
    items,
    typed: typed.asReadonly(),
    loading: loading.asReadonly(),
    failed: failed.asReadonly(),
    hasMore: hasMore.asReadonly(),
    search: (text) => {
      typed.set(text);
      clearTimeout(timer);
      timer = setTimeout(() => q.set(text.trim()), SEARCH_DELAY_MS);
    },
    clearSearch,
    loadMore: () => {
      if (hasMore() && !loading()) {
        loads.next(false);
      }
    },
    retry: () => loads.next(items().length === 0),
  };
}
