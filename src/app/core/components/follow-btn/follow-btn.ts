import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck, lucideUserPlus } from '@ng-icons/lucide';
import { TranslatePipe } from '@ngx-translate/core';

import { Btn } from '../btn/btn';

/** Obserwuj, or Obserwujesz once followed. A tap on Obserwujesz unfollows. */
@Component({
  selector: 'app-follow-btn',
  imports: [Btn, NgIcon, TranslatePipe],
  viewProviders: [provideIcons({ lucideCheck, lucideUserPlus })],
  template: `
    <app-btn
      [variant]="following() ? 'secondary' : 'primary'"
      size="sm"
      [disabled]="busy()"
      (btnClick)="toggled.emit()"
    >
      <ng-icon [name]="following() ? 'lucideCheck' : 'lucideUserPlus'" aria-hidden="true" />
      {{ (following() ? 'PROFILE.followingThem' : 'PROFILE.follow') | translate }}
    </app-btn>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FollowBtn {
  readonly following = input(false);
  readonly busy = input(false);
  readonly toggled = output<void>();
}
