import { Component, inject, OnInit, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowLeft } from '@ng-icons/lucide';

import { Btn } from '../../core/components/btn/btn';
import { UserSummary } from '../../core/models/users/user-summary.model';
import { AuthService } from '../../core/services/auth/auth.service';
import { BackService } from '../../core/services/back/back.service';
import { RelationsService } from '../../core/services/relations/relations.service';

@Component({
  selector: 'app-blocked-users-view',
  imports: [TranslatePipe, NgIcon, Btn],
  viewProviders: [provideIcons({ lucideArrowLeft })],
  templateUrl: './blocked-users-view.html',
  styleUrl: './blocked-users-view.scss',
})
export class BlockedUsersView implements OnInit {
  private authService = inject(AuthService);
  private relationsService = inject(RelationsService);
  private backService = inject(BackService);
  private translate = inject(TranslateService);

  readonly users = signal<UserSummary[]>([]);
  readonly loading = signal(true);
  readonly failed = signal(false);

  ngOnInit(): void {
    void this.load();
  }

  back(): void {
    this.backService.back('/profile/settings');
  }

  async load(): Promise<void> {
    const userId = this.authService.userId();
    if (!userId) return;
    this.loading.set(true);
    this.failed.set(false);
    try {
      const res = await firstValueFrom(
        this.relationsService.getBlocking(userId, { limit: 100, cursor: '' }),
      );
      this.users.set(res.items);
    } catch (err) {
      console.error('Error loading blocked users', err);
      this.failed.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  async unblock(userId: string): Promise<void> {
    if (!confirm(this.translate.instant('PROFILE.unblockConfirm'))) return;
    try {
      await firstValueFrom(this.relationsService.unblock(userId));
      this.users.update((list) => list.filter((u) => u.id !== userId));
    } catch (err) {
      console.error('Error unblocking user', err);
    }
  }
}
