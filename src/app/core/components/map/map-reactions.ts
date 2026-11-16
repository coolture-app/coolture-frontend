import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { catchError, concatMap, EMPTY, Observable, Subject, tap } from 'rxjs';
import { AuthService } from '../../services/auth/auth.service';
import { PostMark } from '../../models/posts/post-mark.model';
import { viewerState, ViewerState, withLike, withStance } from '../../models/posts/viewer-state';
import { InteractionsService } from '../../services/interactions/interactions.service';
import { ToastService } from '../../services/toast/toast.service';
import { ViewerStates } from '../../services/viewer-states/viewer-states';

/**
 * 👍, Interesuje mnie and Biorę udział in the map's preview, by the card's rules: one stance at a time, the change
 * shown at once and taken back if the server refuses, a guest's tap signing in.
 */
@Injectable({ providedIn: 'root' })
export class MapReactions {
  private interactions = inject(InteractionsService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private states = inject(ViewerStates);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);

  /** One request at a time, in order, so a quick second tap can't overtake the first. */
  private readonly requests = new Subject<Observable<unknown>>();

  constructor() {
    this.requests.pipe(concatMap((request) => request)).subscribe();
  }

  /** The mark as the viewer last left it, here or on a card. */
  shown(post: PostMark): PostMark {
    return this.states.shown(post);
  }

  like(post: PostMark): void {
    if (!this.signedIn()) {
      return;
    }
    const before = viewerState(this.shown(post));
    const liked = before.myReaction !== 'LIKE';
    this.states.change(post.id, withLike(before, liked));
    this.send(
      liked
        ? this.interactions.setReaction(post.id, { type: 'LIKE' })
        : this.interactions.removeReaction(post.id),
      before,
      post,
    );
  }

  /** Interesuje mnie or Biorę udział: on, off, or in place of the other. */
  stance(post: PostMark, type: 'INTERESTED' | 'TAKES_PART'): void {
    if (!this.signedIn()) {
      return;
    }
    const before = viewerState(this.shown(post));
    const next = before.myParticipation === type ? undefined : type;
    this.states.change(post.id, withStance(before, next));
    this.send(
      next
        ? this.interactions.setParticipation(post.id, { type: next })
        : this.interactions.removeParticipation(post.id),
      before,
      post,
      next ? () => this.toast.show(this.translate.instant('POST.saved-to-plans')) : undefined,
    );
  }

  private send(
    request: Observable<unknown>,
    before: ViewerState,
    post: PostMark,
    done?: () => void,
  ): void {
    this.requests.next(
      request.pipe(
        tap({ next: () => done?.(), error: () => this.states.change(post.id, before) }),
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
