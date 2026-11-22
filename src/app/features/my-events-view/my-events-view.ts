import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Router } from '@angular/router';

import { EventCard } from '../../core/components/event-card/event-card';
import { Btn } from '../../core/components/btn/btn';
import { InfiniteScroll } from '../../core/directives/infinite-scroll';
import { PostListStore } from '../../core/services/post-list/post-list.store';
import { ParticipationType } from '../../core/models/common/enums';

/** As on the home page: the next page is asked for this many cards before the end. */
const CARDS_BEFORE_END = 15;

/** Its own list, so the home page's survives a visit here. */
@Component({
  selector: 'app-my-events-view',
  imports: [TranslatePipe, EventCard, Btn, InfiniteScroll],
  providers: [PostListStore],
  templateUrl: './my-events-view.html',
  styleUrl: './my-events-view.scss',
})
export class MyEventsView implements OnInit {
  readonly list = inject(PostListStore);
  private router = inject(Router);

  selectedFilter = signal<ParticipationType | 'all'>('all');
  readonly nextPageTrigger = computed(() =>
    Math.max(0, this.list.items().length - CARDS_BEFORE_END),
  );

  ngOnInit() {
    this.load(this.selectedFilter());
  }

  setFilter(filter: ParticipationType | 'all'): void {
    this.selectedFilter.set(filter);
    this.load(filter);
  }

  goToPost(id: string): void {
    this.router.navigate(['/posts', id]);
  }

  private load(filter: ParticipationType | 'all'): void {
    this.list.start({
      kind: 'posts',
      filters: {
        includePast: true,
        participationTypes: filter === 'all' ? ['INTERESTED', 'TAKES_PART'] : [filter],
      },
    });
  }
}
