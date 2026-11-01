import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter, withRouterConfig } from '@angular/router';
import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';

// TRANSLATION MODULE
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { errorInterceptor } from './core/auth/auth.interceptor';
import { authTokenInterceptor } from './core/auth/auth-token.interceptor';
import { originVerifyInterceptor } from './core/auth/origin-verify.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes, withRouterConfig({ canceledNavigationResolution: 'computed' })),
    provideClientHydration(withEventReplay()),
    provideHttpClient(
      withInterceptors([errorInterceptor, authTokenInterceptor, originVerifyInterceptor]),
    ),
    provideTranslateService({
      loader: provideTranslateHttpLoader({ prefix: './i18n/', suffix: '.json' }),
    }),
  ],
};
