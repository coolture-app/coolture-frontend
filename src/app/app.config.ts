import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter, withInMemoryScrolling, withRouterConfig } from '@angular/router';
import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';

// TRANSLATION MODULE
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { errorInterceptor } from './core/auth/auth.interceptor';
import { authTokenInterceptor } from './core/auth/auth-token.interceptor';
import { originVerifyInterceptor } from './core/auth/origin-verify.interceptor';
import { environment } from '../environments/environment';

// Development builds only: the DEV pill's identity on the local stack.
const devTools = environment.devTools;

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    // Forward navigations open at the top, and Back and Forward put the scroll back, after rendering.
    provideRouter(
      routes,
      withRouterConfig({ canceledNavigationResolution: 'computed' }),
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled' }),
    ),
    provideClientHydration(withEventReplay()),
    provideHttpClient(
      withInterceptors([
        errorInterceptor,
        authTokenInterceptor,
        originVerifyInterceptor,
        ...(devTools ? [devTools.interceptor] : []),
      ]),
    ),
    ...(devTools?.providers ?? []),
    provideTranslateService({
      loader: provideTranslateHttpLoader({ prefix: './i18n/', suffix: '.json' }),
    }),
  ],
};
