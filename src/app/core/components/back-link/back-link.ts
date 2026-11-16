import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Location } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowLeft } from '@ng-icons/lucide';
import { TranslatePipe } from '@ngx-translate/core';

import { BackService } from '../../services/back/back.service';

/**
 * The top of a subpage: an arrow and the name of the page it goes back to. A link to that page, so a
 * new tab opens it, while a plain click goes back in history.
 */
@Component({
  selector: 'app-back-link',
  imports: [NgIcon, TranslatePipe],
  viewProviders: [provideIcons({ lucideArrowLeft })],
  template: `
    @let label = target().label;
    @let page = 'text' in label ? label.text : (label.key | translate);
    <a
      class="back-link"
      [href]="href()"
      [attr.aria-label]="'BACK.to' | translate: { page }"
      (click)="go($event)"
    >
      <ng-icon name="lucideArrowLeft" aria-hidden="true" />
      <span class="back-link__page">{{ page }}</span>
    </a>
  `,
  styleUrl: './back-link.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BackLink {
  private back = inject(BackService);
  private location = inject(Location);

  /** Where to go when this tab came straight to the page, from a link or a reload. */
  readonly fallback = input.required<string>();

  readonly target = computed(() => this.back.target(this.fallback()));
  readonly href = computed(() => this.location.prepareExternalUrl(this.target().url));

  go(event: MouseEvent): void {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    this.back.back(this.fallback());
  }
}
