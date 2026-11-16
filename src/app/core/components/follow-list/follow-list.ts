import {
  Component,
  inject,
  signal,
  input,
  output,
  computed,
  OnInit,
  DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroXMark } from '@ng-icons/heroicons/outline';

import { AuthService } from '../../services/auth/auth.service';
import { RelationsService } from '../../services/relations/relations.service';
import { UserListItem } from '../../models/users/user-summary.model';
import { PaginationInfo } from '../../models/common/paginated-response.model';
import { Btn } from '../btn/btn';
import { FollowBtn } from '../follow-btn/follow-btn';
import { RelationPill } from '../relation-pill/relation-pill';

export type FollowListType = 'followers' | 'following';

@Component({
  selector: 'app-follow-list',
  standalone: true,
  imports: [CommonModule, TranslatePipe, NgIcon, RouterModule, Btn, FollowBtn, RelationPill],
  viewProviders: [provideIcons({ heroXMark })],
  templateUrl: './follow-list.html',
  styleUrl: './follow-list.scss',
})
export class FollowListComponent implements OnInit {
  private authService = inject(AuthService);
  private relationsService = inject(RelationsService);
  private destroyRef = inject(DestroyRef);

  userId = input.required<string>();
  type = input.required<FollowListType>();
  isOwnProfile = input<boolean>(false);

  closeList = output<void>();
  followChanged = output<{ deltaFollowers: number; deltaFollowing: number }>();

  users = signal<UserListItem[]>([]);
  followingIds = signal<Set<string>>(new Set());
  isLoadingInitial = signal(false);
  isLoadingMore = signal(false);
  nextCursor = signal<string | null>(null);
  hasMore = signal(false);

  actionUserId = signal<string | null>(null);

  isFollowersPanel = computed(() => this.type() === 'followers');

  ngOnInit(): void {
    this.loadFollowingIds();
    this.loadInitial();
  }

  private async loadFollowingIds(): Promise<void> {
    try {
      const currentUserId = this.authService.currentUser()?.id;
      if (!currentUserId) return;

      const res = await firstValueFrom(
        this.relationsService.getFollowing(currentUserId, { limit: 100, cursor: '' }),
      );
      this.followingIds.set(new Set(res.items.map((u) => u.id)));
    } catch {
      // ignore
    }
  }

  canFollow(user: UserListItem): boolean {
    const currentUserId = this.authService.currentUser()?.id;
    return !!currentUserId && user.id !== currentUserId;
  }

  /** The row stays after an unfollow, so a mistaken tap can be undone. */
  async toggleFollow(user: UserListItem): Promise<void> {
    const following = this.followingIds().has(user.id);
    this.actionUserId.set(user.id);
    try {
      await firstValueFrom(
        following ? this.relationsService.unfollow(user.id) : this.relationsService.follow(user.id),
      );
      this.followingIds.update((set) => {
        const next = new Set(set);
        if (following) {
          next.delete(user.id);
        } else {
          next.add(user.id);
        }
        return next;
      });
      this.updateUserFollowState(user.id, !following);
      // Only your own counts are on screen; someone else's following count doesn't change.
      if (this.isOwnProfile()) {
        this.followChanged.emit({ deltaFollowers: 0, deltaFollowing: following ? -1 : 1 });
      }
    } catch (err) {
      console.error('Error toggling follow', err);
    } finally {
      this.actionUserId.set(null);
    }
  }

  private loadInitial(): void {
    this.users.set([]);
    this.nextCursor.set(null);
    this.hasMore.set(false);
    this.isLoadingInitial.set(true);
    this.fetchPage(null, (items, more, cursor) => {
      this.users.set(items);
      this.hasMore.set(more);
      this.nextCursor.set(cursor);
      this.isLoadingInitial.set(false);
    });
  }

  loadMore(): void {
    if (!this.hasMore() || this.isLoadingMore()) return;
    this.isLoadingMore.set(true);
    this.fetchPage(this.nextCursor(), (items, more, cursor) => {
      this.users.update((prev) => [...prev, ...items]);
      this.hasMore.set(more);
      this.nextCursor.set(cursor);
      this.isLoadingMore.set(false);
    });
  }

  private fetchPage(
    cursor: string | null,
    onSuccess: (items: UserListItem[], hasMore: boolean, nextCursor: string | null) => void,
  ): void {
    const pagination: PaginationInfo = { limit: 20, cursor: cursor ?? '' };

    const request$ = this.isFollowersPanel()
      ? this.relationsService.getFollowers(this.userId(), pagination)
      : this.relationsService.getFollowing(this.userId(), pagination);

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => onSuccess(res.items, res.page.hasMore, res.page.nextCursor ?? null),
      error: (err) => {
        console.error('Error loading users', err);
        this.isLoadingInitial.set(false);
        this.isLoadingMore.set(false);
      },
    });
  }

  onClose(): void {
    this.closeList.emit();
  }

  private updateUserFollowState(userId: string, isFollowing: boolean): void {
    this.users.update((list) =>
      list.map((u) =>
        u.id === userId ? { ...u, followersCount: u.followersCount + (isFollowing ? 1 : -1) } : u,
      ),
    );
  }
}
