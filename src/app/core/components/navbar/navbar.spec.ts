import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Navbar } from './navbar';

describe('Navbar', () => {
  let component: Navbar;
  let fixture: ComponentFixture<Navbar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Navbar],
    }).compileComponents();

    fixture = TestBed.createComponent(Navbar);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('links to every main page, with names when only the icons show', () => {
    const links = fixture.nativeElement.querySelectorAll('.navbar__link');

    expect(Array.from(links as NodeListOf<Element>).map((l) => l.getAttribute('href'))).toEqual([
      '/',
      '/discover',
      '/myEvents',
      '/profile',
    ]);
    links.forEach((link: Element) => expect(link.getAttribute('aria-label')).toBeTruthy());
  });
});
