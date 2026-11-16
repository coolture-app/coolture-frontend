import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { TranslateService } from '@ngx-translate/core';

import { UserProfileView } from './my-profile-view';
import { AuthService } from '../../core/services/auth/auth.service';
import { PhotoViewerService } from '../../core/services/photo-viewer/photo-viewer.service';
import { UserProfile } from '../../core/models/users/user-profile.model';
import { InterestCatalog } from '../../core/models/interests/interest.model';

const ME: UserProfile = {
  id: 'me-1',
  username: 'anna',
  firstName: 'Anna',
  lastName: 'Nowak',
  bio: 'Teatr i kino',
  createdAt: '2026-11-15T10:00:00Z',
  followersCount: 3,
  followingCount: 5,
  isFollowing: false,
  isBlocked: false,
  followsYou: false,
  interests: ['theatre', 'jazz'],
};

const JAN: UserProfile = {
  ...ME,
  id: 'jan-1',
  username: 'jan',
  firstName: 'Jan',
  lastName: 'Kowalski',
  bio: undefined,
  interests: ['opera'],
};

const CATALOG: InterestCatalog = {
  minSelections: 1,
  maxSelections: 10,
  categories: [
    {
      key: 'music',
      labelPl: 'Muzyka',
      labelEn: 'Music',
      interests: [
        { key: 'jazz', labelPl: 'Jazz', labelEn: 'Jazz' },
        { key: 'opera', labelPl: 'Opera', labelEn: 'Opera' },
      ],
    },
    {
      key: 'stage',
      labelPl: 'Scena',
      labelEn: 'Stage',
      interests: [{ key: 'theatre', labelPl: 'Teatr', labelEn: 'Theatre' }],
    },
  ],
};

describe('UserProfileView', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  let element: HTMLElement;

  async function open(url: string, me: UserProfile = ME) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'profile', component: UserProfileView },
          { path: 'users/:username', component: UserProfileView },
        ]),
      ],
    });
    TestBed.inject(AuthService).currentUser.set(me);
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    element = harness.routeNativeElement!;
  }

  async function flushCatalog() {
    http.expectOne((r) => r.url.endsWith('/dicts/interests')).flush(CATALOG);
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  const text = (selector: string) => element.querySelector(selector)?.textContent?.trim();
  const view = () =>
    harness.fixture.debugElement.query((d) => d.componentInstance instanceof UserProfileView)
      .componentInstance as UserProfileView;

  describe('your own', () => {
    beforeEach(async () => {
      await open('/profile');
    });

    it('links the gear to the settings, and leaves the old buttons out', () => {
      const gear = element.querySelector<HTMLAnchorElement>('.profile__corner a');
      expect(gear?.getAttribute('href')).toBe('/profile/settings');
      expect(gear?.getAttribute('aria-label')).toBe('SETTINGS.title');
      expect(element.textContent).not.toContain('PROFILE.blocked');
      expect(element.textContent).not.toContain('PROFILE.hidden-posts');
      expect(element.querySelector('app-switch')).toBeNull();
      expect(element.querySelector('app-back-link')).toBeNull();
    });

    it('shows the two counts and the interests and home buttons', () => {
      const stats = [...element.querySelectorAll('.profile__stat-value')].map((s) =>
        s.textContent?.trim(),
      );
      expect(stats).toEqual(['3', '5']);
      expect(text('.profile__actions')).toContain('PROFILE.interests');
      expect(text('.profile__actions')).toContain('PROFILE.addHome');
    });

    it('lists the picks as chips, in the catalogue’s order', async () => {
      await flushCatalog();

      const chips = [...element.querySelectorAll('.profile__interest')].map((c) =>
        c.textContent?.trim(),
      );
      expect(chips).toEqual(['Jazz', 'Teatr']);
    });

    it('shows no chips when the catalogue can’t be read', async () => {
      http
        .expectOne((r) => r.url.endsWith('/dicts/interests'))
        .flush(null, { status: 500, statusText: 'Server Error' });
      await harness.fixture.whenStable();
      harness.detectChanges();

      expect(element.querySelector('.profile__interests')).toBeNull();
    });

    it('edits the bio in place and saves it', async () => {
      element.querySelector<HTMLButtonElement>('.profile__bio-edit')!.click();
      harness.detectChanges();
      const textarea = element.querySelector<HTMLTextAreaElement>('.profile__textarea')!;
      expect(textarea.value).toBe('Teatr i kino');

      textarea.value = 'Jazz';
      textarea.dispatchEvent(new Event('input'));
      element.querySelector<HTMLFormElement>('.profile__bio--editing')!.requestSubmit();

      const save = http.expectOne((r) => r.method === 'PATCH');
      expect(save.request.url).toMatch(/\/users\/me-1$/);
      expect(save.request.body).toEqual({ bio: 'Jazz' });
      save.flush({ ...ME, bio: 'Jazz' });
      await harness.fixture.whenStable();
      harness.detectChanges();

      expect(element.querySelector('.profile__textarea')).toBeNull();
      expect(text('.profile__bio-text')).toBe('Jazz');
    });

    it('drops the draft on Anuluj', () => {
      element.querySelector<HTMLButtonElement>('.profile__bio-edit')!.click();
      harness.detectChanges();
      element.querySelector<HTMLButtonElement>('.profile__bio-buttons button')!.click();
      harness.detectChanges();

      expect(element.querySelector('.profile__textarea')).toBeNull();
      expect(text('.profile__bio-text')).toBe('Teatr i kino');
      http.expectNone((r) => r.method === 'PATCH');
    });

    it('says when you joined, by month and year, in Polish and English', async () => {
      expect(view().since()).toBe('listopada 2026');

      TestBed.inject(TranslateService).use('en');
      await harness.fixture.whenStable();
      expect(view().since()).toBe('November 2026');
    });
  });

  describe('your photo', () => {
    it('opens the file picker at once while there is none', async () => {
      await open('/profile');
      const input = element.querySelector<HTMLInputElement>('.profile__avatar-input')!;
      const pick = spyOn(input, 'click');

      element.querySelector<HTMLButtonElement>('.profile__avatar-badge')!.click();
      harness.detectChanges();

      expect(pick).toHaveBeenCalled();
      expect(element.querySelector('.profile__menu--avatar')).toBeNull();
    });

    it('offers to change or remove it once there is one', async () => {
      await open('/profile', { ...ME, avatar: { id: 'm-1', url: 'photo.jpg' } });

      element.querySelector<HTMLButtonElement>('.profile__avatar-badge')!.click();
      harness.detectChanges();

      const items = [...element.querySelectorAll('.profile__menu--avatar button')].map((b) =>
        b.textContent?.trim(),
      );
      expect(items).toEqual(['PROFILE.changeAvatar', 'PROFILE.removeAvatar']);
    });

    it('enlarges the photo on a tap, apart from the badge', async () => {
      await open('/profile', { ...ME, avatar: { id: 'm-1', url: 'photo.jpg' } });

      element.querySelector<HTMLButtonElement>('.profile__avatar-view')!.click();

      expect(TestBed.inject(PhotoViewerService).open()?.photos[0].url).toBe('photo.jpg');
      expect(element.querySelector('.profile__menu--avatar')).toBeNull();
    });

    it('places a picked photo in the circle before anything is uploaded', async () => {
      await open('/profile');
      const input = element.querySelector<HTMLInputElement>('.profile__avatar-input')!;
      const files = new DataTransfer();
      files.items.add(new File(['x'], 'me.png', { type: 'image/png' }));
      input.files = files.files;

      input.dispatchEvent(new Event('change'));
      harness.detectChanges();

      expect(element.querySelector('app-avatar-cropper')).not.toBeNull();
      http.expectNone((r) => r.url.includes('/media'));
      element.querySelector('dialog')?.close();
    });
  });

  it('offers to write a bio when yours is empty', async () => {
    await open('/profile', { ...ME, bio: undefined });

    const empty = element.querySelector<HTMLButtonElement>('.profile__bio--empty')!;
    expect(empty.textContent).toContain('PROFILE.bioPlaceholder');
    empty.click();
    harness.detectChanges();
    expect(element.querySelector('.profile__textarea')).not.toBeNull();
  });

  it('marks a friend, who follows you back', async () => {
    await open('/users/jan');
    http
      .expectOne((r) => r.url.endsWith('/users/by-username/jan'))
      .flush({ ...JAN, isFollowing: true, followsYou: true });
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(text('.profile__handle app-relation-pill')).toBe('PROFILE.friends');
  });

  describe('someone else’s', () => {
    beforeEach(async () => {
      await open('/users/jan');
      http.expectOne((r) => r.url.endsWith('/users/by-username/jan')).flush(JAN);
      await harness.fixture.whenStable();
      harness.detectChanges();
    });

    it('links back to Ludzie when the tab came straight here', () => {
      const back = element.querySelector('app-back-link a');
      expect(back?.getAttribute('href')).toBe('/people');
      expect(back?.textContent?.trim()).toBe('NAVBAR.friends');
    });

    it('has Obserwuj as its only button and Zablokuj in the ⋯ menu', () => {
      expect(element.querySelector('.profile__corner a')).toBeNull();
      expect(text('.profile__actions')).toBe('PROFILE.follow');

      element.querySelector<HTMLButtonElement>('.profile__corner button')!.click();
      harness.detectChanges();
      expect(text('.profile__menu')).toBe('PROFILE.block');
    });

    it('has no friend mark while only you follow them', () => {
      expect(element.querySelector('app-relation-pill')?.textContent?.trim()).toBe('');
    });

    it('has no photo badge', () => {
      expect(element.querySelector('.profile__avatar-badge')).toBeNull();
    });

    it('leaves an empty bio out and has no pencil', () => {
      expect(element.querySelector('.profile__bio')).toBeNull();
      expect(element.querySelector('.profile__bio-edit')).toBeNull();
    });

    it('takes their interests from the profile, with no request of their own', async () => {
      await flushCatalog();

      expect(text('.profile__interests')).toBe('Opera');
      http.expectNone((r) => r.url.endsWith('/users/jan-1/interests'));
    });
  });
});
