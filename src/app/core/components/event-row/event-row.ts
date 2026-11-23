import { Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCalendarDays, lucideGlobe } from '@ng-icons/lucide';
import { PostCard } from '../../models/posts/post-card.model';
import { postPlace } from '../../models/posts/post-place';
import { EventWhenService } from '../../services/event-when/event-when.service';
import { PostOwnerMenu } from '../post-owner-menu/post-owner-menu';

/** One event in a profile's list: its cover, title, when and where. The owner gets the ⋯ menu. */
@Component({
  selector: 'app-event-row',
  imports: [RouterLink, TranslatePipe, NgIcon, PostOwnerMenu],
  viewProviders: [provideIcons({ lucideCalendarDays, lucideGlobe })],
  templateUrl: './event-row.html',
  styleUrl: './event-row.scss',
})
export class EventRow {
  readonly post = input.required<PostCard>();
  readonly own = input(false);
  readonly deleted = output<string>();

  private when = inject(EventWhenService);

  readonly cover = computed(() => this.post().photos?.[0]?.url ?? null);
  readonly time = computed(() => this.when.card(this.post()));
  readonly place = computed(() => postPlace(this.post()));
}
