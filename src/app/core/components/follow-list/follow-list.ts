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
import { heroUserPlus, heroUserMinus, heroNoSymbol, heroXMark } from '@ng-icons/heroicons/outline';

import { AuthService } from '../../services/auth/auth.service';
import { RelationsService } from '../../services/relations/relations.service';
import { UserProfile } from '../../models/users/user-profile.model';
import { PaginationInfo } from '../../models/common/paginated-response.model';

export type FollowListType = 'followers' | 'following';

@Component({
  selector: 'app-follow-list',
  standalone: true,
  imports: [CommonModule, TranslatePipe, NgIcon, RouterModule],
  viewProviders: [provideIcons({ heroUserPlus, heroUserMinus, heroNoSymbol, heroXMark })],
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

  users = signal<UserProfile[]>([]);
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

  canFollow(user: UserProfile): boolean {
    const currentUserId = this.authService.currentUser()?.id;
    return !!currentUserId && user.id !== currentUserId && !this.followingIds().has(user.id);
  }

  async onFollow(user: UserProfile): Promise<void> {
    this.actionUserId.set(user.id);
    try {
      await firstValueFrom(this.relationsService.follow(user.id));
      this.followingIds.update((set) => {
        const newSet = new Set(set);
        newSet.add(user.id);
        return newSet;
      });
      this.followChanged.emit({ deltaFollowers: 0, deltaFollowing: 1 });
    } catch (err) {
      console.error('Error following user', err);
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
    onSuccess: (items: UserProfile[], hasMore: boolean, nextCursor: string | null) => void,
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

  async onToggleFollow(user: UserProfile, isCurrentlyFollowing: boolean): Promise<void> {
    this.actionUserId.set(user.id);
    try {
      if (isCurrentlyFollowing) {
        await firstValueFrom(this.relationsService.unfollow(user.id));
        if (!this.isFollowersPanel()) {
          this.users.update((list) => list.filter((u) => u.id !== user.id));
        } else {
          this.updateUserFollowState(user.id, false);
        }
        this.followChanged.emit({ deltaFollowers: 0, deltaFollowing: -1 });
      } else {
        await firstValueFrom(this.relationsService.follow(user.id));
        this.updateUserFollowState(user.id, true);
        this.followChanged.emit({ deltaFollowers: 0, deltaFollowing: 1 });
      }
    } catch (err) {
      console.error('Error toggling follow', err);
    } finally {
      this.actionUserId.set(null);
    }
  }

  async onRemoveFollower(user: UserProfile): Promise<void> {
    if (!confirm('Block this follower?')) return;
    this.actionUserId.set(user.id);
    try {
      await firstValueFrom(this.relationsService.block(user.id));
      this.users.update((list) => list.filter((u) => u.id !== user.id));
    } catch (err) {
      console.error('Error removing follower', err);
    } finally {
      this.actionUserId.set(null);
    }
  }

  async onToggleBlock(user: UserProfile, isCurrentlyBlocked: boolean): Promise<void> {
    if (!confirm(isCurrentlyBlocked ? 'Unblock this user?' : 'Block this user?')) return;
    this.actionUserId.set(user.id);
    try {
      if (isCurrentlyBlocked) {
        await firstValueFrom(this.relationsService.unblock(user.id));
      } else {
        await firstValueFrom(this.relationsService.block(user.id));
      }
      this.users.update((list) =>
        list.map((u) => (u.id === user.id ? { ...u, isBlocked: !isCurrentlyBlocked } : u)),
      );
    } catch (err) {
      console.error('Error toggling block', err);
    } finally {
      this.actionUserId.set(null);
    }
  }

  onClose(): void {
    this.closeList.emit();
  }

  private updateUserFollowState(userId: string, isFollowing: boolean): void {
    this.users.update((list) =>
      list.map((u) =>
        u.id === userId
          ? { ...u, isFollowing, followersCount: u.followersCount + (isFollowing ? 1 : -1) }
          : u,
      ),
    );
  }
}
