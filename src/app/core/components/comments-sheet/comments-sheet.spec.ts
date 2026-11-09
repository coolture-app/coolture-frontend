import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';

import { CommentsSheet, settleDrag } from './comments-sheet';
import {
  CommentsSheetService,
  SheetPost,
} from '../../services/comments-sheet/comments-sheet.service';
import { CommentsService } from '../../services/comments/comments.service';
import { AuthService } from '../../services/auth/auth.service';

@Component({ template: '' })
class OtherPage {}

describe('settleDrag', () => {
  const HALF = 400;
  const FULL = 776;

  it('settles on the nearest size after a slow drag', () => {
    expect(settleDrag(420, HALF, FULL, 0, 'half')).toBe('half');
    expect(settleDrag(700, HALF, FULL, 0, 'half')).toBe('full');
    expect(settleDrag(500, HALF, FULL, 0, 'full')).toBe('half');
  });

  it('closes when dragged well below half', () => {
    expect(settleDrag(200, HALF, FULL, 0, 'half')).toBe('close');
  });

  it('follows a fast flick one step', () => {
    expect(settleDrag(420, HALF, FULL, 1, 'half')).toBe('full');
    expect(settleDrag(700, HALF, FULL, -1, 'full')).toBe('half');
    expect(settleDrag(380, HALF, FULL, -1, 'half')).toBe('close');
  });
});

describe('CommentsSheet', () => {
  let fixture: ComponentFixture<CommentsSheet>;
  let service: CommentsSheetService;
  let post: SheetPost;
  let startUrl: string;
  let wide: boolean;

  function element(): HTMLElement {
    return fixture.nativeElement;
  }

  /** Back, then the frames the sheet waits for the router's scroll. */
  async function closing(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    await fixture.whenStable();
  }

  async function opened(): Promise<void> {
    service.show(post);
    await fixture.whenStable();
  }

  beforeEach(() => {
    startUrl = location.pathname + location.search;
    post = {
      id: 'p1',
      commentsCount: 2,
      title: 'Koncert',
      author: { id: 'u1', username: 'ola', followersCount: 0, followingCount: 0 },
    };
    wide = false;
    const realMatchMedia = window.matchMedia.bind(window);
    // Only the panel's own question. The CDK asks others, and needs a real answer.
    spyOn(window, 'matchMedia').and.callFake((query: string) =>
      query.includes('1024px') ? ({ matches: wide } as MediaQueryList) : realMatchMedia(query),
    );
    TestBed.configureTestingModule({
      imports: [CommentsSheet],
      providers: [
        provideRouter([{ path: 'other', component: OtherPage }]),
        {
          provide: AuthService,
          useValue: { currentUser: signal({ id: 'me' }), login: () => undefined },
        },
      ],
    });
    spyOn(TestBed.inject(CommentsService), 'getCommentsOfPost').and.returnValue(
      of({ items: [], page: { limit: 20, hasMore: false } }),
    );
    fixture = TestBed.createComponent(CommentsSheet);
    service = TestBed.inject(CommentsSheetService);
    fixture.detectChanges();
  });

  afterEach(async () => {
    if (service.post()) {
      fixture.componentInstance.close();
      await closing();
    }
    document.documentElement.style.overflow = '';
    history.replaceState(history.state, '', startUrl);
  });

  describe('on a wide screen', () => {
    beforeEach(() => (wide = true));

    it('docks beside the feed, with no dimming or scroll lock, and no modal claim', async () => {
      await opened();

      const sheet = element().querySelector('.sheet')!;
      expect(sheet.classList).toContain('sheet--docked');
      expect(sheet.getAttribute('aria-modal')).toBeNull();
      expect(element().querySelector('.sheet__scrim')).toBeNull();
      expect(document.documentElement.style.overflow).toBe('');
      expect(document.documentElement.classList).toContain('comments-docked');
    });

    it('heads the panel with the author and the title, linking to each', async () => {
      await opened();

      const author = element().querySelector('.sheet__author');
      const title = element().querySelector('.sheet__post-title');
      expect(author?.textContent).toContain('ola');
      expect(author?.getAttribute('href')).toBe('/users/ola');
      expect(title?.textContent).toContain('Koncert');
      expect(title?.getAttribute('href')).toBe('/posts/p1');
    });

    it('switches to another card’s comments, in the same history entry', async () => {
      await opened();
      const entries = history.length;
      const load = TestBed.inject(CommentsService).getCommentsOfPost as jasmine.Spy;

      service.show({ ...post, id: 'p2', title: 'Teatr' });
      await fixture.whenStable();

      expect(history.length).toBe(entries);
      expect(location.pathname).toBe('/posts/p2');
      expect(element().querySelector('.sheet__post-title')?.textContent).toContain('Teatr');
      expect(load.calls.mostRecent().args[0]).toBe('p2');

      history.back();
      await closing();
      expect(service.post()).toBeNull();
      expect(location.pathname).toBe(startUrl);
    });

    it('leaves the feed where it was scrolled to while open, on Back', async () => {
      document.body.style.height = '5000px';
      window.scrollTo(0, 300);
      await opened();
      window.scrollTo(0, 1200);

      history.back();
      await closing();

      expect(window.scrollY).toBe(1200);
      expect(document.documentElement.classList).not.toContain('comments-docked');
      document.body.style.height = '';
      window.scrollTo(0, 0);
    });

    it('doesn’t close on a click in the feed', async () => {
      await opened();

      document.body.click();
      await closing();

      expect(service.post()).not.toBeNull();
    });

    it('can’t be dragged', async () => {
      await opened();
      const header = element().querySelector('.sheet__header') as HTMLElement;

      fixture.componentInstance.onDragStart({
        clientY: 300,
        pointerId: 1,
        currentTarget: header,
        timeStamp: 0,
      } as unknown as PointerEvent);
      fixture.componentInstance.onDragMove({ clientY: 100, timeStamp: 10 } as PointerEvent);

      expect(fixture.componentInstance.dragHeight()).toBeNull();
    });
  });

  it('shows no author or title on the narrow sheet, where the room is for comments', async () => {
    await opened();

    expect(element().querySelector('.sheet__post')).toBeNull();
    expect(element().querySelector('.sheet--docked')).toBeNull();
  });

  it('shows nothing until a post is opened', () => {
    expect(element().querySelector('.sheet')).toBeNull();
  });

  it('opens over the page at half height, as a dialog with the count', async () => {
    await opened();

    const sheet = element().querySelector('.sheet')!;
    expect(sheet.getAttribute('role')).toBe('dialog');
    expect(sheet.getAttribute('aria-modal')).toBe('true');
    expect(sheet.classList).not.toContain('sheet--full');
    expect(element().querySelector('.sheet__title')?.textContent).toContain('(2)');
    expect(document.documentElement.style.overflow).toBe('hidden');
  });

  it('shows the post’s comments link in the address bar', async () => {
    await opened();

    expect(location.pathname).toBe('/posts/p1');
    expect(location.hash).toBe('#comments');
  });

  it('focuses the panel, not the box, so no keyboard comes up for a reader', async () => {
    await opened();

    expect(document.activeElement).toBe(element().querySelector('.sheet'));
  });

  it('closes on the browser’s Back, and restores the address', async () => {
    await opened();

    history.back();
    await closing();

    expect(service.post()).toBeNull();
    expect(location.pathname).toBe(startUrl);
    expect(document.documentElement.style.overflow).toBe('');
  });

  it('closes with X, a tap outside, and Esc', async () => {
    const closers: (() => void)[] = [
      () => (element().querySelector('.sheet__close') as HTMLElement).click(),
      () => (element().querySelector('.sheet__scrim') as HTMLElement).click(),
      () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })),
    ];
    for (const close of closers) {
      await opened();
      close();
      await closing();
      expect(service.post()).toBeNull();
    }
  });

  it('leaves Esc to the delete confirmation while that’s open', async () => {
    await opened();
    const dialog = document.createElement('dialog');
    document.body.appendChild(dialog);
    dialog.showModal();

    fixture.componentInstance.onEscape();
    await closing();

    expect(service.post()).not.toBeNull();
    dialog.remove();
  });

  it('grows to full height when the box takes focus', async () => {
    await opened();

    (element().querySelector('textarea') as HTMLTextAreaElement).focus();
    await fixture.whenStable();

    expect(element().querySelector('.sheet')?.classList).toContain('sheet--full');
  });

  it('opens at half height again next time', async () => {
    await opened();
    fixture.componentInstance.grow();
    fixture.componentInstance.close();
    await closing();

    await opened();

    expect(element().querySelector('.sheet')?.classList).not.toContain('sheet--full');
  });

  it('keeps the card’s count right as comments come and go', async () => {
    await opened();

    service.changeCount(1);
    await fixture.whenStable();

    expect(element().querySelector('.sheet__title')?.textContent).toContain('(3)');
    expect(post.commentsCount).toBe(3);
  });

  it('goes when a link inside takes the user elsewhere', async () => {
    await opened();

    await TestBed.inject(Router).navigateByUrl('/other');
    await fixture.whenStable();

    expect(service.post()).toBeNull();
    expect(document.documentElement.style.overflow).toBe('');
  });
});
