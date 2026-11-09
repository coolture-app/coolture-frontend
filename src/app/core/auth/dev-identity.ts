import { InjectionToken, Provider, Type } from '@angular/core';

/** Who the development build acts as on the local stack: a seed user or a guest. */
export interface DevIdentity {
  /** Acting as a guest, so the app shows itself signed out. */
  isGuest(): boolean;
  openMenu(): void;
  signOut(): void;
  /** What the local API reads in place of a token. */
  headers(): Record<string, string>;
}

export interface DevTools {
  providers: Provider[];
  component: Type<unknown>;
}

export const DEV_IDENTITY = new InjectionToken<DevIdentity>('DEV_IDENTITY');
