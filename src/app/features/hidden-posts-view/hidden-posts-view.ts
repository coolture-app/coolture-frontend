import { Component, computed, inject, OnInit } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { PostComponent } from '../../core/components/post-component/post-component';
import { PostSkeleton } from '../../core/components/post-skeleton/post-skeleton';
import { Btn } from '../../core/components/btn/btn';
import { InfiniteScroll } from '../../core/directives/infinite-scroll';
import { PostListStore } from '../../core/services/post-list/post-list.store';

/** As on the home page: the next page is asked for this many cards before the end. */
const CARDS_BEFORE_END = 15;

/**
 * The viewer's "Nie dla mnie" posts, newest mark first, ended ones too. Unmarking folds a card in place, so the list
 * keeps its scroll. Its own list, so the home page's survives a visit here.
 */
@Component({
  selector: 'app-hidden-posts-view',
  imports: [TranslatePipe, PostComponent, PostSkeleton, Btn, InfiniteScroll],
  providers: [PostListStore],
  templateUrl: './hidden-posts-view.html',
  styleUrl: './hidden-posts-view.scss',
})
export class HiddenPostsView implements OnInit {
  readonly list = inject(PostListStore);
  readonly nextPageTrigger = computed(() =>
    Math.max(0, this.list.items().length - CARDS_BEFORE_END),
  );

  ngOnInit(): void {
    this.list.start({
      kind: 'posts',
      filters: {
        participationTypes: ['NOT_INTERESTED'],
        sortBy: 'STANCE_NEWEST',
        includePast: true,
      },
    });
  }
}
