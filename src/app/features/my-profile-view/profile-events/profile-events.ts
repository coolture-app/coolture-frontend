import { Component, computed, inject, input, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucidePlus, lucideSearch, lucideX } from '@ng-icons/lucide';
import { PostFilterParams } from '../../../core/models/posts/post-filter-params.model';
import { UserProfile } from '../../../core/models/users/user-profile.model';
import { PostService } from '../../../core/services/post/post.service';
import { EventRow } from '../../../core/components/event-row/event-row';
import { LoadState } from '../../../core/components/load-state/load-state';
import { InfiniteScroll } from '../../../core/directives/infinite-scroll';
import { searchedPages } from '../../../core/utils/searched-pages';

export type ProfileTab = 'posts' | 'going' | 'interested';

/**
 * A profile's events under its header: what the user posted, upcoming or past, and, for a friend who shares them,
 * what they go to and are interested in. The tab and the past switch are in the URL, so Back from a post returns to
 * them.
 */
@Component({
  selector: 'app-profile-events',
  imports: [TranslatePipe, NgIcon, RouterLink, EventRow, LoadState, InfiniteScroll],
  viewProviders: [provideIcons({ lucidePlus, lucideSearch, lucideX })],
  templateUrl: './profile-events.html',
  styleUrl: './profile-events.scss',
})
export class ProfileEvents {
  readonly user = input.required<UserProfile>();
  readonly own = input(false);

  private posts = inject(PostService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  /** Your own stances are in Plany, so your profile has only what you posted. */
  readonly tabs = computed<ProfileTab[]>(() => {
    const events = this.user().events;
    if (this.own()) {
      return ['posts'];
    }
    return (
      [
        ['posts', events?.posts],
        ['going', events?.takesPart],
        ['interested', events?.interested],
      ] as const
    )
      .filter(([, count]) => !!count)
      .map(([tab]) => tab);
  });

  private readonly params = signal(this.route.snapshot.queryParamMap);
  readonly tab = computed<ProfileTab>(() => {
    const asked = this.params().get('tab') as ProfileTab | null;
    return asked && this.tabs().includes(asked) ? asked : this.tabs()[0];
  });
  /** Minione: asked for, or all there is from someone whose posts have all ended. */
  readonly past = computed(() => {
    const asked = this.params().get('past');
    const events = this.user().events;
    return asked === null ? !!events?.posts && events.upcomingPosts === 0 : asked === '1';
  });

  /**
   * Which list is shown, as one value, so a new profile object with the same id loads nothing.
   */
  readonly pages = searchedPages({
    list: computed(() => `${this.user().id} ${this.tab()} ${this.past()}`),
    searchScope: computed(() => `${this.user().id} ${this.tab()}`),
    fetch: ({ q, cursor, limit }) => this.posts.getPosts({ ...this.filters(q), cursor, limit }),
  });

  constructor() {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed())
      .subscribe((params) => this.params.set(params));
  }

  show(tab: ProfileTab): void {
    this.navigate({ tab: tab === this.tabs()[0] ? null : tab, past: null });
  }

  showPast(past: boolean): void {
    this.navigate({ past: past ? '1' : '0' });
  }

  removed(id: string): void {
    this.pages.items.update((items) => items.filter((post) => post.id !== id));
  }

  private navigate(queryParams: Record<string, string | null>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private filters(q: string | undefined): PostFilterParams {
    const user = this.user();
    switch (this.tab()) {
      case 'going':
        return { participantId: user.id, participationTypes: ['TAKES_PART'], sortBy: 'UPCOMING' };
      case 'interested':
        return { participantId: user.id, participationTypes: ['INTERESTED'], sortBy: 'UPCOMING' };
      default:
        return {
          authorId: user.id,
          sortBy: this.past() ? 'PAST' : 'UPCOMING',
          q,
        };
    }
  }
}
