import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { PostListStore } from './post-list.store';
import { AuthService } from '../auth/auth.service';
import { PostCard } from '../../models/posts/post-card.model';
import { PostDetail } from '../../models/posts/post-detail.model';
import { UserProfile } from '../../models/users/user-profile.model';

function card(id: string): PostCard {
  return {
    id,
    author: { id: 'u1', username: 'ola', followersCount: 0, followingCount: 0 },
    title: `Post ${id}`,
    startsAt: '2026-12-01T18:00:00Z',
    tags: [],
    positiveReactionCount: 0,
    negativeReactionCount: 0,
    participantCount: 0,
    commentsCount: 0,
    type: 'ONLINE',
    status: 'ACTIVE',
    visibility: 'PUBLIC',
    createdAt: '2026-11-01T00:00:00Z',
  };
}

function page(ids: string[], nextCursor?: string) {
  return {
    mode: 'RANKED',
    items: ids.map(card),
    page: { limit: 20, hasMore: !!nextCursor, ...(nextCursor && { nextCursor }) },
  };
}

describe('PostListStore', () => {
  let store: PostListStore;
  let http: HttpTestingController;

  /** The one request that must be open now, with exactly these parameters besides the limit. */
  function expectFeedRequest(params: Record<string, string> = {}) {
    const request = http.expectOne((r) => r.url.endsWith('/feed'));
    const sent = request.request.params;
    expect(Object.fromEntries(sent.keys().map((key) => [key, sent.get(key)]))).toEqual({
      limit: '20',
      ...params,
    });
    return request;
  }

  function ids(): string[] {
    return store.items().map((item) => item.id);
  }

  beforeEach(() => {
    store = TestBed.inject(PostListStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('paging', () => {
    it('appends pages, using the cursor, whatever the mode', () => {
      store.start({ kind: 'feed' });
      expect(store.loading()).toBeTrue();
      expectFeedRequest().flush(page(['a', 'b'], 'c1'));

      expect(store.loading()).toBeFalse();

      store.loadMore();
      expectFeedRequest({ cursor: 'c1' }).flush({ ...page(['c']), mode: 'UPCOMING' });

      expect(ids()).toEqual(['a', 'b', 'c']);
    });

    it('sends the location on the first page only', () => {
      store.start({ kind: 'feed', location: { latitude: 54.35, longitude: 18.65 } });
      expectFeedRequest({ latitude: '54.35', longitude: '18.65' }).flush(page(['a'], 'c1'));

      store.loadMore();

      expectFeedRequest({ cursor: 'c1' }).flush(page(['b']));
    });

    it('sends the filters with every /posts page', () => {
      store.start({ kind: 'posts', filters: { q: 'jazz', sortBy: 'POPULAR' } });
      const first = http.expectOne((r) => r.url.endsWith('/posts'));
      expect(first.request.params.get('q')).toBe('jazz');
      expect(first.request.params.get('sortBy')).toBe('POPULAR');
      first.flush(page(['a'], 'c1'));

      store.loadMore();

      const second = http.expectOne((r) => r.url.endsWith('/posts'));
      expect(second.request.params.get('q')).toBe('jazz');
      expect(second.request.params.get('sortBy')).toBe('POPULAR');
      expect(second.request.params.get('cursor')).toBe('c1');
      second.flush({ items: [card('b')], page: { limit: 20, hasMore: false } });
    });

    it('drops posts it already holds', () => {
      store.start({ kind: 'feed' });
      expectFeedRequest().flush(page(['a', 'b'], 'c1'));

      store.loadMore();
      expectFeedRequest({ cursor: 'c1' }).flush(page(['b', 'c', 'a']));

      expect(ids()).toEqual(['a', 'b', 'c']);
    });

    it('sends one request at a time', () => {
      store.start({ kind: 'feed' });
      store.loadMore();
      store.loadMore();

      expectFeedRequest().flush(page(['a'], 'c1'));
    });

    it('fetches again by itself when a page adds nothing', () => {
      store.start({ kind: 'feed' });
      expectFeedRequest().flush(page(['a'], 'c1'));

      store.loadMore();
      expectFeedRequest({ cursor: 'c1' }).flush(page(['a'], 'c2'));

      expect(store.loading()).toBeTrue();
      expectFeedRequest({ cursor: 'c2' }).flush(page([], 'c3'));
      expectFeedRequest({ cursor: 'c3' }).flush(page(['b']));
      expect(ids()).toEqual(['a', 'b']);
      expect(store.loading()).toBeFalse();
    });

    it('ends only on hasMore false, not on a short or empty page', () => {
      store.start({ kind: 'feed' });
      expectFeedRequest().flush(page(['a'], 'c1'));
      expect(store.hasMore()).toBeTrue();

      store.loadMore();
      expectFeedRequest({ cursor: 'c1' }).flush(page([]));

      expect(store.hasMore()).toBeFalse();
      expect(store.failed()).toBeFalse();
      store.loadMore();
    });

    it('stops with a retry if the API keeps returning the same cursor', () => {
      store.start({ kind: 'feed' });
      expectFeedRequest().flush(page(['a'], 'c1'));

      store.loadMore();
      expectFeedRequest({ cursor: 'c1' }).flush(page(['a'], 'c1'));

      expect(store.failed()).toBeTrue();
    });

    it('ignores the answer to a request it has moved on from', () => {
      store.start({ kind: 'feed' });
      const old = expectFeedRequest();

      store.start({ kind: 'posts', filters: { q: 'jazz' } });

      expect(old.cancelled).toBeTrue();
      http.expectOne((r) => r.url.endsWith('/posts')).flush(page(['p']));
      expect(ids()).toEqual(['p']);
    });

    it('starts a new list empty, with nothing remembered', () => {
      store.start({ kind: 'feed' });
      expectFeedRequest().flush(page(['a']));

      store.refresh();
      expect(ids()).toEqual([]);
      expectFeedRequest().flush(page(['a']));

      expect(ids()).toEqual(['a']);
    });
  });

  describe('errors', () => {
    const badRequest = { status: 400, statusText: 'Bad Request' };
    const serverError = { status: 500, statusText: 'Server Error' };

    it('restarts once from page 1 on a 400, keeping what is shown', () => {
      store.start({ kind: 'feed' });
      expectFeedRequest().flush(page(['a', 'b'], 'stale'));

      store.loadMore();
      expectFeedRequest({ cursor: 'stale' }).flush({ error: 'bad cursor' }, badRequest);

      expect(ids()).toEqual(['a', 'b']);
      expect(store.failed()).toBeFalse();
      expectFeedRequest().flush(page(['a', 'b', 'c']));
      expect(ids()).toEqual(['a', 'b', 'c']);
    });

    it('stops on a second 400, and shows the retry, so it cannot loop', () => {
      store.start({ kind: 'feed' });
      expectFeedRequest().flush({ error: 'bad' }, badRequest);
      expectFeedRequest().flush({ error: 'bad' }, badRequest);

      expect(store.failed()).toBeTrue();
      expect(store.loading()).toBeFalse();
    });

    it('cannot loop either if the 400 comes back after a good page', () => {
      store.start({ kind: 'feed' });
      expectFeedRequest().flush(page(['a'], 'c1'));
      store.loadMore();
      expectFeedRequest({ cursor: 'c1' }).flush({ error: 'bad' }, badRequest);
      expectFeedRequest().flush(page(['a'], 'c1'));
      store.loadMore();
      expectFeedRequest({ cursor: 'c1' }).flush({ error: 'bad' }, badRequest);

      expect(store.failed()).toBeTrue();
    });

    it('keeps what is shown on a 500, and retries the same page', () => {
      store.start({ kind: 'feed' });
      expectFeedRequest().flush(page(['a'], 'c1'));
      store.loadMore();
      expectFeedRequest({ cursor: 'c1' }).flush({ error: 'down' }, serverError);

      expect(store.failed()).toBeTrue();
      expect(ids()).toEqual(['a']);

      store.loadMore();

      store.retry();
      expect(store.failed()).toBeFalse();
      expectFeedRequest({ cursor: 'c1' }).flush(page(['b']));
      expect(ids()).toEqual(['a', 'b']);
    });
  });

  describe('changes made elsewhere', () => {
    beforeEach(() => {
      store.start({ kind: 'feed' });
      expectFeedRequest().flush(page(['a', 'b']));
    });

    it('updates a card from the post page, including a removed reaction', () => {
      const liked = { ...card('a'), myReaction: 'LIKE' as const };
      store.items.set([liked, card('b')]);

      store.updateItem({ ...card('a'), positiveReactionCount: 7, media: [] } as PostDetail);

      expect(store.items()[0].positiveReactionCount).toBe(7);
      expect(store.items()[0].myReaction).toBeUndefined();
      expect('media' in store.items()[0]).toBeFalse();
      expect(store.items()[1].id).toBe('b');
    });

    it('removes a card', () => {
      store.removeItem('a');

      expect(ids()).toEqual(['b']);
    });
  });

  describe('when the user changes', () => {
    function signIn(id: string | null): void {
      TestBed.inject(AuthService).currentUser.set(id ? ({ id } as UserProfile) : null);
      TestBed.tick();
    }

    it('clears the list when a known user signs out or becomes someone else', () => {
      for (const next of [null, 'someone-else']) {
        signIn('me');
        store.start({ kind: 'feed' });
        expectFeedRequest().flush(page(['a']));

        signIn(next);

        expect(store.query()).toBeNull();
        expect(ids()).toEqual([]);
      }
    });

    it('cancels a request still on its way for the old user', () => {
      signIn('me');
      store.start({ kind: 'feed' });
      const pending = expectFeedRequest();

      signIn(null);

      expect(pending.cancelled).toBeTrue();
    });

    it('keeps the list when /auth/me answers after the first page, as on every page load', () => {
      store.start({ kind: 'feed' });
      expectFeedRequest().flush(page(['a']));

      signIn('me');

      expect(store.query()).toEqual({ kind: 'feed' });
      expect(ids()).toEqual(['a']);
    });
  });
});
