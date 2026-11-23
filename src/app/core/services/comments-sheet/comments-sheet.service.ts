import { computed, Injectable, signal } from '@angular/core';
import { UserSummary } from '../../models/users/user-summary.model';

/** What the sheet needs of a post. The card's own object, so its count stays right. */
export interface SheetPost {
  id: string;
  commentsCount: number;
  title: string;
  author: UserSummary;
}

/** The map's marks have no author, and the friends list needs none. */
export type FriendsPost = Pick<SheetPost, 'id' | 'title'> & { author?: UserSummary };

type SheetState =
  | { content: 'comments'; post: SheetPost }
  | { content: 'friends'; post: FriendsPost };

/**
 * A post's comments or its friends list, beside or over the feed: a card asks for them, and the app shell shows
 * them. One at a time, so asking for the other switches the panel.
 */
@Injectable({
  providedIn: 'root',
})
export class CommentsSheetService {
  private readonly state = signal<SheetState | null>(null);
  readonly post = computed(() => this.state()?.post ?? null);
  readonly content = computed(() => this.state()?.content ?? 'comments');
  /** The comments' post, while they're what's shown. */
  readonly commentsOf = computed(() => {
    const state = this.state();
    return state?.content === 'comments' ? state.post : null;
  });
  readonly count = signal(0);

  show(post: SheetPost): void {
    this.count.set(post.commentsCount);
    this.state.set({ content: 'comments', post });
  }

  showFriends(post: FriendsPost): void {
    this.state.set({ content: 'friends', post });
  }

  changeCount(by: number): void {
    const post = this.commentsOf();
    if (post) {
      this.count.update((count) => Math.max(0, count + by));
      post.commentsCount = this.count();
    }
  }

  close(): void {
    this.state.set(null);
  }
}
