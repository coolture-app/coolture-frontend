import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideBookmark } from '@ng-icons/lucide';
import { TranslatePipe } from '@ngx-translate/core';

import { appTicket } from '../../icons/ticket';
import {
  Friend,
  FriendGroup,
  FriendStances,
  STANCES,
} from '../../models/posts/friend-stances.model';
import { InitialsPipe } from '../../pipes/initials.pipe';

/**
 * Which friends go to a post or are interested in it, each stance with its own faces. Icons stand for the stances
 * because Polish "zainteresowana" or "zainteresowany" needs a gender the app doesn't know. A tap opens all of them.
 */
@Component({
  selector: 'app-friends-line',
  imports: [NgIcon, TranslatePipe, InitialsPipe],
  viewProviders: [provideIcons({ appTicket, lucideBookmark })],
  templateUrl: './friends-line.html',
  styleUrl: './friends-line.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FriendsLine {
  readonly stances = input<FriendStances | undefined>();
  readonly opened = output<void>();

  readonly groups = computed(() =>
    STANCES.flatMap(({ key, icon }) => {
      const stance = this.stances()?.[key];
      return stance ? [{ key, icon, stance }] : [];
    }),
  );

  names(group: FriendGroup): string {
    const listed = group.people.map(nameOf).join(', ');
    const rest = group.count - group.people.length;
    return rest > 0 ? `${listed} +${rest}` : listed;
  }
}

function nameOf(friend: Friend): string {
  return friend.firstName || friend.username;
}
