import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideBookmark } from '@ng-icons/lucide';
import { TranslatePipe } from '@ngx-translate/core';

import { appTicket } from '../../icons/ticket';
import {
  Friend,
  FriendGroup,
  FriendStances,
  initial,
} from '../../models/posts/friend-stances.model';

const FACES = 2;

/**
 * Which friends go to a post or are interested in it, each stance with its own faces. Icons stand for the stances
 * because Polish "zainteresowana" or "zainteresowany" needs a gender the app doesn't know. A tap opens all of them.
 */
@Component({
  selector: 'app-friends-line',
  imports: [NgIcon, TranslatePipe],
  viewProviders: [provideIcons({ appTicket, lucideBookmark })],
  templateUrl: './friends-line.html',
  styleUrl: './friends-line.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FriendsLine {
  readonly stances = input<FriendStances | undefined>();
  readonly opened = output<void>();
  readonly initial = initial;

  readonly groups = computed(() => {
    const { going, interested } = this.stances() ?? {};
    return [
      { name: 'going', icon: 'appTicket', stance: going },
      { name: 'interested', icon: 'lucideBookmark', stance: interested },
    ]
      .filter((group): group is typeof group & { stance: FriendGroup } => !!group.stance)
      .map((group) => ({ ...group, faces: group.stance.people.slice(0, FACES) }));
  });

  names(group: FriendGroup): string {
    const listed = group.people.map(nameOf).join(', ');
    const rest = group.count - group.people.length;
    return rest > 0 ? `${listed} +${rest}` : listed;
  }
}

function nameOf(friend: Friend): string {
  return friend.firstName || friend.username;
}
