import { InitialsPipe } from '../../core/pipes/initials.pipe';
import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { firstValueFrom, map } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroMagnifyingGlass } from '@ng-icons/heroicons/outline';

import { AuthService } from '../../core/services/auth/auth.service';
import { Users } from '../../core/services/users/users.service';
import { RelationsService } from '../../core/services/relations/relations.service';
import { UserListItem } from '../../core/models/users/user-summary.model';
import { FollowBtn } from '../../core/components/follow-btn/follow-btn';
import { RelationPill } from '../../core/components/relation-pill/relation-pill';
import { LoadState } from '../../core/components/load-state/load-state';
import { InfiniteScroll } from '../../core/directives/infinite-scroll';
import { ToastService } from '../../core/services/toast/toast.service';
import { searchedPages } from '../../core/utils/searched-pages';

@Component({
  selector: 'app-people-view',
  imports: [
    InitialsPipe,
    TranslatePipe,
    NgIcon,
    RouterModule,
    FollowBtn,
    RelationPill,
    LoadState,
    InfiniteScroll,
  ],
  viewProviders: [provideIcons({ heroMagnifyingGlass })],
  templateUrl: './people-view.html',
  styleUrl: './people-view.scss',
})
export class PeopleView {
  private usersService = inject(Users);
  private relationsService = inject(RelationsService);
  private authService = inject(AuthService);
  private toast = inject(ToastService);

  readonly pages = searchedPages({
    list: () => null,
    fetch: ({ q, cursor, limit }) =>
      this.usersService.searchForUsers(q, { limit, cursor: cursor ?? '' }).pipe(
        map((page) => ({
          ...page,
          items: page.items.filter((user) => user.id !== this.authService.currentUser()?.id),
        })),
      ),
  });

  async toggleFollow(user: UserListItem) {
    const following = !user.isFollowing;
    try {
      await firstValueFrom(
        following ? this.relationsService.follow(user.id) : this.relationsService.unfollow(user.id),
      );
      this.pages.items.update((shown) =>
        shown.map((item) => (item.id === user.id ? { ...item, isFollowing: following } : item)),
      );
    } catch (err) {
      console.error('Error toggling follow', err);
      this.toast.failed();
    }
  }
}
