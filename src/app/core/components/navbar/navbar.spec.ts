import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { Navbar } from './navbar';
import { HomeTapService } from '../../services/home-tap/home-tap.service';
import { AuthService } from '../../services/auth/auth.service';
import { UserProfile } from '../../models/users/user-profile.model';

@Component({ template: '' })
class Page {}

describe('Navbar', () => {
  let fixture: ComponentFixture<Navbar>;
  let router: Router;
  let freshFeeds: number;

  function links(): HTMLAnchorElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.navbar__link'));
  }

  function home(): HTMLAnchorElement {
    return links()[0];
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [Navbar],
      providers: [
        provideRouter([
          { path: '', component: Page },
          { path: 'people', component: Page },
        ]),
      ],
    });
    router = TestBed.inject(Router);
    freshFeeds = 0;
    TestBed.inject(HomeTapService).freshFeed.subscribe(() => freshFeeds++);
    fixture = TestBed.createComponent(Navbar);
    fixture.detectChanges();
  });

  afterEach(() => window.scrollTo(0, 0));

  it('links to every main page and new post, each named for when only the icons show', () => {
    expect(links().map((l) => l.getAttribute('href'))).toEqual([
      '/',
      '/people',
      '/posts/new',
      '/plans',
      '/profile',
    ]);
    links().forEach((link) => expect(link.getAttribute('aria-label')).toBeTruthy());
  });

  it('shows the whole name in the logo', () => {
    expect(fixture.nativeElement.querySelector('.navbar__title').textContent.trim()).toBe(
      'COOLTURE',
    );
  });

  it('asks for a fresh feed when Home is tapped at the top of the home page', async () => {
    await router.navigateByUrl('/');
    window.scrollTo(0, 0);

    home().click();

    expect(freshFeeds).toBe(1);
    expect(router.url).toBe('/');
  });

  it('scrolls to the top first when the home page is scrolled down', async () => {
    await router.navigateByUrl('/');
    document.body.style.height = '5000px';
    window.scrollTo(0, 800);
    const scrollTo = spyOn(window, 'scrollTo') as jasmine.Spy;

    home().click();

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
    expect(freshFeeds).toBe(0);
    document.body.style.height = '';
  });

  it('keeps Home active when the home URL holds a search, and on no other page', async () => {
    await router.navigateByUrl('/?q=jazz');
    await fixture.whenStable();
    expect(home().classList).toContain('active');

    await router.navigateByUrl('/people');
    await fixture.whenStable();
    expect(home().classList).not.toContain('active');
  });

  it('tells a Home tap apart on a home URL that holds a search', async () => {
    await router.navigateByUrl('/?q=jazz');
    window.scrollTo(0, 0);

    home().click();

    expect(freshFeeds).toBe(1);
  });

  it('is an ordinary link on other pages', async () => {
    await router.navigateByUrl('/people');

    home().click();
    await fixture.whenStable();

    expect(freshFeeds).toBe(0);
    expect(router.url).toBe('/');
  });

  describe('account', () => {
    function signIn(user: Partial<UserProfile>): void {
      TestBed.inject(AuthService).currentUser.set({
        id: 'u1',
        username: 'kacper',
        followersCount: 0,
        followingCount: 0,
        ...user,
      } as UserProfile);
      fixture.detectChanges();
    }

    function account(): HTMLAnchorElement | null {
      return fixture.nativeElement.querySelector('.navbar__account');
    }

    it('shows a guest the person icon and no account', () => {
      expect(account()).toBeNull();
      expect(links()[4].querySelector('ng-icon')).not.toBeNull();
    });

    it('shows the handle and photo, linking to the profile', () => {
      signIn({ avatar: { id: 'a1', url: 'http://x/a.png' } });

      expect(account()!.getAttribute('href')).toBe('/profile');
      expect(account()!.textContent).toContain('kacper');
      expect(account()!.querySelector('img')!.getAttribute('src')).toBe('http://x/a.png');
    });

    it('turns the profile place into the photo, for the phone bar', () => {
      signIn({});

      const profile = links()[4];
      expect(profile.classList).toContain('navbar__link--account');
      expect(profile.querySelector('ng-icon')).toBeNull();
      expect(profile.querySelector('.navbar__avatar')!.textContent!.trim()).toBe('k');
    });
  });
});
