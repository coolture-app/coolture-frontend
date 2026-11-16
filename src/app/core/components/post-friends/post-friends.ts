import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideBookmark } from '@ng-icons/lucide';
import { Subscription } from 'rxjs';

import { appTicket } from '../../icons/ticket';
import { fullName, initial, PostFriends } from '../../models/posts/friend-stances.model';
import { PostService } from '../../services/post/post.service';

/** Every friend who goes to a post or is interested in it, in the comments' place. */
@Component({
  selector: 'app-post-friends',
  imports: [RouterLink, TranslatePipe, NgIcon],
  viewProviders: [provideIcons({ appTicket, lucideBookmark })],
  templateUrl: './post-friends.html',
  styleUrl: './post-friends.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PostFriendsList {
  private posts = inject(PostService);
  private request: Subscription | undefined;

  readonly postId = input.required<string>();
  readonly friends = signal<PostFriends | null>(null);
  readonly failed = signal(false);
  readonly fullName = fullName;
  readonly initial = initial;

  constructor() {
    effect((onCleanup) => {
      this.postId();
      this.load();
      onCleanup(() => this.request?.unsubscribe());
    });
  }

  load(): void {
    this.request?.unsubscribe();
    this.friends.set(null);
    this.failed.set(false);
    this.request = this.posts.getFriends(this.postId()).subscribe({
      next: (friends) => this.friends.set(friends),
      error: () => this.failed.set(true),
    });
  }
}
