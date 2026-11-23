import { Component, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideSearch, lucideX } from '@ng-icons/lucide';
import { firstValueFrom } from 'rxjs';

import { InitialsPipe } from '../../pipes/initials.pipe';
import { InfiniteScroll } from '../../directives/infinite-scroll';
import { fullName } from '../../models/users/user-summary.model';
import { UserListItem } from '../../models/users/user-summary.model';
import { AuthService } from '../../services/auth/auth.service';
import { RelationsService } from '../../services/relations/relations.service';
import { ToastService } from '../../services/toast/toast.service';
import { FollowBtn } from '../follow-btn/follow-btn';
import { LoadState } from '../load-state/load-state';
import { RelationPill } from '../relation-pill/relation-pill';
import { searchedPages } from '../../utils/searched-pages';

export type FollowListType = 'followers' | 'following';

/** Who follows a user, or whom they follow, by name from A to Z, with a search over all of them. */
@Component({
  selector: 'app-follow-list',
  imports: [
    InitialsPipe,
    RouterLink,
    TranslatePipe,
    NgIcon,
    InfiniteScroll,
    FollowBtn,
    LoadState,
    RelationPill,
  ],
  viewProviders: [provideIcons({ lucideSearch, lucideX })],
  templateUrl: './follow-list.html',
  styleUrl: './follow-list.scss',
})
export class FollowListComponent {
  private authService = inject(AuthService);
  private relationsService = inject(RelationsService);
  private toast = inject(ToastService);

  readonly userId = input.required<string>();
  readonly type = input.required<FollowListType>();
  readonly isOwnProfile = input(false);

  /** Your own following count's change, on your own profile. */
  readonly followChanged = output<number>();

  readonly fullName = fullName;
  readonly busyId = signal<string | null>(null);

  readonly pages = searchedPages({
    list: computed(() => `${this.userId()} ${this.type()}`),
    fetch: ({ q, cursor, limit }) => {
      const page = { limit, cursor: cursor ?? '' };
      return this.type() === 'followers'
        ? this.relationsService.getFollowers(this.userId(), page, q)
        : this.relationsService.getFollowing(this.userId(), page, q);
    },
  });

  /** The first Esc empties the search, and the next one is the sheet's, to close it. */
  escapeSearch(event: Event): void {
    if (this.pages.typed()) {
      event.stopPropagation();
      this.pages.clearSearch();
    }
  }

  canFollow(user: UserListItem): boolean {
    const currentUserId = this.authService.currentUser()?.id;
    return !!currentUserId && user.id !== currentUserId;
  }

  /** The row stays after an unfollow, so a mistaken tap can be undone. */
  async toggleFollow(user: UserListItem): Promise<void> {
    const following = user.isFollowing;
    this.busyId.set(user.id);
    try {
      await firstValueFrom(
        following ? this.relationsService.unfollow(user.id) : this.relationsService.follow(user.id),
      );
      this.pages.items.update((shown) =>
        shown.map((item) => (item.id === user.id ? { ...item, isFollowing: !following } : item)),
      );
      // Only your own counts are on screen; someone else's following count doesn't change.
      if (this.isOwnProfile()) {
        this.followChanged.emit(following ? -1 : 1);
      }
    } catch (err) {
      console.error('Error toggling follow', err);
      this.toast.failed();
    } finally {
      this.busyId.set(null);
    }
  }
}
