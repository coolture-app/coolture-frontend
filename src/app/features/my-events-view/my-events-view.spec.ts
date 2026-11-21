import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { MyEventsView } from './my-events-view';
import { PostCard } from '../../core/models/posts/post-card.model';

function card(id: string): PostCard {
  return {
    id,
    author: { id: 'u1', username: 'ola', followersCount: 0, followingCount: 0 },
    title: `Post ${id}`,
    startsAt: '2026-12-01T18:00:00Z',
    openEnded: false,
    positiveReactionCount: 0,
    participantCount: 0,
    interestedCount: 0,
    goingCount: 0,
    commentsCount: 0,
    type: 'ONLINE',
    status: 'ACTIVE',
    createdAt: '2026-11-01T00:00:00Z',
  };
}

describe('MyEventsView', () => {
  let fixture: ComponentFixture<MyEventsView>;
  let http: HttpTestingController;

  function page(ids: string[], nextCursor?: string) {
    return { items: ids.map(card), page: { limit: 20, hasMore: !!nextCursor, nextCursor } };
  }

  function requests(): TestRequest[] {
    return http.match((r) => r.url.endsWith('/posts'));
  }

  function shown(): string[] {
    return fixture.componentInstance.list.items().map((post) => post.id);
  }

  beforeEach(() => {
    fixture = TestBed.createComponent(MyEventsView);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('asks for both kinds of plans at first', () => {
    const [request] = requests();

    expect(request.request.params.getAll('participationTypes')).toEqual([
      'INTERESTED',
      'TAKES_PART',
    ]);
    request.flush(page(['a']));
    expect(shown()).toEqual(['a']);
  });

  it('shows the last tab picked, even when an earlier answer would come later', () => {
    requests()[0].flush(page(['all']));

    fixture.componentInstance.setFilter('INTERESTED');
    fixture.componentInstance.setFilter('TAKES_PART');
    const [interested, takesPart] = requests();

    expect(interested.cancelled).toBeTrue();
    takesPart.flush(page(['going']));
    expect(shown()).toEqual(['going']);
  });

  it('goes past the first page, with the same plans', () => {
    requests()[0].flush(page(['a'], 'next'));

    fixture.componentInstance.list.loadMore();
    const [second] = requests();

    expect(second.request.params.get('cursor')).toBe('next');
    second.flush(page(['b']));
    expect(shown()).toEqual(['a', 'b']);
    expect(fixture.componentInstance.list.canLoadMore()).toBeFalse();
  });

  it('offers a retry when plans fail to load', () => {
    requests()[0].flush(null, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    const alert = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement;
    expect(alert.textContent).toContain('MY_EVENTS.load-error');
    alert.querySelector('button')!.click();
    requests()[0].flush(page(['a']));
    expect(shown()).toEqual(['a']);
  });
});
