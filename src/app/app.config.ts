import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter, withInMemoryScrolling, withRouterConfig } from '@angular/router';
import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';

// TRANSLATION MODULE
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { errorInterceptor } from './core/auth/auth.interceptor';
import { authTokenInterceptor } from './core/auth/auth-token.interceptor';
import { originVerifyInterceptor } from './core/auth/origin-verify.interceptor';
import { devTools } from '../environments/dev-tools';
import { BackService } from './core/services/back/back.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    // Forward navigations open at the top, and Back and Forward put the scroll back, after rendering.
    // 'computed' writes the page id that BackService tells a push from a replace by.
    provideRouter(
      routes,
      withRouterConfig({ canceledNavigationResolution: 'computed' }),
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled' }),
    ),
    // Before the first navigation, so the back link knows every page this tab opened.
    provideAppInitializer(() => void inject(BackService)),
    provideClientHydration(withEventReplay()),
    provideHttpClient(
      withFetch(),
      withInterceptors([errorInterceptor, authTokenInterceptor, originVerifyInterceptor]),
    ),
    ...(devTools?.providers ?? []),
    provideTranslateService({
      loader: provideTranslateHttpLoader({ prefix: './i18n/', suffix: '.json' }),
    }),
  ],
};
