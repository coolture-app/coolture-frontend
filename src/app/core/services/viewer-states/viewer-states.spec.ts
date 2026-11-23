import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { ViewerStates } from './viewer-states';
import { mark } from '../../components/map/map-stubs.testing';
import { AuthService } from '../auth/auth.service';
import { PostListStore } from '../post-list/post-list.store';
import { PostCard } from '../../models/posts/post-card.model';
import { SignInPromptService } from '../sign-in-prompt/sign-in-prompt.service';

describe('ViewerStates', () => {
  let states: ViewerStates;
  let http: HttpTestingController;
  const signedIn = signal(true);
  const userId = signal('u1');
  const post = { ...mark('a'), interestedCount: 2, goingCount: 1 };
  const refused = { status: 500, statusText: 'down' };

  beforeEach(() => {
    signedIn.set(true);
    userId.set('u1');
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: { isAuthenticated: signedIn, userId, shareStances: signal(true) },
        },
      ],
    });
    states = TestBed.inject(ViewerStates);
    http = TestBed.inject(HttpTestingController);
  });

  it('likes at once, and takes it back when the server refuses', () => {
    const shown: unknown[] = [];
    states.like(post, (state) => shown.push(state.myReaction));
    expect(states.shown(post)).toEqual(
      jasmine.objectContaining({ myReaction: 'LIKE', positiveReactionCount: 1 }),
    );

    http
      .expectOne((r) => r.method === 'PUT' && r.url.endsWith('/posts/a/reaction'))
      .flush(null, refused);
    expect(states.shown(post)).toEqual(
      jasmine.objectContaining({ myReaction: undefined, positiveReactionCount: 0 }),
    );
    expect(shown).toEqual(['LIKE', undefined]);
  });

  it('takes back "Nie dla mnie" when the post is liked, as the server does', () => {
    states.like({ ...post, myParticipation: 'NOT_INTERESTED' });

    expect(states.shown(post)).toEqual(
      jasmine.objectContaining({
        myReaction: 'LIKE',
        myParticipation: undefined,
        positiveReactionCount: 1,
      }),
    );
    http.match(() => true).forEach((r) => r.flush(null));
  });

  it('keeps one stance at a time, with both counts in step', () => {
    states.stance(post, 'INTERESTED');
    states.stance(states.shown(post), 'TAKES_PART');

    expect(states.shown(post)).toEqual(
      jasmine.objectContaining({
        myParticipation: 'TAKES_PART',
        interestedCount: 2,
        goingCount: 2,
      }),
    );
    http.match(() => true).forEach((r) => r.flush(null));
  });

  it('leaves a later tap alone when an earlier one is refused', () => {
    states.stance(post, 'INTERESTED');
    states.stance(states.shown(post), 'TAKES_PART');

    http.expectOne((r) => r.method === 'PUT').flush(null, refused);
    http.expectOne((r) => r.method === 'PUT').flush(null);

    expect(states.shown(post)).toEqual(
      jasmine.objectContaining({
        myParticipation: 'TAKES_PART',
        interestedCount: 2,
        goingCount: 2,
      }),
    );
  });

  it('brings back a stance and the like for Cofnij, stance first', () => {
    states.restore({ ...post, myParticipation: 'NOT_INTERESTED' }, 'INTERESTED', true);

    expect(states.shown(post)).toEqual(
      jasmine.objectContaining({
        myReaction: 'LIKE',
        myParticipation: 'INTERESTED',
        positiveReactionCount: 1,
        interestedCount: 3,
      }),
    );
    const stance = http.expectOne((r) => r.url.endsWith('/participation'));
    expect(stance.request.body).toEqual({ type: 'INTERESTED' });
    http.expectNone((r) => r.url.endsWith('/reaction'));
    stance.flush(null);
    http.expectOne((r) => r.method === 'PUT' && r.url.endsWith('/reaction')).flush(null);
  });

  it("changes the list's card of the same post too", () => {
    const list = TestBed.inject(PostListStore);
    list.items.set([
      { id: 'a', positiveReactionCount: 0 } as PostCard,
      { id: 'b', positiveReactionCount: 0 } as PostCard,
    ]);

    states.like(post);
    states.stance(states.shown(post), 'INTERESTED');

    expect(list.items()[0]).toEqual(
      jasmine.objectContaining({
        myReaction: 'LIKE',
        myParticipation: 'INTERESTED',
        positiveReactionCount: 1,
        interestedCount: 3,
        goingCount: 1,
      }),
    );
    expect(list.items()[1].positiveReactionCount).toBe(0);
    http.match(() => true).forEach((r) => r.flush(null));
  });

  it("forgets one user's changes for the next", () => {
    states.like(post);
    http.match(() => true).forEach((r) => r.flush(null));

    userId.set('u2');

    expect(states.shown(post)).toBe(post);
  });

  it('asks a guest to sign in instead', () => {
    signedIn.set(false);

    expect(states.like(post)).toBeFalse();

    expect(TestBed.inject(SignInPromptService).reason()).toBe('like');
    expect(states.shown(post)).toBe(post);
    http.expectNone(() => true);
  });
});
