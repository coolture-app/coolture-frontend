import { HttpInterceptorFn } from '@angular/common/http';

export const credentialsInterceptor: HttpInterceptorFn = (req, next) => {
  // Do not attach credentials to S3 upload URLs as it breaks CORS
  if (req.url.includes('X-Amz-Algorithm')) {
    return next(req);
  }

  const clonedRequest = req.clone({
    withCredentials: true,
  });
  return next(clonedRequest);
};
