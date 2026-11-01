import { CUSTOM_ELEMENTS_SCHEMA, provideZonelessChangeDetection, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';
import { App } from './app';
import { UserProfile } from './core/models/users/user-profile.model';
import { AuthService } from './core/services/auth/auth.service';

describe('App interests overlay', () => {
  const currentUser = signal<Partial<UserProfile> | null>(null);
  let fixture: ComponentFixture<App>;

  async function render(): Promise<HTMLElement> {
    await TestBed.configureTestingModule({
      imports: [App, TranslateModule.forRoot()],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: AuthService, useValue: { currentUser, checkSession: () => of(true) } },
      ],
    })
      .overrideComponent(App, { set: { imports: [], schemas: [CUSTOM_ELEMENTS_SCHEMA] } })
      .compileComponents();
    fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  beforeEach(() => TestBed.resetTestingModule());

  it('opens the page again when the selection is skipped', async () => {
    currentUser.set({ interestsSelected: false });
    const element = await render();

    fixture.componentRef.instance['interestsDismissed'].set(true);
    await fixture.whenStable();

    expect(element.querySelector('.app__interests')).toBeNull();
    expect(element.querySelector('.app__content')?.hasAttribute('inert')).toBeFalse();
  });

  it('covers the page for a user without interests', async () => {
    currentUser.set({ interestsSelected: false });
    const element = await render();

    expect(element.querySelector('.app__interests')).not.toBeNull();
    expect(element.querySelector('.app__content')?.hasAttribute('inert')).toBeTrue();
  });

  for (const [name, user] of [
    ['a user with interests', { interestsSelected: true }],
    ['an anonymous visitor', null],
    ['a response without the flag', {}],
  ] as const) {
    it(`leaves the page open for ${name}`, async () => {
      currentUser.set(user);
      const element = await render();

      expect(element.querySelector('.app__interests')).toBeNull();
      expect(element.querySelector('.app__content')?.hasAttribute('inert')).toBeFalse();
    });
  }
});
