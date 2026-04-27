import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  Subject,
  debounceTime,
  distinctUntilChanged,
  switchMap,
  startWith,
  takeUntil,
  firstValueFrom,
} from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroMagnifyingGlass } from '@ng-icons/heroicons/outline';

import { AuthService } from '../../core/services/auth/auth.service';
import { Users } from '../../core/services/users/users.service';
import { RelationsService } from '../../core/services/relations/relations.service';
import { UserProfile } from '../../core/models/users/user-profile.model';
import { PaginatedResponse } from '../../core/models/common/paginated-response.model';

@Component({
  selector: 'app-discover-view',
  imports: [TranslatePipe, NgIcon, ReactiveFormsModule],
  viewProviders: [provideIcons({ heroMagnifyingGlass })],
  templateUrl: './discover-view.html',
  styleUrl: './discover-view.scss',
})
export class DiscoverView implements OnInit, OnDestroy {
  private usersService = inject(Users);
  private relationsService = inject(RelationsService);
  private authService = inject(AuthService);

  searchControl = new FormControl('');
  private destroy$ = new Subject<void>();
  private followerIds = signal<Set<string>>(new Set());

  users = signal<PaginatedResponse<UserProfile>>({
    items: [],
    page: { limit: 20, hasMore: false, nextCursor: null },
  });

  ngOnInit() {
    this.loadFollowerIds();
    this.searchControl.valueChanges
      .pipe(
        startWith(''),
        debounceTime(400),
        distinctUntilChanged(),
        switchMap((query) => this.usersService.searchForUsers(query || undefined)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (data) => {
          const currentUserId = this.authService.currentUser()?.id;
          const followers = this.followerIds();
          this.users.set({
            ...data,
            items: data.items.filter(
              (user) => user.id !== currentUserId && !followers.has(user.id),
            ),
          });
        },
        error: (err) => console.error('Error while searching users', err),
      });
  }

  private async loadFollowerIds(): Promise<void> {
    try {
      const currentUserId = this.authService.currentUser()?.id;
      if (!currentUserId) return;
      const res = await firstValueFrom(
        this.relationsService.getFollowers(currentUserId, { limit: 100, cursor: '' }),
      );
      this.followerIds.set(new Set(res.items.map((u) => u.id)));
    } catch {
      // ignore
    }
  }

  async toggleFollow(user: UserProfile) {
    try {
      if (user.isFollowing) {
        await firstValueFrom(this.relationsService.unfollow(user.id));
      } else {
        await firstValueFrom(this.relationsService.follow(user.id));
      }
      this.users.update((u) => ({
        ...u,
        items: u.items.map((item) =>
          item.id === user.id
            ? {
                ...item,
                isFollowing: !user.isFollowing,
                followersCount: item.followersCount + (user.isFollowing ? -1 : 1),
              }
            : item,
        ),
      }));
    } catch (err) {
      console.error('Error toggling follow', err);
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
