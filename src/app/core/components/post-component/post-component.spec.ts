import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { PostComponent } from './post-component';
import { PostCard } from '../../models/posts/post-card.model';

function card(overrides: Partial<PostCard> = {}): PostCard {
  return {
    id: 'p1',
    author: { id: 'u1', username: 'ola', followersCount: 0, followingCount: 0 },
    title: 'Koncert',
    startsAt: '2026-12-01T18:00:00Z',
    tags: [],
    positiveReactionCount: 3,
    negativeReactionCount: 0,
    participantCount: 2,
    commentsCount: 0,
    type: 'OFFLINE',
    status: 'ACTIVE',
    visibility: 'PUBLIC',
    createdAt: '2026-11-01T00:00:00Z',
    ...overrides,
  };
}

describe('PostComponent', () => {
  let component: PostComponent;
  let fixture: ComponentFixture<PostComponent>;
  let http: HttpTestingController;

  function render(data: PostCard, isFullView = false): void {
    fixture.componentRef.setInput('data', data);
    fixture.componentRef.setInput('isFullView', isFullView);
    fixture.detectChanges();
  }

  function element(): HTMLElement {
    return fixture.nativeElement;
  }

  function place(): string | undefined {
    return element().querySelector('.post__location')?.textContent?.trim();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PostComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('renders an author with no first or last name', () => {
    expect(() => render(card())).not.toThrow();
  });

  describe('description', () => {
    it('renders a post with no description', () => {
      expect(() => render(card())).not.toThrow();
    });

    it('offers more only when there is more', () => {
      render(card({ description: 'Krótki opis' }));

      expect(element().querySelector('.post__desc')?.textContent?.trim()).toBe('Krótki opis');
      expect(element().querySelector('.post__desc-action')).toBeNull();
    });

    it('cuts a long description on a card', () => {
      render(card({ description: 'x'.repeat(151) }));

      expect(element().querySelector('.post__desc')?.textContent).toContain('...');
      expect(element().querySelector('.post__desc-action')).not.toBeNull();
    });
  });

  describe('place', () => {
    const location = {
      id: 'l1',
      coordinates: { latitude: 54, longitude: 18 },
      venueName: 'Ergo Arena',
      street: 'Plac Dwóch Miast',
      buildingNum: '1',
      city: 'Gdańsk',
    };

    it('shows venue and city on a card', () => {
      render(card({ location }));

      expect(place()).toBe('Ergo Arena, Gdańsk');
    });

    it('adds the address on the post page', () => {
      render(card({ location }), true);

      expect(place()).toBe('Ergo Arena, Plac Dwóch Miast 1, Gdańsk');
    });

    it('shows Online for an online post', () => {
      render(card({ type: 'ONLINE' }));

      expect(place()).toBe('POST.online');
    });

    it('shows nothing when an in-person post has no address', () => {
      render(card());

      expect(place()).toBeUndefined();
    });
  });

  describe('interactions keep the data in step, for when the card is shown again', () => {
    const serverError = { status: 500, statusText: 'Server Error' };

    it('records a like, and removes it again', () => {
      const data = card();
      render(data);

      component.likePost();
      http.expectOne((r) => r.method === 'PUT' || r.method === 'POST').flush({});
      expect(data.myReaction).toBe('LIKE');
      expect(data.positiveReactionCount).toBe(4);

      component.likePost();
      http.expectOne((r) => r.method === 'DELETE').flush(null);
      expect(data.myReaction).toBeUndefined();
      expect(data.positiveReactionCount).toBe(3);
      expect(component.isLiked()).toBeFalse();
    });

    it('undoes a like that failed', () => {
      const data = card();
      render(data);

      component.likePost();
      http
        .expectOne((r) => r.method === 'PUT' || r.method === 'POST')
        .flush({ error: 'down' }, serverError);

      expect(data.myReaction).toBeUndefined();
      expect(data.positiveReactionCount).toBe(3);
      expect(component.isLiked()).toBeFalse();
    });

    it('moves between interested and attending without counting the person twice', () => {
      const data = card();
      render(data);

      component.setInterested();
      http.expectOne((r) => r.method === 'PUT' || r.method === 'POST').flush({});
      expect(data.myParticipation).toBe('INTERESTED');
      expect(data.participantCount).toBe(3);

      component.setTakesPart();
      http.expectOne((r) => r.method === 'PUT' || r.method === 'POST').flush({});
      expect(data.myParticipation).toBe('TAKES_PART');
      expect(data.participantCount).toBe(3);
      expect(component.isInterested()).toBeFalse();
      expect(component.isTakesPart()).toBeTrue();

      component.setTakesPart();
      http.expectOne((r) => r.method === 'DELETE').flush(null);
      expect(data.myParticipation).toBeUndefined();
      expect(data.participantCount).toBe(2);
    });

    it('returns to the previous participation when a change fails', () => {
      const data = card({ myParticipation: 'INTERESTED' });
      render(data);

      component.setTakesPart();
      http
        .expectOne((r) => r.method === 'PUT' || r.method === 'POST')
        .flush({ error: 'down' }, serverError);

      expect(data.myParticipation).toBe('INTERESTED');
      expect(data.participantCount).toBe(2);
      expect(component.isInterested()).toBeTrue();
    });

    it('does not fail on a post with no location', () => {
      render(card());

      expect(component.place).toBe('');
    });
  });
});
