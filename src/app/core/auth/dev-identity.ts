import { HttpInterceptorFn } from '@angular/common/http';
import { InjectionToken, Provider, Type } from '@angular/core';

/**
 * Who the development build acts as on the local stack: a seed user or a guest. Only
 * `environment.development.ts` provides one, so a production build holds just this file's types and token.
 */
export interface DevIdentity {
  /** Acting as a guest, so the app shows itself signed out and the API sees no user. */
  isGuest(): boolean;
  /** Opens the menu that picks who to act as. */
  openMenu(): void;
  /** Goes on as a guest. */
  signOut(): void;
}

/** What the development environment plugs into the app. */
export interface DevTools {
  providers: Provider[];
  interceptor: HttpInterceptorFn;
  component: Type<unknown>;
}

export const DEV_IDENTITY = new InjectionToken<DevIdentity>('DEV_IDENTITY');
