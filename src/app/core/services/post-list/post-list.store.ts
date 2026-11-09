import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, Subscription } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { PostService } from '../post/post.service';
import { GeoPoint } from '../../models/common/geo.model';
import { PaginatedResponse } from '../../models/common/paginated-response.model';
import { cardPhotos, PostCard } from '../../models/posts/post-card.model';
import { PostDetail } from '../../models/posts/post-detail.model';
import { PostFilterParams } from '../../models/posts/post-filter-params.model';

export type PostListQuery =
  | { kind: 'feed'; location?: GeoPoint; filters?: PostFilterParams }
  | { kind: 'posts'; filters: PostFilterParams };

const PAGE_SIZE = 20;

/**
 * The home page's list, kept here so that it survives going to a post and back.
 * Paging rules are in the API contract, contracts/README.md in coolture-aws. Only `hasMore: false` ends
 * a list, and a short or empty page is normal, because scores can move between pages.
 */
@Injectable({
  providedIn: 'root',
})
export class PostListStore {
  private postService = inject(PostService);
  private authService = inject(AuthService);

  readonly query = signal<PostListQuery | null>(null);
  readonly items = signal<PostCard[]>([]);
  readonly hasMore = signal(false);
  readonly loading = signal(false);
  readonly failed = signal(false);
  readonly canLoadMore = computed(() => this.hasMore() && !this.loading() && !this.failed());

  private cursor: string | undefined;
  private seenIds = new Set<string>();
  private request: Subscription | undefined;
  private restarted = false;
  private user = '';

  constructor() {
    effect(() => {
      const user = this.authService.userId();
      untracked(() => {
        // From a known user only. Going from nobody to somebody also happens on every page load,
        // when /auth/me answers, and by then the first request has already carried the token.
        if (this.user && user !== this.user) {
          this.clear();
        }
        this.user = user;
      });
    });
  }

  /** Starts a new list. For the feed, that also means a new session: a new `asOf` and a new seed. */
  start(query: PostListQuery): void {
    this.reset();
    this.query.set(query);
    this.fetch();
  }

  refresh(): void {
    const query = this.query();
    if (query) {
      this.start(query);
    }
  }

  loadMore(): void {
    if (this.canLoadMore()) {
      this.fetch();
    }
  }

  retry(): void {
    this.restarted = false;
    this.fetch();
  }

  clear(): void {
    this.reset();
    this.query.set(null);
  }

  removeItem(id: string): void {
    this.items.update((items) => items.filter((item) => item.id !== id));
  }

  /** Brings a card up to date with what the post's own page last knew about it. */
  updateItem({ media, ...post }: PostDetail): void {
    const card: PostCard = { ...post, photos: cardPhotos(media) };
    this.items.update((items) => items.map((item) => (item.id === card.id ? card : item)));
  }

  private reset(): void {
    this.request?.unsubscribe();
    this.items.set([]);
    this.hasMore.set(false);
    this.loading.set(false);
    this.failed.set(false);
    this.cursor = undefined;
    this.seenIds = new Set();
    this.restarted = false;
  }

  private fetch(): void {
    const query = this.query();
    if (!query) {
      return;
    }
    const cursor = this.cursor;
    this.loading.set(true);
    this.failed.set(false);
    this.request?.unsubscribe();
    this.request = this.page(query, cursor).subscribe({
      next: (page) => this.accept(page, cursor),
      error: (error: HttpErrorResponse) => this.reject(error),
    });
  }

  private page(
    query: PostListQuery,
    cursor: string | undefined,
  ): Observable<PaginatedResponse<PostCard>> {
    return query.kind === 'feed'
      ? this.postService.getFeed({
          cursor,
          limit: PAGE_SIZE,
          location: query.location,
          filters: query.filters,
        })
      : this.postService.getPosts({ ...query.filters, cursor, limit: PAGE_SIZE });
  }

  /** A feed page's `mode` is for logs and evaluation only. The list treats every page the same. */
  private accept(page: PaginatedResponse<PostCard>, usedCursor?: string): void {
    const fresh = page.items.filter((item) => !this.seenIds.has(item.id));
    fresh.forEach((item) => this.seenIds.add(item.id));
    this.items.update((items) => [...items, ...fresh]);
    this.hasMore.set(page.page.hasMore);
    this.cursor = page.page.nextCursor;

    if (fresh.length > 0 || !page.page.hasMore) {
      this.loading.set(false);
      return;
    }
    // The scroll observer won't fire again for a page that added nothing, so go on from here,
    // unless the API isn't moving forward, which would otherwise loop for ever.
    if (this.cursor && this.cursor !== usedCursor) {
      this.fetch();
    } else {
      this.fail();
    }
  }

  private reject(error: HttpErrorResponse): void {
    // A cursor can stop being readable, for example after a deploy. Restarting keeps what's shown, and
    // dedupe drops what comes back. Only once, so that an API that keeps refusing can't cause a loop.
    if (error.status === 400 && !this.restarted) {
      this.restarted = true;
      this.cursor = undefined;
      this.fetch();
      return;
    }
    this.fail();
  }

  private fail(): void {
    this.loading.set(false);
    this.failed.set(true);
  }
}
