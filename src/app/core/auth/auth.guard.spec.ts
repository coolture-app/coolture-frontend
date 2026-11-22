import { TestBed } from '@angular/core/testing';
import { provideRouter, Route, Router } from '@angular/router';
import { of } from 'rxjs';

import { routes } from '../../app.routes';
import { GuestView } from '../../features/guest-view/guest-view';
import { AuthService } from '../services/auth/auth.service';
import { signedIn } from './auth.guard';

describe('the routes for signed-in people', () => {
  const guarded = routes.filter((route) => route.canMatch?.includes(signedIn));

  function open(signedInUser: boolean) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        {
          provide: AuthService,
          useValue: { isAuthenticated: () => signedInUser, checkSession: () => of(signedInUser) },
        },
      ],
    });
    return TestBed.inject(Router);
  }

  const reached = (router: Router): Route | null | undefined =>
    router.routerState.snapshot.root.firstChild?.routeConfig;

  it('has a twin for every one of them, at the same path', () => {
    expect(guarded.length).toBeGreaterThan(0);
    for (const route of guarded) {
      const twins = routes.filter((other) => other.path === route.path && other !== route);
      expect(twins.map((twin) => twin.component)).toEqual([GuestView]);
    }
  });

  it('shows a guest the sign-in screen at the same URL', async () => {
    const router = open(false);

    for (const route of guarded) {
      const url = '/' + route.path!.replace(/:\w+/g, 'x');
      await router.navigateByUrl(url);

      expect(router.url).toBe(url);
      expect(reached(router)?.component).toBe(GuestView);
    }
  });

  // One router each: a page with canDeactivate has no component to ask without an outlet, when the next page opens.
  guarded.forEach((route) => {
    it(`shows a signed-in person ${route.path}`, async () => {
      const router = open(true);

      await router.navigateByUrl('/' + route.path!.replace(/:\w+/g, 'x'));

      expect(reached(router)?.component).toBe(route.component);
    });
  });
});
