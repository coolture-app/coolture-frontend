import { inject, PLATFORM_ID } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth/auth.service';
import { isPlatformBrowser } from '@angular/common';
import { map } from 'rxjs';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const platformId = inject(PLATFORM_ID);

  return authService.checkSession().pipe(
    map((isAuthenticated) => {
      if (isAuthenticated) {
        return true;
      }

      if (isPlatformBrowser(platformId)) {
        window.location.href = 'http://localhost:8080/oauth2/authorization/keycloak';
      } else {
        console.log('SSR: User not logged in, allowing render for client-side redirect.');
        return true;
      }
      return false;
    }),
  );
};
