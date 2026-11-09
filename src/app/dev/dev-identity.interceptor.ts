import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { ApiUrlService } from '../core/services/api-url.service';
import { DevIdentityService } from './dev-identity.service';

/** Tells the local API who the dev menu acts as. AWS ignores these headers. */
export const devIdentityInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(inject(ApiUrlService).url)) {
    return next(req);
  }
  return next(req.clone({ setHeaders: inject(DevIdentityService).headers() }));
};
