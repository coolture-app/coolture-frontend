import { inject, Injectable, linkedSignal } from '@angular/core';
import { participants, ViewerState, viewerState } from '../../models/posts/viewer-state';
import { AuthService } from '../auth/auth.service';
import { PostListStore } from '../post-list/post-list.store';

/**
 * The likes and stances the viewer changed in this visit, from a card, the post page or the map. The map keeps the
 * marks it loaded for the whole visit, so it shows its posts through this, and a change made on the map reaches the
 * list's card of the same post.
 */
@Injectable({ providedIn: 'root' })
export class ViewerStates {
  private list = inject(PostListStore);
  /** Starts empty again for another user. */
  private readonly changed = linkedSignal<string, ReadonlyMap<string, ViewerState>>({
    source: inject(AuthService).userId,
    computation: () => new Map(),
  });

  /** The post as the viewer last left it. */
  shown<Post extends ViewerState & { id: string }>(post: Post): Post {
    const change = this.changed().get(post.id);
    return change ? { ...post, ...change } : post;
  }

  /** A change the card already made to its own post. */
  remember(postId: string, state: ViewerState): void {
    this.changed.update((changed) => new Map(changed).set(postId, viewerState(state)));
  }

  /** A change made away from the list, which the list's card of the same post follows. */
  change(postId: string, state: ViewerState): void {
    this.remember(postId, state);
    this.list.items.update((items) =>
      items.map((item) =>
        item.id === postId
          ? { ...item, ...viewerState(state), participantCount: participants(state) }
          : item,
      ),
    );
  }
}
