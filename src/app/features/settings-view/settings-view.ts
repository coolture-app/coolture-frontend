import { AccountForm } from './account-form/account-form';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronRight } from '@ng-icons/lucide';

import { BackLink } from '../../core/components/back-link/back-link';
import { Switch } from '../../core/components/switch/switch/switch';
import { AuthService } from '../../core/services/auth/auth.service';
import { ToastService } from '../../core/services/toast/toast.service';
import { Users } from '../../core/services/users/users.service';

@Component({
  selector: 'app-settings-view',
  imports: [AccountForm, RouterLink, TranslatePipe, NgIcon, BackLink, Switch],
  viewProviders: [provideIcons({ lucideChevronRight })],
  templateUrl: './settings-view.html',
  styleUrl: './settings-view.scss',
})
export class SettingsView {
  private authService = inject(AuthService);
  private usersService = inject(Users);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);

  readonly shareStances = this.authService.shareStances;

  /** Shown as switched at once; switched back if the save fails. */
  async setShareStances(share: boolean): Promise<void> {
    const userId = this.authService.userId();
    if (!userId) return;
    this.authService.markShareStances(share);
    try {
      await firstValueFrom(this.usersService.updateProfile(userId, { shareStances: share }));
    } catch {
      this.authService.markShareStances(!share);
      this.toast.show(this.translate.instant('PROFILE.saveFailed'));
    }
  }
}
