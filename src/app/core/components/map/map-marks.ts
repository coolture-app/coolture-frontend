import { inject, Injectable, signal } from '@angular/core';
import { catchError, map, of, Subject, switchMap, tap } from 'rxjs';
import { PostService } from '../../services/post/post.service';
import { PostFilterParams } from '../../models/posts/post-filter-params.model';
import { PostMark } from '../../models/posts/post-mark.model';
import { Box, contains, inBox, padded, toMapBounds } from './map-geometry';

export interface MarksQuery {
  filters: PostFilterParams;
  excludeMine: boolean;
}

interface Request {
  box: Box;
  key: string;
  query: MarksQuery;
}

/**
 * The home map's pins for the visit: every mark loaded for the current filters, so a pan back, a zoom out or Back
 * from a post shows them at once. A newer view or filter cancels the request still running, so an older answer never
 * replaces newer pins, and a failed one keeps them.
 */
@Injectable({ providedIn: 'root' })
export class MapMarks {
  private postService = inject(PostService);

  readonly marks = signal<PostMark[]>([]);
  readonly loading = signal(false);
  /** Each request's end, answered or failed. */
  readonly settled = new Subject<void>();

  /** What the last request was for. */
  private loaded: { box: Box; key: string } | null = null;
  private cache = new Map<string, PostMark>();
  private cacheKey = '';
  private requests = new Subject<Request>();

  constructor() {
    this.requests
      .pipe(
        tap(() => this.loading.set(true)),
        switchMap(({ box, key, query }) =>
          this.postService.getMapMarks(query.filters, toMapBounds(box), query.excludeMine).pipe(
            map((marks) => ({ marks, box, key })),
            catchError(() => {
              this.loaded = null;
              return of(null);
            }),
          ),
        ),
      )
      .subscribe((answer) => {
        this.loading.set(false);
        if (answer) {
          this.keep(answer.marks, answer.box, answer.key);
        }
        this.settled.next();
      });
  }

  /**
   * Fetches a box two views wider on each side, and again once the view comes within half a view of its edge, so
   * pins ahead of a pan are there before the view is. False when what's loaded covers the view.
   */
  load(view: Box, query: MarksQuery): boolean {
    const key = JSON.stringify([query.filters, query.excludeMine]);
    if (this.loaded?.key === key && contains(this.loaded.box, padded(view, 0.5))) {
      return false;
    }
    const box = padded(view, 2);
    this.loaded = { box, key };
    this.requests.next({ box, key, query });
    return true;
  }

  /** A map opened afresh starts from nothing, so it never shows an earlier look's pins. */
  forget(): void {
    this.loaded = null;
    this.cache.clear();
    this.cacheKey = '';
    this.marks.set([]);
  }

  /**
   * Adds an answer to the pins loaded for these filters. Inside the answer's box it's the truth, so a pin there that
   * it doesn't hold went away; outside, the pins stay.
   */
  private keep(marks: PostMark[], box: Box, key: string): void {
    if (key !== this.cacheKey) {
      this.cache.clear();
      this.cacheKey = key;
    }
    for (const [id, mark] of this.cache) {
      if (inBox(box, mark.coordinates)) {
        this.cache.delete(id);
      }
    }
    for (const mark of marks) {
      this.cache.set(mark.id, mark);
    }
    this.marks.set([...this.cache.values()]);
  }
}
