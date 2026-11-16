import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideUsers } from '@ng-icons/lucide';
import { TranslatePipe } from '@ngx-translate/core';

/** "Znajomi" when you follow each other, "Obserwuje Cię" when only they follow you, else nothing. */
@Component({
  selector: 'app-relation-pill',
  imports: [NgIcon, TranslatePipe],
  viewProviders: [provideIcons({ lucideUsers })],
  template: `
    @switch (relation()) {
      @case ('friends') {
        <span class="pill pill--friends">
          <ng-icon name="lucideUsers" aria-hidden="true" />
          {{ 'PROFILE.friends' | translate }}
        </span>
      }
      @case ('followsYou') {
        <span class="pill">{{ 'PROFILE.followsYou' | translate }}</span>
      }
    }
  `,
  styleUrl: './relation-pill.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RelationPill {
  readonly following = input(false);
  readonly followsYou = input(false);

  readonly relation = computed(() => {
    if (!this.followsYou()) return null;
    return this.following() ? 'friends' : 'followsYou';
  });
}
