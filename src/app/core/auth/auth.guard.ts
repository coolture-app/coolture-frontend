import { inject } from '@angular/core';
import { CanMatchFn } from '@angular/router';
import { AuthService } from '../services/auth/auth.service';

/**
 * Lets a signed-in person into the route. A guest falls through to the next route with the same path, GuestView,
 * so the URL stays and signing in comes back to it. On the server nobody is signed in.
 */
export const signedIn: CanMatchFn = () => {
  const auth = inject(AuthService);
  return auth.isAuthenticated() || auth.checkSession();
};
