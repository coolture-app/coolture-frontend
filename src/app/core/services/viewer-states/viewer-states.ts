import { inject, Injectable, linkedSignal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { catchError, concatMap, EMPTY, Observable, Subject, tap } from 'rxjs';
import { counted, ParticipationType } from '../../models/common/enums';
import { STANCE_SIGN_IN_REASONS } from '../../models/common/sign-in-reason';
import { viewerState, ViewerState, withLike, withStance } from '../../models/posts/viewer-state';
import { AuthService } from '../auth/auth.service';
import { InteractionsService } from '../interactions/interactions.service';
import { PostListStore } from '../post-list/post-list.store';
import { SignInPromptService } from '../sign-in-prompt/sign-in-prompt.service';
import { ToastService } from '../toast/toast.service';

/** A post as its card or pin shows it now. */
export type ShownPost = ViewerState & { id: string };

/** Called with each state a change shows, including the one a refusal brings back. */
export type ApplyState = (state: ViewerState) => void;

/**
 * The viewer's likes and stances, from a card, the post page or the map. A change shows at once and is taken back if
 * the server refuses it; a guest's tap asks them to sign in. The map keeps the marks it loaded for the whole visit,
 * so it shows its posts through `shown`, and every change reaches the home list's card of the same post.
 */
@Injectable({ providedIn: 'root' })
export class ViewerStates {
  private list = inject(PostListStore);
  private interactions = inject(InteractionsService);
  private signInPrompt = inject(SignInPromptService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);

  private auth = inject(AuthService);

  /** Starts empty again for another user. */
  private readonly changed = linkedSignal<string, ReadonlyMap<string, ViewerState>>({
    source: this.auth.userId,
    computation: () => new Map(),
  });

  /** One request at a time, in order, so a quick second tap or Cofnij can't overtake the first. */
  private readonly requests = new Subject<Observable<unknown>>();

  constructor() {
    this.requests.pipe(concatMap((request) => request)).subscribe();
  }

  /** The post as the viewer last left it. */
  shown<Post extends ShownPost>(post: Post): Post {
    const change = this.changed().get(post.id);
    return change ? { ...post, ...change } : post;
  }

  /** The note after a stance's name in its tooltip: why it's off, or that friends see it. A translation key. */
  stanceNote(ended: boolean): string | null {
    return ended
      ? 'POST.endedHint'
      : this.auth.isAuthenticated() && this.auth.shareStances()
        ? 'POST.friendsSee'
        : null;
  }

  /** False when a guest is asked to sign in instead. */
  like(post: ShownPost, apply?: ApplyState): boolean {
    if (!this.signInPrompt.allows('like')) {
      return false;
    }
    const liked = post.myReaction !== 'LIKE';
    this.send(
      post,
      withLike(viewerState(post), liked),
      [
        liked
          ? this.interactions.setReaction(post.id, { type: 'LIKE' })
          : this.interactions.removeReaction(post.id),
      ],
      apply,
    );
    return true;
  }

  /** On, off, or in place of the other. False when a guest is asked to sign in instead. */
  stance(post: ShownPost, type: ParticipationType, apply?: ApplyState): boolean {
    if (!this.signInPrompt.allows(STANCE_SIGN_IN_REASONS[type])) {
      return false;
    }
    const next = post.myParticipation === type ? undefined : type;
    this.send(
      post,
      withStance(viewerState(post), next),
      [this.stanceRequest(post.id, next)],
      apply,
      // The post leaves the feed on its next refresh, and this says where it went.
      counted(next)
        ? () => this.toast.show(this.translate.instant('POST.saved-to-plans'))
        : undefined,
    );
    return true;
  }

  /** Cofnij: back to a stance and like from before. False when a guest is asked to sign in instead. */
  restore(
    post: ShownPost,
    stance: ParticipationType | undefined,
    liked: boolean,
    apply?: ApplyState,
  ): boolean {
    if (!this.signInPrompt.allows('notForMe')) {
      return false;
    }
    const withStanceBack = withStance(viewerState(post), stance);
    const requests = [this.stanceRequest(post.id, stance)];
    if (liked && withStanceBack.myReaction !== 'LIKE') {
      requests.push(this.interactions.setReaction(post.id, { type: 'LIKE' }));
    }
    this.send(post, withLike(withStanceBack, liked), requests, apply);
    return true;
  }

  private stanceRequest(postId: string, type: ParticipationType | undefined): Observable<void> {
    return type
      ? this.interactions.setParticipation(postId, { type })
      : this.interactions.removeParticipation(postId);
  }

  /**
   * A refusal brings back the state from before, unless a later tap has already changed what this one set: the
   * later tap's own request decides then.
   */
  private send(
    post: ShownPost,
    after: ViewerState,
    requests: Observable<void>[],
    apply: ApplyState | undefined,
    done?: () => void,
  ): void {
    const before = viewerState(post);
    this.set(post.id, after, apply);
    const revert = () => {
      const now = this.shown(post);
      if (now.myReaction === after.myReaction && now.myParticipation === after.myParticipation) {
        this.set(post.id, before, apply);
      }
    };
    for (const request of requests) {
      this.requests.next(
        request.pipe(
          tap({ next: done, error: revert }),
          catchError(() => EMPTY),
        ),
      );
    }
  }

  private set(postId: string, state: ViewerState, apply: ApplyState | undefined): void {
    apply?.(state);
    this.changed.update((changed) => new Map(changed).set(postId, state));
    this.list.items.update((items) =>
      items.map((item) => (item.id === postId ? { ...item, ...state } : item)),
    );
  }
}
