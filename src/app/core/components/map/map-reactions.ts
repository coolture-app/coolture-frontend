import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { catchError, concatMap, EMPTY, Observable, Subject, tap } from 'rxjs';
import { AuthService } from '../../services/auth/auth.service';
import { counted, ParticipationType } from '../../models/common/enums';
import { PostMark } from '../../models/posts/post-mark.model';
import { InteractionsService } from '../../services/interactions/interactions.service';
import { PostListStore } from '../../services/post-list/post-list.store';
import { ToastService } from '../../services/toast/toast.service';

/** What the preview's buttons change on a mark. */
type Reacted = Pick<
  PostMark,
  'myReaction' | 'myParticipation' | 'positiveReactionCount' | 'interestedCount' | 'goingCount'
>;

/**
 * 👍, Interesuje mnie and Idę in the map's preview, by the card's rules: one stance at a time, the change shown at
 * once and taken back if the server refuses, a guest's tap signing in. The marks come from the server, so what changed
 * is kept beside them for the visit, and the list's card of the same post follows.
 */
@Injectable({ providedIn: 'root' })
export class MapReactions {
  private interactions = inject(InteractionsService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private list = inject(PostListStore);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);

  private readonly changed = signal<ReadonlyMap<string, Reacted>>(new Map());
  /** One request at a time, in order, so a quick second tap can't overtake the first. */
  private readonly requests = new Subject<Observable<unknown>>();

  constructor() {
    this.requests.pipe(concatMap((request) => request)).subscribe();
  }

  /** The mark as the viewer last left it. */
  shown(post: PostMark): PostMark {
    const change = this.changed().get(post.id);
    return change ? { ...post, ...change } : post;
  }

  like(post: PostMark): void {
    if (!this.signedIn()) {
      return;
    }
    const before = this.state(post);
    const liked = before.myReaction !== 'LIKE';
    this.apply(post, {
      ...before,
      myReaction: liked ? 'LIKE' : undefined,
      positiveReactionCount: before.positiveReactionCount + (liked ? 1 : -1),
    });
    this.send(
      liked
        ? this.interactions.setReaction(post.id, { type: 'LIKE' })
        : this.interactions.removeReaction(post.id),
      () => this.apply(post, before),
    );
  }

  /** Interesuje mnie or Idę: on, off, or in place of the other. */
  stance(post: PostMark, type: 'INTERESTED' | 'TAKES_PART'): void {
    if (!this.signedIn()) {
      return;
    }
    const before = this.state(post);
    const next = before.myParticipation === type ? undefined : type;
    this.apply(post, {
      ...before,
      myParticipation: next,
      interestedCount: count(before.interestedCount, before.myParticipation, next, 'INTERESTED'),
      goingCount: count(before.goingCount, before.myParticipation, next, 'TAKES_PART'),
    });
    this.send(
      next
        ? this.interactions.setParticipation(post.id, { type: next })
        : this.interactions.removeParticipation(post.id),
      () => this.apply(post, before),
      next ? () => this.toast.show(this.translate.instant('POST.saved-to-plans')) : undefined,
    );
  }

  private state(post: PostMark): Reacted {
    const { myReaction, myParticipation, positiveReactionCount, interestedCount, goingCount } =
      this.shown(post);
    return { myReaction, myParticipation, positiveReactionCount, interestedCount, goingCount };
  }

  private apply(post: PostMark, state: Reacted): void {
    this.changed.update((changed) => new Map(changed).set(post.id, state));
    this.list.items.update((items) =>
      items.map((item) => {
        if (item.id !== post.id) {
          return item;
        }
        const was = counted(item.myParticipation);
        const is = counted(state.myParticipation);
        return {
          ...item,
          myReaction: state.myReaction,
          myParticipation: state.myParticipation,
          positiveReactionCount: state.positiveReactionCount,
          participantCount: item.participantCount + (is ? 1 : 0) - (was ? 1 : 0),
        };
      }),
    );
  }

  private send(request: Observable<unknown>, revert: () => void, done?: () => void): void {
    this.requests.next(
      request.pipe(
        tap({ next: () => done?.(), error: revert }),
        catchError(() => EMPTY),
      ),
    );
  }

  /** A guest's tap signs in, and comes back to this page. */
  private signedIn(): boolean {
    if (this.auth.isAuthenticated()) {
      return true;
    }
    void this.auth.login(this.router.url);
    return false;
  }
}

/** A stance's count after a change from `was` to `next`. Unknown stays unknown, for a post opened from its card. */
function count(
  current: number | undefined,
  was: ParticipationType | undefined,
  next: ParticipationType | undefined,
  type: ParticipationType,
): number | undefined {
  return current === undefined
    ? undefined
    : current + (next === type ? 1 : 0) - (was === type ? 1 : 0);
}
