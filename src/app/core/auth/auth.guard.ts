import { inject, PLATFORM_ID } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth/auth.service';
import { ApiUrlService } from '../services/api-url.service';
import { isPlatformBrowser } from '@angular/common';
import { map } from 'rxjs';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const apiUrl = inject(ApiUrlService);
  const platformId = inject(PLATFORM_ID);

  return authService.checkSession().pipe(
    map((isAuthenticated) => {
      if (isAuthenticated) {
        return true;
      }

      if (isPlatformBrowser(platformId as object)) {
        window.location.href = apiUrl.url.replace('/api', '') + '/oauth2/authorization/keycloak';
      } else {
        console.log('SSR: User not logged in, allowing render for client-side redirect.');
        return true;
      }
      return false;
    }),
  );
};
