import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { MapReactions } from './map-reactions';
import { mark } from './map-stubs.testing';
import { AuthService } from '../../services/auth/auth.service';
import { PostListStore } from '../../services/post-list/post-list.store';
import { PostCard } from '../../models/posts/post-card.model';

describe('MapReactions', () => {
  let reactions: MapReactions;
  let http: HttpTestingController;
  const signedIn = signal(true);
  const login = jasmine.createSpy('login');
  const post = { ...mark('a'), interestedCount: 2, goingCount: 1 };

  beforeEach(() => {
    signedIn.set(true);
    login.calls.reset();
    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: { isAuthenticated: signedIn, login } }],
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

  it("changes the list's card of the same post too", () => {
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
        participantCount: 4,
      }),
    );
    expect(list.items()[1].positiveReactionCount).toBe(0);
    http.match(() => true).forEach((r) => r.flush(null));
  });

  it('signs a guest in instead', () => {
    signedIn.set(false);

    reactions.like(post);

    expect(login).toHaveBeenCalled();
    expect(reactions.shown(post)).toBe(post);
    http.expectNone(() => true);
  });
});
