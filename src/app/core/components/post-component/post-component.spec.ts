import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { CommentsSheetService } from '../../services/comments-sheet/comments-sheet.service';
import { HttpTestingController } from '@angular/common/http/testing';

import { PostComponent } from './post-component';
import { PostCard } from '../../models/posts/post-card.model';
import { AuthService } from '../../services/auth/auth.service';
import { UserProfile } from '../../models/users/user-profile.model';
import { ToastService } from '../../services/toast/toast.service';
import { PhotoViewerService } from '../../services/photo-viewer/photo-viewer.service';
import { PostDetail } from '../../models/posts/post-detail.model';

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

  function render(data: PostCard | PostDetail, isFullView = false): void {
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

  describe('the like count', () => {
    function badge(): string | undefined {
      return element().querySelector('[aria-label^="POST.like"] .post__count')?.textContent?.trim();
    }

    it('shows on the like icon, and says it in the button’s name, with none at 0', () => {
      render(card({ positiveReactionCount: 0 }));
      expect(badge()).toBeUndefined();

      render(card({ positiveReactionCount: 7 }));
      expect(badge()).toBe('7');
      expect(element().querySelector('[aria-label="POST.like (7)"]')).not.toBeNull();
    });

    it('caps a long count', () => {
      render(card({ positiveReactionCount: 100 }));

      expect(badge()).toBe('99+');
    });

    it('has no count on the bookmark or the ticket, as the API sends only their sum', () => {
      render(card({ participantCount: 5 }));

      expect(element().querySelector('[aria-label="POST.interested"] .post__count')).toBeNull();
      expect(element().querySelector('[aria-label="POST.takes_part"] .post__count')).toBeNull();
    });
  });

  describe('the comment button', () => {
    function commentButton(): HTMLButtonElement {
      return element().querySelector('[aria-label="POST.comments"]') as HTMLButtonElement;
    }

    function badge(): string | undefined {
      return element()
        .querySelector('[aria-label^="POST.comments"] .post__count')
        ?.textContent?.trim();
    }

    it('shows no count with no comments', () => {
      render(card({ commentsCount: 0 }));

      expect(badge()).toBeUndefined();
      expect(commentButton()).not.toBeNull();
    });

    it('shows the count on the icon, and says it in the button’s name', () => {
      render(card({ commentsCount: 12 }));

      expect(badge()).toBe('12');
      expect(element().querySelector('[aria-label="POST.comments (12)"]')).not.toBeNull();
    });

    it('caps a long count, and still says the exact number', () => {
      render(card({ commentsCount: 1234 }));

      expect(badge()).toBe('99+');
      expect(element().querySelector('[aria-label="POST.comments (1234)"]')).not.toBeNull();
    });

    it('follows the count while this post’s comments are open', async () => {
      const data = card({ commentsCount: 2 });
      render(data);
      const sheet = TestBed.inject(CommentsSheetService);

      sheet.show(data);
      sheet.changeCount(1);
      await fixture.whenStable();
      expect(badge()).toBe('3');

      sheet.close();
      await fixture.whenStable();
      expect(badge()).toBe('3');
    });

    it('isn’t changed by another post’s comments being open', async () => {
      render(card({ commentsCount: 2 }));
      const sheet = TestBed.inject(CommentsSheetService);

      sheet.show(card({ id: 'other', commentsCount: 9 }));
      await fixture.whenStable();

      expect(badge()).toBe('2');
      sheet.close();
    });

    it('opens the sheet over the list, and stays on the page', () => {
      const data = card();
      render(data);
      const navigate = spyOn(TestBed.inject(Router), 'navigate');

      commentButton().click();

      expect(TestBed.inject(CommentsSheetService).post()).toBe(data);
      expect(navigate).not.toHaveBeenCalled();
    });

    it('scrolls to the comments on the post page, where they already are', () => {
      render(card(), true);
      const section = document.createElement('div');
      section.id = 'comments';
      document.body.appendChild(section);
      const scroll = spyOn(section, 'scrollIntoView');

      commentButton().click();

      expect(scroll).toHaveBeenCalled();
      expect(TestBed.inject(CommentsSheetService).post()).toBeNull();
      section.remove();
    });
  });

  describe('photo', () => {
    const cover = { id: 'm1', url: 'http://x/p.png', width: 1080, height: 1350 };

    function frame(): HTMLElement {
      return element().querySelector('.post__frame')!;
    }

    function image(): HTMLImageElement {
      return element().querySelector('.post__slide img')!;
    }

    it('takes the shape of the photo before it loads, and is hidden until loaded', () => {
      render(card({ coverMedia: cover }));

      expect(frame().style.aspectRatio).toBe('0.8 / 1');
      expect(image().classList).not.toContain('is-loaded');

      image().dispatchEvent(new Event('load'));
      fixture.detectChanges();
      expect(image().classList).toContain('is-loaded');
    });

    it('is square for a photo with no size, and stays so after it loads', () => {
      render(card({ coverMedia: { id: 'm1', url: 'http://x/p.png' } }));

      image().dispatchEvent(new Event('load'));
      fixture.detectChanges();

      expect(frame().style.aspectRatio).toBe('1 / 1');
    });

    it('opens the photo full screen when tapped', () => {
      render(card({ coverMedia: cover }));

      (element().querySelector('.post__slide') as HTMLButtonElement).click();

      expect(TestBed.inject(PhotoViewerService).open()).toEqual({
        photos: [{ url: cover.url, width: 1080, height: 1350 }],
        index: 0,
      });
    });

    it('shows every photo on the post page as a carousel, framed by the first', () => {
      const media = [
        { media: cover, position: 0 },
        {
          media: { id: 'm2', url: 'http://x/q.png', width: 2000, height: 1000 },
          position: 1,
        },
      ];
      render({ ...card({ coverMedia: cover }), media } as PostDetail, true);

      expect(element().querySelectorAll('.post__slide').length).toBe(2);
      expect(element().querySelectorAll('.post__dot').length).toBe(2);
      expect(frame().style.aspectRatio).toBe('0.8 / 1');
    });

    it('has no carousel controls for one photo', () => {
      render(card({ coverMedia: cover }));

      expect(element().querySelector('.post__dots')).toBeNull();
      expect(element().querySelector('.post__arrow')).toBeNull();
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
