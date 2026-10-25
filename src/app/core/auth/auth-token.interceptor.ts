import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap } from 'rxjs';
import { AuthService } from '../services/auth/auth.service';
import { ApiUrlService } from '../services/api-url.service';

export const authTokenInterceptor: HttpInterceptorFn = (req, next) => {
  const apiUrl = inject(ApiUrlService);
  if (!req.url.startsWith(apiUrl.url)) {
    return next(req);
  }

  const authService = inject(AuthService);
  return from(authService.getIdToken()).pipe(
    switchMap((token) =>
      next(token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req),
    ),
  );
};
