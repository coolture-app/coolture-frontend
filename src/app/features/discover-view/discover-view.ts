import { InitialsPipe } from '../../core/pipes/initials.pipe';
import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import {
  EMPTY,
  Subject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  map,
  merge,
  switchMap,
  startWith,
  takeUntil,
  tap,
  firstValueFrom,
} from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroMagnifyingGlass } from '@ng-icons/heroicons/outline';

import { AuthService } from '../../core/services/auth/auth.service';
import { Users } from '../../core/services/users/users.service';
import { RelationsService } from '../../core/services/relations/relations.service';
import { UserListItem } from '../../core/models/users/user-summary.model';
import { PaginatedResponse } from '../../core/models/common/paginated-response.model';
import { FollowBtn } from '../../core/components/follow-btn/follow-btn';
import { RelationPill } from '../../core/components/relation-pill/relation-pill';
import { LoadState } from '../../core/components/load-state/load-state';
import { ToastService } from '../../core/services/toast/toast.service';

@Component({
  selector: 'app-discover-view',
  imports: [
    InitialsPipe,
    TranslatePipe,
    NgIcon,
    ReactiveFormsModule,
    RouterModule,
    FollowBtn,
    RelationPill,
    LoadState,
  ],
  viewProviders: [provideIcons({ heroMagnifyingGlass })],
  templateUrl: './discover-view.html',
  styleUrl: './discover-view.scss',
})
export class DiscoverView implements OnInit, OnDestroy {
  private usersService = inject(Users);
  private relationsService = inject(RelationsService);
  private authService = inject(AuthService);
  private toast = inject(ToastService);

  searchControl = new FormControl('');
  private destroy$ = new Subject<void>();
  private retries = new Subject<void>();
  readonly loading = signal(true);
  readonly failed = signal(false);
  followingIds = signal<Set<string>>(new Set());

  users = signal<PaginatedResponse<UserListItem>>({
    items: [],
    page: { limit: 20, hasMore: false },
  });

  ngOnInit() {
    this.loadFollowingIds();
    const typed = this.searchControl.valueChanges.pipe(
      startWith(''),
      debounceTime(400),
      distinctUntilChanged(),
    );
    merge(typed, this.retries.pipe(map(() => this.searchControl.value)))
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.failed.set(false);
        }),
        // A failed search stays inside, so the next one still runs.
        switchMap((query) =>
          this.usersService.searchForUsers(query || undefined).pipe(
            catchError((err) => {
              console.error('Error while searching users', err);
              this.failed.set(true);
              this.loading.set(false);
              return EMPTY;
            }),
          ),
        ),
        takeUntil(this.destroy$),
      )
      .subscribe((data) => {
        const currentUserId = this.authService.currentUser()?.id;
        this.users.set({
          ...data,
          items: data.items.filter((user) => user.id !== currentUserId),
        });
        this.loading.set(false);
      });
  }

  retry(): void {
    this.retries.next();
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

  async toggleFollow(user: UserListItem) {
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
      this.toast.failed();
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
