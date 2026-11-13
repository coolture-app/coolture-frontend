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
    tags: [],
    positiveReactionCount: 0,
    participantCount: 0,
    commentsCount: 0,
    type: 'ONLINE',
    status: 'ACTIVE',
    visibility: 'PUBLIC',
    createdAt: '2026-11-01T00:00:00Z',
  };
}

describe('MyEventsView', () => {
  let fixture: ComponentFixture<MyEventsView>;
  let http: HttpTestingController;

  function page(ids: string[]) {
    return { items: ids.map(card), page: { limit: 20, hasMore: false } };
  }

  function requests(): TestRequest[] {
    return http.match((r) => r.url.endsWith('/posts'));
  }

  function shown(): string[] {
    return fixture.componentInstance.posts().items.map((post) => post.id);
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
});
