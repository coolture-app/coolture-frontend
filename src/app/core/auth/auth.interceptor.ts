import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  // we are ignoring 401 errors from /me path because it's being
  // handled by auth service (it's used to determine if user is authenticated)
  if (req.url.includes(`${environment.apiUrl}/me`)) {
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
