import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { PostComponent } from './post-component';
import { PostCard } from '../../models/posts/post-card.model';
import { AuthService } from '../../services/auth/auth.service';
import { UserProfile } from '../../models/users/user-profile.model';
import { ToastService } from '../../services/toast/toast.service';

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

  it('offers edit and delete only on your own post', () => {
    render(card());

    expect(element().querySelector('.post__owner-actions')).toBeNull();
  });

  it('offers them on your own post, with names for assistive technology', () => {
    TestBed.inject(AuthService).currentUser.set({ id: 'u1' } as UserProfile);
    render(card());

    const actions = element().querySelectorAll('.post__owner-actions button');
    expect(Array.from(actions).map((b) => b.getAttribute('aria-label'))).toEqual([
      'POST.edit',
      'POST.delete',
    ]);
  });

  it('has four icon actions, each named and pressed when on, and no Share', () => {
    render(card({ myParticipation: 'TAKES_PART' }));

    const actions = Array.from(element().querySelectorAll('.post__social button'));
    expect(actions.map((b) => b.getAttribute('aria-label'))).toEqual([
      'POST.like',
      'POST.comments',
      'POST.interested',
      'POST.takes_part',
    ]);
    expect(actions.map((b) => b.getAttribute('aria-pressed'))).toEqual([
      'false',
      null,
      'false',
      'true',
    ]);
    expect(actions.every((b) => b.textContent!.trim() === '')).toBeTrue();
  });

  describe('photo', () => {
    function loaded(naturalWidth: number, naturalHeight: number): void {
      const data = card({ coverMedia: { id: 'm1', url: 'http://x/p.png' } });
      render(data);
      component.photoLoaded('http://x/p.png', {
        target: { naturalWidth, naturalHeight },
      } as unknown as Event);
      fixture.detectChanges();
    }

    function image(): HTMLImageElement {
      return element().querySelector('.post__photo-item img')!;
    }

    it('is hidden until loaded, so a broken one shows no icon', () => {
      render(card({ coverMedia: { id: 'm1', url: 'http://x/p.png' } }));

      expect(image().classList).not.toContain('is-loaded');
    });

    it('crops one close to the shape of the frame', () => {
      loaded(1600, 900);

      expect(image().classList).toContain('is-loaded');
      expect(image().classList).not.toContain('is-contained');
    });

    it('shows a portrait poster or a panorama whole', () => {
      loaded(900, 1200);
      expect(image().classList).toContain('is-contained');
    });

    it('shows a panorama whole', () => {
      loaded(3000, 1000);
      expect(image().classList).toContain('is-contained');
    });
  });

  describe('description', () => {
    const LONG = `Pierwszy akapit opisu wydarzenia.${String.fromCharCode(10)}${'Drugi akapit, dużo dłuższy. '.repeat(60)}`;

    async function measured(): Promise<void> {
      await new Promise((resolve) => setTimeout(resolve, 50));
      await fixture.whenStable();
    }

    function text(): HTMLElement {
      return element().querySelector<HTMLElement>('.post__desc-text')!;
    }

    function toggle(): HTMLButtonElement | null {
      return element().querySelector('.post__desc-toggle');
    }

    it('renders a post with no description, without an empty block', () => {
      render(card());

      expect(element().querySelector('.post__desc')).toBeNull();
    });

    it('offers no toggle for a text that fits', async () => {
      render(card({ description: 'Krótki opis' }));
      await measured();

      expect(text().textContent?.trim()).toBe('Krótki opis');
      expect(toggle()).toBeNull();
    });

    it('clamps by lines, keeps the paragraphs and shows the whole text in the DOM', async () => {
      render(card({ description: LONG }));
      await measured();

      expect(getComputedStyle(text()).whiteSpace).toBe('pre-line');
      expect(text().clientHeight).toBeLessThan(text().scrollHeight);
      expect(text().textContent?.trim()).toBe(LONG.trim());
      expect(toggle()?.textContent).toContain('POST.show-more');
    });

    it('showing the toggle does not change the height of the card', async () => {
      render(card({ description: LONG }));
      const before = element().getBoundingClientRect().height;
      await measured();

      expect(toggle()).not.toBeNull();
      expect(element().getBoundingClientRect().height).toBe(before);
    });

    it('expands and collapses, and says which it is', async () => {
      render(card({ description: LONG }));
      await measured();
      const clamped = text().clientHeight;

      toggle()!.click();
      await measured();
      expect(text().clientHeight).toBeGreaterThan(clamped);
      expect(toggle()?.getAttribute('aria-expanded')).toBe('true');
      expect(toggle()?.textContent).toContain('POST.show-less');

      toggle()!.click();
      await measured();
      expect(text().clientHeight).toBe(clamped);
      expect(toggle()?.getAttribute('aria-expanded')).toBe('false');
    });

    it('stays expanded when the same post is shown again, as on coming back to the list', async () => {
      const data = card({ id: 'shown-again', description: LONG });
      render(data);
      await measured();
      toggle()!.click();
      await measured();

      const again = TestBed.createComponent(PostComponent);
      again.componentRef.setInput('data', data);
      again.componentRef.setInput('isFullView', false);
      again.detectChanges();

      expect(again.componentInstance.isExpanded()).toBeTrue();
      expect(again.nativeElement.querySelector('.post__desc-text--clamped')).toBeNull();
    });

    it('stays expanded when the card is replaced by the copy from the post page', async () => {
      const data = card({ id: 'replaced', description: LONG });
      render(data);
      await measured();
      toggle()!.click();
      await measured();

      const again = TestBed.createComponent(PostComponent);
      again.componentRef.setInput('data', { ...data });
      again.componentRef.setInput('isFullView', false);
      again.detectChanges();

      expect(again.componentInstance.isExpanded()).toBeTrue();
    });

    it('collapses runs of blank lines into one, and keeps the paragraphs', () => {
      const lf = String.fromCharCode(10);
      render(card({ description: `Jeden.  ${lf}${lf}${lf}${lf}Dwa.${lf}Trzy.` }));

      expect(component.description).toBe(`Jeden.${lf}${lf}Dwa.${lf}Trzy.`);
    });

    it('cuts at 6 lines without a photo, and at 3 with one', async () => {
      render(card({ description: LONG }));
      await measured();
      const lineHeight = parseFloat(getComputedStyle(text()).lineHeight);
      expect(Math.round(text().clientHeight / lineHeight)).toBe(6);

      const withPhoto = TestBed.createComponent(PostComponent);
      const photo = { id: 'm', url: 'http://x/p.png' };
      withPhoto.componentRef.setInput(
        'data',
        card({ id: 'p2', description: LONG, coverMedia: photo }),
      );
      withPhoto.componentRef.setInput('isFullView', false);
      withPhoto.detectChanges();
      const clamped = withPhoto.nativeElement.querySelector('.post__desc-text') as HTMLElement;
      expect(Math.round(clamped.clientHeight / lineHeight)).toBe(3);
    });

    it('shows the whole text with no toggle on the post page', async () => {
      render(card({ description: LONG }), true);
      await measured();

      expect(element().querySelector('.post__desc-text--clamped')).toBeNull();
      expect(toggle()).toBeNull();
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

    it('says the post is saved in Plans when it is marked, and not when it is unmarked', () => {
      const toast = TestBed.inject(ToastService);
      const data = card();
      render(data);

      component.setInterested();
      http.expectOne((r) => r.method === 'PUT' || r.method === 'POST').flush({});
      expect(toast.message()).toBe('POST.saved-to-plans');

      toast.message.set(null);
      component.setInterested();
      http.expectOne((r) => r.method === 'DELETE').flush(null);
      expect(toast.message()).toBeNull();
    });

    it('does not fail on a post with no location', () => {
      render(card());

      expect(component.place).toBe('');
    });
  });
});
