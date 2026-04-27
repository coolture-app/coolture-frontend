import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { inject } from '@angular/core';
import { ApiUrlService } from '../services/api-url.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const apiUrl = inject(ApiUrlService);
  if (req.url.includes(apiUrl.path('/me'))) {
    return next(req);
  }

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        //TODO REDIRECT NA LOGOWANIE
        //TO wywali jak wykonamy jakąś akcje na nie chronionym pathie wymagająca autoryzacji, na razie w/e potem do zmiany jak na backu ustalimy
        //konkretnie ktore endpointy i funkcje na nich powinny byc protected a ktore nie
      }
      return throwError(() => error);
    }),
  );
};
