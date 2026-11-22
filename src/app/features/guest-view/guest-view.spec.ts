import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Component } from '@angular/core';
import { of } from 'rxjs';
import { routes } from '../../app.routes';
import { AuthService } from '../../core/services/auth/auth.service';
import { GuestView } from './guest-view';

@Component({ template: '' })
class Stub {}

describe('GuestView', () => {
  const signedIn = (yes: boolean) => ({
    isAuthenticated: () => yes,
    checkSession: () => of(yes),
    currentUser: () => null,
  });

  async function open(url: string, auth: object) {
    TestBed.configureTestingModule({
      providers: [
        // The real pages would load data; only which route matched matters here.
        provideRouter(
          routes.map((r) =>
            r.component && r.component !== GuestView ? { ...r, component: Stub } : r,
          ),
        ),
        { provide: AuthService, useValue: auth },
      ],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    return harness;
  }

  it('takes a guest’s page at its own URL, saying why to sign in', async () => {
    const harness = await open('/plans', signedIn(false));

    expect(TestBed.inject(Router).url).toBe('/plans');
    expect(harness.routeNativeElement?.querySelector('.sign-in__title')?.textContent).toContain(
      'SIGN_IN.plans.title',
    );
  });

  it('lets a signed-in person through to the page', async () => {
    const harness = await open('/users/jan', signedIn(true));

    expect(harness.routeNativeElement?.querySelector('app-sign-in-card')).toBeNull();
  });
});
