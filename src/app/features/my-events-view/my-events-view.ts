import { Component, inject, signal, OnInit, DestroyRef } from '@angular/core';
import { catchError, EMPTY, Subject, switchMap } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { EventCard } from '../../core/components/event-card/event-card';
import { Btn } from '../../core/components/btn/btn';
import { PostCard } from '../../core/models/posts/post-card.model';
import { PostFilterParams } from '../../core/models/posts/post-filter-params.model';
import { PostService } from '../../core/services/post/post.service';
import { PaginatedResponse } from '../../core/models/common/paginated-response.model';
import { ParticipationType } from '../../core/models/common/enums';

@Component({
  selector: 'app-my-events-view',
  imports: [TranslatePipe, EventCard, Btn],
  templateUrl: './my-events-view.html',
  styleUrl: './my-events-view.scss',
})
export class MyEventsView implements OnInit {
  private postService = inject(PostService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  selectedFilter = signal<ParticipationType | 'all'>('all');
  posts = signal<PaginatedResponse<PostCard>>({
    items: [],
    page: { limit: 20, hasMore: false },
  });

  /** Each switch replaces the request before it, so a slow answer for an old tab can't land last. */
  private filterChanges = new Subject<ParticipationType | 'all'>();

  constructor() {
    this.filterChanges
      .pipe(
        switchMap((filter) =>
          this.postService.getPosts(this.params(filter)).pipe(
            catchError((err) => {
              console.error('Error while fetching posts', err);
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((data) => this.posts.set(data));
  }

  ngOnInit() {
    this.filterChanges.next(this.selectedFilter());
  }

  setFilter(filter: ParticipationType | 'all'): void {
    this.selectedFilter.set(filter);
    this.filterChanges.next(filter);
  }

  goToPost(id: string): void {
    this.router.navigate(['/post', id]);
  }

  private params(filter: ParticipationType | 'all'): PostFilterParams {
    return {
      limit: 20,
      includePast: true,
      participationTypes: filter === 'all' ? ['INTERESTED', 'TAKES_PART'] : [filter],
    };
  }
}
