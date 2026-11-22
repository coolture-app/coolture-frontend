import {
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideSearch, lucideX } from '@ng-icons/lucide';
import { firstValueFrom } from 'rxjs';

import { InitialsPipe } from '../../pipes/initials.pipe';
import { InfiniteScroll } from '../../directives/infinite-scroll';
import { fullName } from '../../models/posts/friend-stances.model';
import { UserListItem } from '../../models/users/user-summary.model';
import { AuthService } from '../../services/auth/auth.service';
import { RelationsService } from '../../services/relations/relations.service';
import { ToastService } from '../../services/toast/toast.service';
import { FollowBtn } from '../follow-btn/follow-btn';
import { LoadState } from '../load-state/load-state';
import { RelationPill } from '../relation-pill/relation-pill';

export type FollowListType = 'followers' | 'following';

const PAGE = 20;
const SEARCH_DELAY_MS = 300;

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
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);

  readonly userId = input.required<string>();
  readonly type = input.required<FollowListType>();
  readonly isOwnProfile = input(false);

  /** Your own following count's change, on your own profile. */
  readonly followChanged = output<number>();

  readonly fullName = fullName;
  readonly typed = signal('');
  private readonly q = signal('');
  readonly users = signal<UserListItem[]>([]);
  readonly followingIds = signal<Set<string>>(new Set());
  readonly loading = signal(false);
  readonly failed = signal(false);
  readonly hasMore = signal(false);
  readonly busyId = signal<string | null>(null);
  private cursor: string | undefined;
  private request = 0;
  private searchTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    void this.loadFollowingIds();
    // Another list, docked beside the profile: its search starts empty.
    effect(() => {
      this.userId();
      this.type();
      untracked(() => {
        clearTimeout(this.searchTimer);
        this.typed.set('');
        this.q.set('');
      });
    });
    effect(() => {
      this.userId();
      this.type();
      this.q();
      untracked(() => this.load(true));
    });
    this.destroyRef.onDestroy(() => clearTimeout(this.searchTimer));
  }

  search(text: string): void {
    this.typed.set(text);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.q.set(text.trim()), SEARCH_DELAY_MS);
  }

  clearSearch(): void {
    clearTimeout(this.searchTimer);
    this.typed.set('');
    this.q.set('');
  }

  /** The first Esc empties the search, and the next one is the sheet's, to close it. */
  escapeSearch(event: Event): void {
    if (this.typed()) {
      event.stopPropagation();
      this.clearSearch();
    }
  }

  loadMore(): void {
    if (this.hasMore() && !this.loading()) {
      this.load(false);
    }
  }

  retry(): void {
    this.load(this.users().length === 0);
  }

  canFollow(user: UserListItem): boolean {
    const currentUserId = this.authService.currentUser()?.id;
    return !!currentUserId && user.id !== currentUserId;
  }

  /** The row stays after an unfollow, so a mistaken tap can be undone. */
  async toggleFollow(user: UserListItem): Promise<void> {
    const following = this.followingIds().has(user.id);
    this.busyId.set(user.id);
    try {
      await firstValueFrom(
        following ? this.relationsService.unfollow(user.id) : this.relationsService.follow(user.id),
      );
      this.followingIds.update((ids) => {
        const next = new Set(ids);
        if (following) {
          next.delete(user.id);
        } else {
          next.add(user.id);
        }
        return next;
      });
      // Only your own counts are on screen; someone else's following count doesn't change.
      if (this.isOwnProfile()) {
        this.followChanged.emit(following ? -1 : 1);
      }
    } catch (err) {
      console.error('Error toggling follow', err);
      this.toast.show(this.translate.instant('PROFILE.saveFailed'));
    } finally {
      this.busyId.set(null);
    }
  }

  private async loadFollowingIds(): Promise<void> {
    const currentUserId = this.authService.currentUser()?.id;
    if (!currentUserId) return;
    try {
      const res = await firstValueFrom(
        this.relationsService.getFollowing(currentUserId, { limit: 100, cursor: '' }),
      );
      this.followingIds.set(new Set(res.items.map((u) => u.id)));
    } catch {
      // The buttons then offer Obserwuj, and the follow itself says if it's already there.
    }
  }

  /** A newer request wins: an answer for a list or search that changed since is dropped. */
  private load(fresh: boolean): void {
    const request = fresh ? ++this.request : this.request;
    if (fresh) {
      this.users.set([]);
      this.cursor = undefined;
      this.hasMore.set(false);
    }
    this.loading.set(true);
    this.failed.set(false);
    const page = { limit: PAGE, cursor: this.cursor ?? '' };
    const q = this.q() || undefined;
    const request$ =
      this.type() === 'followers'
        ? this.relationsService.getFollowers(this.userId(), page, q)
        : this.relationsService.getFollowing(this.userId(), page, q);
    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        if (request !== this.request) return;
        this.users.update((users) => [...users, ...res.items]);
        this.cursor = res.page.nextCursor ?? undefined;
        this.hasMore.set(res.page.hasMore);
        this.loading.set(false);
      },
      error: (err) => {
        if (request !== this.request) return;
        console.error('Error loading users', err);
        this.failed.set(true);
        this.loading.set(false);
      },
    });
  }
}
