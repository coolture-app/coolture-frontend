import { Injectable, signal } from '@angular/core';
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

export type SheetContent = 'comments' | 'friends';

/**
 * A post's comments or its friends list, beside or over the feed: a card asks for them, and the app shell shows
 * them. One at a time, so asking for the other switches the panel.
 */
@Injectable({
  providedIn: 'root',
})
export class CommentsSheetService {
  readonly post = signal<SheetPost | FriendsPost | null>(null);
  readonly content = signal<SheetContent>('comments');
  readonly count = signal(0);

  show(post: SheetPost): void {
    this.count.set(post.commentsCount ?? 0);
    this.content.set('comments');
    this.post.set(post);
  }

  showFriends(post: FriendsPost): void {
    this.content.set('friends');
    this.post.set(post);
  }

  /** The comments' post, while they're what's shown. */
  commentsOf(): SheetPost | null {
    const post = this.post();
    return this.content() === 'comments' ? (post as SheetPost | null) : null;
  }

  changeCount(by: number): void {
    const post = this.commentsOf();
    if (post) {
      this.count.update((count) => Math.max(0, count + by));
      post.commentsCount = this.count();
    }
  }

  close(): void {
    this.post.set(null);
  }
}
