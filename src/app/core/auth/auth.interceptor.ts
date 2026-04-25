import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { inject } from '@angular/core';
import { ApiUrlService } from '../services/api-url.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const apiUrl = inject(ApiUrlService);
  if (req.url.includes(apiUrl.path('/auth/me'))) {
    return next(req);
  }

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        //TODO REDIRECT NA LOGOWANIE
      }
      return throwError(() => error);
    }),
  );
};
