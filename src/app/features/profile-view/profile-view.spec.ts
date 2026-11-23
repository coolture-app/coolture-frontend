import { ConfirmService } from '../../core/services/confirm/confirm.service';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Title } from '@angular/platform-browser';
import { TranslateService } from '@ngx-translate/core';

import { ProfileView } from './profile-view';
import { AuthService } from '../../core/services/auth/auth.service';
import { PhotoViewerService } from '../../core/services/photo-viewer/photo-viewer.service';
import { UserProfile } from '../../core/models/users/user-profile.model';
import { InterestCatalog } from '../../core/models/interests/interest.model';
import { MediaService } from '../../core/services/media/media.service';
import { MediaResource } from '../../core/models/media/media-resource.model';
import { AvatarCropper } from '../../core/components/avatar-cropper/avatar-cropper';
import { until } from '../../core/testing/until.testing';

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
  kinds: ['stage', 'concerts'],
};

const JAN: UserProfile = {
  ...ME,
  id: 'jan-1',
  username: 'jan',
  firstName: 'Jan',
  lastName: 'Kowalski',
  bio: undefined,
  interests: ['opera'],
  kinds: [],
};

const CATALOG: InterestCatalog = {
  minKinds: 1,
  minInterests: 0,
  maxInterests: 6,
  kinds: [
    { key: 'concerts', labelPl: 'Koncerty', labelEn: 'Concerts' },
    { key: 'stage', labelPl: 'Scena', labelEn: 'Stage' },
  ],
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

describe('ProfileView', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  let element: HTMLElement;

  async function open(url: string, me: UserProfile = ME) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'profile', component: ProfileView },
          { path: 'users/:username', component: ProfileView },
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
    harness.fixture.debugElement.query((d) => d.componentInstance instanceof ProfileView)
      .componentInstance as ProfileView;

  describe('your own', () => {
    beforeEach(async () => {
      await open('/profile');
    });

    it('links the gear to the settings, and leaves the old buttons out', () => {
      const gear = element.querySelector<HTMLAnchorElement>('.profile__corner a');
      expect(gear?.getAttribute('href')).toBe('/profile/settings');
      expect(gear?.getAttribute('aria-label')).toBe('SETTINGS.title');
      expect(element.textContent).not.toContain('BLOCKED.title');
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

    it('lists the kinds and then the topics as chips, each in the catalogue’s order', async () => {
      await flushCatalog();

      const chips = [...element.querySelectorAll('.profile__interest')].map((c) =>
        c.textContent?.trim(),
      );
      expect(chips).toEqual(['Koncerty', 'Scena', 'Jazz', 'Teatr']);
      expect(element.querySelectorAll('.profile__interest--kind ng-icon').length).toBe(2);
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
      const input = element.querySelector<HTMLInputElement>('.avatar-input')!;
      const pick = spyOn(input, 'click');

      element.querySelector<HTMLButtonElement>('.avatar-badge')!.click();
      harness.detectChanges();

      expect(pick).toHaveBeenCalled();
      expect(document.querySelector('[role="menu"]')).toBeNull();
    });

    it('offers to change or remove it once there is one', async () => {
      await open('/profile', { ...ME, avatar: { id: 'm-1', url: 'photo.jpg' } });

      element.querySelector<HTMLButtonElement>('.avatar-badge')!.click();
      harness.detectChanges();

      const items = [...document.querySelectorAll('[role="menuitem"]')].map((b) =>
        b.textContent?.trim(),
      );
      expect(items).toEqual(['PROFILE.changeAvatar', 'PROFILE.removeAvatar']);
    });

    it('enlarges the photo on a tap, apart from the badge', async () => {
      await open('/profile', { ...ME, avatar: { id: 'm-1', url: 'photo.jpg' } });

      element.querySelector<HTMLButtonElement>('.avatar-view')!.click();

      expect(TestBed.inject(PhotoViewerService).open()?.photos[0].url).toBe('photo.jpg');
      expect(document.querySelector('[role="menu"]')).toBeNull();
    });

    it('places a picked photo in the circle before anything is uploaded', async () => {
      await open('/profile');
      const input = element.querySelector<HTMLInputElement>('.avatar-input')!;
      const files = new DataTransfer();
      files.items.add(new File(['x'], 'me.png', { type: 'image/png' }));
      input.files = files.files;

      input.dispatchEvent(new Event('change'));
      harness.detectChanges();

      expect(element.querySelector('app-avatar-cropper')).not.toBeNull();
      http.expectNone((r) => r.url.includes('/media'));
      element.querySelector('dialog')?.close();
    });

    it('uploads the placed photo and shows the profile saved with it', async () => {
      await open('/profile');
      const upload = spyOn(TestBed.inject(MediaService), 'upload').and.resolveTo({
        id: 'm-2',
      } as MediaResource);
      const input = element.querySelector<HTMLInputElement>('.avatar-input')!;
      const files = new DataTransfer();
      files.items.add(new File(['x'], 'me.png', { type: 'image/png' }));
      input.files = files.files;
      input.dispatchEvent(new Event('change'));
      harness.detectChanges();
      const cropper = harness.fixture.debugElement.query(
        (d) => d.componentInstance instanceof AvatarCropper,
      ).componentInstance as AvatarCropper;
      const next = async (url: string, method: string) => {
        let request: TestRequest | undefined;
        await until(
          () => !!(request = http.match((r) => r.method === method && r.url.endsWith(url))[0]),
          `${method} ${url}`,
        );
        return request!;
      };

      cropper.saved.emit(new Blob(['y'], { type: 'image/jpeg' }));

      expect(upload).toHaveBeenCalledWith(jasmine.any(File), 'PROFILE_IMAGE');
      const put = await next('/users/me-1/profile-image', 'PUT');
      expect(put.request.body).toEqual({ fullMediaId: 'm-2', thumbnailMediaId: 'm-2' });
      put.flush({});
      (await next('/users/me-1', 'GET')).flush({ ...ME, avatar: { id: 'm-2', url: 'new.jpg' } });
      await until(() => !!TestBed.inject(AuthService).currentUser()?.avatar, 'the saved profile');
      await harness.fixture.whenStable();
      harness.detectChanges();

      expect(element.querySelector('img.avatar')?.getAttribute('src')).toBe('new.jpg');
      expect(element.querySelector('app-avatar-cropper')).toBeNull();
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

    expect(text('.profile__actions app-relation-pill')).toBe('PROFILE.friends');
  });

  describe('someone else’s, with interests you share', () => {
    beforeEach(async () => {
      await open('/users/jan');
      http
        .expectOne((r) => r.url.endsWith('/users/by-username/jan'))
        .flush({ ...JAN, kinds: ['stage', 'concerts'], interests: ['jazz', 'opera'] });
      await harness.fixture.whenStable();
      harness.detectChanges();
      await flushCatalog();
    });

    it('boxes the shared ones under their title, then the rest', () => {
      const groups = [...element.querySelectorAll('.profile__group')].map((group) => [
        group.querySelector('.profile__group-title')?.textContent?.trim(),
        [...group.querySelectorAll('.profile__interest')].map((chip) => chip.textContent?.trim()),
      ]);

      expect(groups).toEqual([
        ['PROFILE.sharedInterests', ['Koncerty', 'Scena', 'Jazz']],
        ['PROFILE.interests', ['Opera']],
      ]);
      expect(element.querySelector('.profile__group--shared')).not.toBeNull();
    });
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
      expect(back?.textContent?.trim()).toBe('PEOPLE.title');
    });

    it('names the tab after them', () => {
      expect(TestBed.inject(Title).getTitle()).toBe('Jan Kowalski (@jan)');
    });

    it('has Obserwuj as its only button and Zablokuj in the ⋯ menu', () => {
      expect(element.querySelector('.profile__corner a')).toBeNull();
      expect(text('.profile__actions')).toBe('PROFILE.follow');

      element.querySelector<HTMLButtonElement>('.profile__corner button')!.click();
      harness.detectChanges();
      expect(document.querySelector('[role="menu"]')?.textContent?.trim()).toBe('PROFILE.block');
    });

    it('has no friend mark while only you follow them', () => {
      expect(element.querySelector('app-relation-pill')?.textContent?.trim()).toBe('');
    });

    it('has no photo badge', () => {
      expect(element.querySelector('.avatar-badge')).toBeNull();
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

  describe('across a block', () => {
    const SLIM: UserProfile = {
      id: 'jan-1',
      username: 'jan',
      firstName: 'Jan',
      lastName: 'Kowalski',
      isFollowing: false,
      isBlocked: true,
      followsYou: false,
    };

    async function answer(body: UserProfile | null, status = 200) {
      const request = http.expectOne((r) => r.url.endsWith('/users/by-username/jan'));
      if (status === 200) {
        request.flush(body);
      } else {
        request.flush({ error: 'not found' }, { status, statusText: 'Not Found' });
      }
      await harness.fixture.whenStable();
      harness.detectChanges();
    }

    it('shows the not-found page and keeps the address, when they blocked you or there is no one', async () => {
      await open('/users/jan');
      await answer(null, 404);

      expect(element.querySelector('app-not-found-view')).not.toBeNull();
      expect(element.querySelector('.profile')).toBeNull();
      expect(TestBed.inject(Router).url).toBe('/users/jan');
    });

    it('shows who you blocked, and Odblokuj, but nothing else of theirs', async () => {
      await open('/users/jan');
      await answer(SLIM);

      expect(text('.profile__name')).toBe('Jan Kowalski');
      expect(text('.profile__username')).toBe('@jan');
      expect(text('.profile__blocked')).toBe('PROFILE.youBlocked');
      expect(text('.profile__actions')).toBe('PROFILE.unblock');
      expect(element.querySelector('.profile__stats')).toBeNull();
      expect(element.querySelector('app-follow-btn')).toBeNull();
      expect(element.querySelector('app-relation-pill')).toBeNull();
      expect(element.querySelector('.profile__since')).toBeNull();
    });

    it('loads the whole profile after Odblokuj', async () => {
      await open('/users/jan');
      spyOn(TestBed.inject(ConfirmService), 'ask').and.resolveTo(true);
      await answer(SLIM);

      element.querySelector<HTMLButtonElement>('.profile__actions button')!.click();
      // The answer comes back as a promise.
      await new Promise((resolve) => setTimeout(resolve));
      http
        .expectOne((r) => r.method === 'DELETE' && r.url.endsWith('/users/jan-1/block'))
        .flush(null);
      await harness.fixture.whenStable();
      await answer(JAN);

      expect(element.querySelector('.profile__stats')).not.toBeNull();
      expect(element.querySelector('app-follow-btn')).not.toBeNull();
      expect(element.querySelector('.profile__blocked')).toBeNull();
    });

    it('turns slim right after Zablokuj', async () => {
      await open('/users/jan');
      spyOn(TestBed.inject(ConfirmService), 'ask').and.resolveTo(true);
      await answer({ ...JAN, bio: 'Opera', isFollowing: true });

      const blocking = view().onBlock();
      await new Promise((resolve) => setTimeout(resolve));
      http
        .expectOne((r) => r.method === 'POST' && r.url.endsWith('/users/jan-1/block'))
        .flush(null);
      await blocking;
      harness.detectChanges();

      expect(text('.profile__blocked')).toBe('PROFILE.youBlocked');
      expect(element.querySelector('.profile__stats')).toBeNull();
      expect(element.querySelector('.profile__bio')).toBeNull();
      expect(view().user()?.isFollowing).toBeFalse();
    });
  });
});
