import { isPlatformBrowser } from '@angular/common';
import { DOCUMENT, inject, Injectable, PLATFORM_ID, REQUEST, signal } from '@angular/core';
import { DevIdentity } from '../core/auth/dev-identity';
import { DEV_USERS, DevUser, GUEST } from './dev-users';

/** Holds the choice for the browser and for server rendering alike, so both fetch as the same user. */
export const DEV_USER_COOKIE = 'coolture_dev_user';
const ONE_YEAR_S = 365 * 24 * 60 * 60;

@Injectable()
export class DevIdentityService implements DevIdentity {
  private document = inject(DOCUMENT);
  private request = inject(REQUEST, { optional: true });
  private platformId = inject(PLATFORM_ID);

  readonly users = DEV_USERS;
  /** Fixed for the page's life: a switch reloads it. A fresh browser is a guest. */
  readonly current = this.read();
  readonly menuOpen = signal(false);

  isGuest(): boolean {
    return this.current === GUEST;
  }

  openMenu(): void {
    this.menuOpen.set(true);
  }

  signOut(): void {
    this.switchTo(GUEST);
  }

  headers(): Record<string, string> {
    return this.current.headers;
  }

  /** Saves the choice and reloads, so nothing fetched as the previous user stays on screen. */
  switchTo(user: DevUser): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    this.document.cookie = `${DEV_USER_COOKIE}=${user.id}; path=/; max-age=${ONE_YEAR_S}; SameSite=Lax`;
    this.document.defaultView?.location.reload();
  }

  private read(): DevUser {
    const cookies = isPlatformBrowser(this.platformId)
      ? this.document.cookie
      : (this.request?.headers.get('cookie') ?? '');
    const id = cookies
      .split(';')
      .map((cookie) => cookie.trim().split('='))
      .find(([name]) => name === DEV_USER_COOKIE)?.[1];
    return this.users.find((user) => user.id === id) ?? GUEST;
  }
}
