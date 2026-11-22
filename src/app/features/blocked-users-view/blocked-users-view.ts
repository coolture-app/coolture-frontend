import { Component, inject, OnInit, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';

import { BackLink } from '../../core/components/back-link/back-link';
import { Btn } from '../../core/components/btn/btn';
import { UserListItem } from '../../core/models/users/user-summary.model';
import { AuthService } from '../../core/services/auth/auth.service';
import { RelationsService, unblockQuestion } from '../../core/services/relations/relations.service';
import { ConfirmService } from '../../core/services/confirm/confirm.service';
import { ToastService } from '../../core/services/toast/toast.service';

@Component({
  selector: 'app-blocked-users-view',
  imports: [TranslatePipe, BackLink, Btn],
  templateUrl: './blocked-users-view.html',
  styleUrl: './blocked-users-view.scss',
})
export class BlockedUsersView implements OnInit {
  private authService = inject(AuthService);
  private relationsService = inject(RelationsService);
  private confirm = inject(ConfirmService);
  private toast = inject(ToastService);

  readonly users = signal<UserListItem[]>([]);
  readonly loading = signal(true);
  readonly failed = signal(false);

  ngOnInit(): void {
    void this.load();
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

  async unblock(user: { id: string; username: string }): Promise<void> {
    if (!(await this.confirm.ask(unblockQuestion(user.username)))) return;
    try {
      await firstValueFrom(this.relationsService.unblock(user.id));
      this.users.update((list) => list.filter((u) => u.id !== user.id));
    } catch (err) {
      console.error('Error unblocking user', err);
      this.toast.failed();
    }
  }
}
