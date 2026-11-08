import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { Navbar } from './navbar';
import { HomeTapService } from '../../services/home-tap/home-tap.service';

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
          { path: 'discover', component: Page },
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
      '/discover',
      '/addPost',
      '/myEvents',
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

  it('is an ordinary link on other pages', async () => {
    await router.navigateByUrl('/discover');

    home().click();
    await fixture.whenStable();

    expect(freshFeeds).toBe(0);
    expect(router.url).toBe('/');
  });
});
