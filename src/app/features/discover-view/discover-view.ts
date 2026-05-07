import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
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
import { UserSummary } from '../../core/models/users/user-summary.model';
import { PaginatedResponse } from '../../core/models/common/paginated-response.model';
import { Btn } from '../../core/components/btn/btn';

@Component({
  selector: 'app-discover-view',
  imports: [TranslatePipe, NgIcon, ReactiveFormsModule, RouterModule, Btn],
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
  followingIds = signal<Set<string>>(new Set());

  users = signal<PaginatedResponse<UserSummary>>({
    items: [],
    page: { limit: 20, hasMore: false, nextCursor: null },
  });

  ngOnInit() {
    this.loadFollowingIds();
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
          this.users.set({
            ...data,
            items: data.items.filter((user) => user.id !== currentUserId),
          });
        },
        error: (err) => console.error('Error while searching users', err),
      });
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

  async toggleFollow(user: UserSummary) {
    const isCurrentlyFollowing = this.followingIds().has(user.id);
    try {
      if (isCurrentlyFollowing) {
        await firstValueFrom(this.relationsService.unfollow(user.id));
        this.followingIds.update((set) => {
          const newSet = new Set(set);
          newSet.delete(user.id);
          return newSet;
        });
      } else {
        await firstValueFrom(this.relationsService.follow(user.id));
        this.followingIds.update((set) => {
          const newSet = new Set(set);
          newSet.add(user.id);
          return newSet;
        });
      }
    } catch (err) {
      console.error('Error toggling follow', err);
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
