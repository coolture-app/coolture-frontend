import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideBookmark } from '@ng-icons/lucide';
import { TranslatePipe } from '@ngx-translate/core';

import { appTicket } from '../../icons/ticket';
import { Tooltip } from '../../directives/tooltip';
import { Friend, FriendGroup, FriendStances } from '../../models/posts/friend-stances.model';

const FACES = 2;

/**
 * Which friends go to a post or are interested in it. Icons stand for the stances because Polish
 * "zainteresowana" or "zainteresowany" needs a gender the app doesn't know.
 */
@Component({
  selector: 'app-friends-line',
  imports: [NgIcon, TranslatePipe, Tooltip],
  viewProviders: [provideIcons({ appTicket, lucideBookmark })],
  templateUrl: './friends-line.html',
  styleUrl: './friends-line.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FriendsLine {
  readonly stances = input<FriendStances | undefined>();

  readonly faces = computed(() => {
    const { going, interested } = this.stances() ?? {};
    return [...(going?.people ?? []), ...(interested?.people ?? [])].slice(0, FACES);
  });

  names(group: FriendGroup): string {
    const listed = group.people.map(nameOf).join(', ');
    const rest = group.count - group.people.length;
    return rest > 0 ? `${listed} +${rest}` : listed;
  }

  initials(friend: Friend): string {
    return (friend.firstName?.charAt(0) ?? friend.username.charAt(0)).toUpperCase();
  }
}

function nameOf(friend: Friend): string {
  return friend.firstName || friend.username;
}
