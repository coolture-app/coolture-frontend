import { HttpInterceptorFn } from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { ApiUrlService } from '../services/api-url.service';

export const originVerifyInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isPlatformServer(inject(PLATFORM_ID))) {
    return next(req);
  }
  const secret = serverEnv('ORIGIN_VERIFY_SECRET');
  if (!secret || !req.url.startsWith(inject(ApiUrlService).url)) {
    return next(req);
  }
  return next(req.clone({ setHeaders: { 'X-Origin-Verify': secret } }));
};

function serverEnv(name: string): string | undefined {
  const runtime = globalThis as { process?: { env?: Record<string, string | undefined> } };
  return runtime.process?.env?.[name];
}
