import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { MapReactions } from './map-reactions';
import { mark } from './map-stubs.testing';
import { AuthService } from '../../services/auth/auth.service';
import { PostListStore } from '../../services/post-list/post-list.store';
import { ViewerStates } from '../../services/viewer-states/viewer-states';
import { PostCard } from '../../models/posts/post-card.model';
import { SignInPromptService } from '../../services/sign-in-prompt/sign-in-prompt.service';

describe('MapReactions', () => {
  let reactions: MapReactions;
  let http: HttpTestingController;
  const signedIn = signal(true);
  const userId = signal('u1');
  const post = { ...mark('a'), interestedCount: 2, goingCount: 1 };

  beforeEach(() => {
    signedIn.set(true);
    userId.set('u1');
    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: { isAuthenticated: signedIn, userId } }],
    });
    reactions = TestBed.inject(MapReactions);
    http = TestBed.inject(HttpTestingController);
  });

  it('likes at once, and takes it back when the server refuses', () => {
    reactions.like(post);
    expect(reactions.shown(post)).toEqual(
      jasmine.objectContaining({ myReaction: 'LIKE', positiveReactionCount: 1 }),
    );

    http
      .expectOne((r) => r.method === 'PUT' && r.url.endsWith('/posts/a/reaction'))
      .flush(null, { status: 500, statusText: 'down' });
    expect(reactions.shown(post)).toEqual(
      jasmine.objectContaining({ myReaction: undefined, positiveReactionCount: 0 }),
    );
  });

  it('keeps one stance at a time, with both counts in step', () => {
    reactions.stance(post, 'INTERESTED');
    reactions.stance(post, 'TAKES_PART');

    expect(reactions.shown(post)).toEqual(
      jasmine.objectContaining({
        myParticipation: 'TAKES_PART',
        interestedCount: 2,
        goingCount: 2,
      }),
    );
    http.match(() => true).forEach((r) => r.flush(null));
  });

  it("changes the list's card of the same post too, its two counts and their sum", () => {
    const list = TestBed.inject(PostListStore);
    list.items.set([
      { id: 'a', positiveReactionCount: 0, participantCount: 3 } as PostCard,
      { id: 'b', positiveReactionCount: 0, participantCount: 0 } as PostCard,
    ]);

    reactions.like(post);
    reactions.stance(post, 'INTERESTED');

    expect(list.items()[0]).toEqual(
      jasmine.objectContaining({
        myReaction: 'LIKE',
        myParticipation: 'INTERESTED',
        positiveReactionCount: 1,
        interestedCount: 3,
        goingCount: 1,
        participantCount: 4,
      }),
    );
    expect(list.items()[1].positiveReactionCount).toBe(0);
    http.match(() => true).forEach((r) => r.flush(null));
  });

  it('shows a like made on a card, and the next tap takes it back', () => {
    TestBed.inject(ViewerStates).remember('a', {
      ...post,
      myReaction: 'LIKE',
      positiveReactionCount: 1,
    });

    expect(reactions.shown(post).myReaction).toBe('LIKE');

    reactions.like(post);

    expect(reactions.shown(post)).toEqual(
      jasmine.objectContaining({ myReaction: undefined, positiveReactionCount: 0 }),
    );
    http.expectOne((r) => r.method === 'DELETE' && r.url.endsWith('/posts/a/reaction')).flush(null);
  });

  it("forgets one user's changes for the next", () => {
    reactions.like(post);
    http.match(() => true).forEach((r) => r.flush(null));

    userId.set('u2');

    expect(reactions.shown(post)).toBe(post);
  });

  it('asks a guest to sign in instead', () => {
    signedIn.set(false);

    reactions.like(post);

    expect(TestBed.inject(SignInPromptService).reason()).toBe('like');
    expect(reactions.shown(post)).toBe(post);
    http.expectNone(() => true);
  });
});
