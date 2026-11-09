import { Injectable, signal } from '@angular/core';
import { UserSummary } from '../../models/users/user-summary.model';

/** What the sheet needs of a post. The card's own object, so its count stays right. */
export interface SheetPost {
  id: string;
  commentsCount: number;
  title: string;
  author: UserSummary;
}

/** The comments beside or over the feed: a card asks for them, and the app shell shows them. */
@Injectable({
  providedIn: 'root',
})
export class CommentsSheetService {
  readonly post = signal<SheetPost | null>(null);
  readonly count = signal(0);

  show(post: SheetPost): void {
    this.count.set(post.commentsCount ?? 0);
    this.post.set(post);
  }

  changeCount(by: number): void {
    const post = this.post();
    if (post) {
      this.count.update((count) => Math.max(0, count + by));
      post.commentsCount = this.count();
    }
  }

  close(): void {
    this.post.set(null);
  }
}
