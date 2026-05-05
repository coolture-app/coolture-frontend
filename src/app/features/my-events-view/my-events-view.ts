import { Component, inject, signal, OnInit, DestroyRef } from '@angular/core';
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
    page: { limit: 20, hasMore: false, nextCursor: null },
  });

  ngOnInit() {
    this.loadPosts();
  }

  loadPosts(): void {
    const filter = this.selectedFilter();
    const filterParams: PostFilterParams = {
      limit: 20,
      participationTypes: filter === 'all' ? ['interested', 'takes_part'] : [filter],
    };

    this.postService
      .getPosts(filterParams)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => this.posts.set(data),
        error: (err) => console.error('Error while fetching posts', err),
      });
  }

  setFilter(filter: ParticipationType | 'all'): void {
    this.selectedFilter.set(filter);
    this.loadPosts();
  }

  goToPost(id: string): void {
    this.router.navigate(['/post', id]);
  }
}
