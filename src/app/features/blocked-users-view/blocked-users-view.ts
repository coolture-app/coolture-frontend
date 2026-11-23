import { Component, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';

import { BackLink } from '../../core/components/back-link/back-link';
import { Btn } from '../../core/components/btn/btn';
import { LoadState } from '../../core/components/load-state/load-state';
import { InfiniteScroll } from '../../core/directives/infinite-scroll';
import { searchedPages } from '../../core/utils/searched-pages';
import { AuthService } from '../../core/services/auth/auth.service';
import { RelationsService, unblockQuestion } from '../../core/services/relations/relations.service';
import { ConfirmService } from '../../core/services/confirm/confirm.service';
import { ToastService } from '../../core/services/toast/toast.service';

@Component({
  selector: 'app-blocked-users-view',
  imports: [TranslatePipe, BackLink, Btn, LoadState, InfiniteScroll],
  templateUrl: './blocked-users-view.html',
  styleUrl: './blocked-users-view.scss',
})
export class BlockedUsersView {
  private authService = inject(AuthService);
  private relationsService = inject(RelationsService);
  private confirm = inject(ConfirmService);
  private toast = inject(ToastService);

  readonly pages = searchedPages({
    list: () => this.authService.userId(),
    fetch: ({ cursor, limit }) =>
      this.relationsService.getBlocking(this.authService.userId()!, {
        limit,
        cursor: cursor ?? '',
      }),
  });

  async unblock(user: { id: string; username: string }): Promise<void> {
    if (!(await this.confirm.ask(unblockQuestion(user.username)))) return;
    try {
      await firstValueFrom(this.relationsService.unblock(user.id));
      this.pages.items.update((list) => list.filter((u) => u.id !== user.id));
    } catch (err) {
      console.error('Error unblocking user', err);
      this.toast.failed();
    }
  }
}
