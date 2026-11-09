import { isPlatformBrowser } from '@angular/common';
import { DOCUMENT, inject, Injectable, PLATFORM_ID, REQUEST, signal } from '@angular/core';
import { DevIdentity } from '../core/auth/dev-identity';
import { DEV_USERS, DevUser } from './dev-users';

/** Holds the choice for the browser and for server rendering alike, so both fetch as the same user. */
export const DEV_USER_COOKIE = 'coolture_dev_user';
const GUEST = 'guest';
const ONE_YEAR_S = 365 * 24 * 60 * 60;

/** Who the development build acts as. A fresh browser is a guest. */
@Injectable()
export class DevIdentityService implements DevIdentity {
  private document = inject(DOCUMENT);
  private request = inject(REQUEST, { optional: true });
  private platformId = inject(PLATFORM_ID);

  readonly users = DEV_USERS;
  /** The user acted as, or null for a guest. */
  readonly current = signal<DevUser | null>(this.read());
  readonly menuOpen = signal(false);

  isGuest(): boolean {
    return this.current() === null;
  }

  openMenu(): void {
    this.menuOpen.set(true);
  }

  signOut(): void {
    this.switchTo(null);
  }

  /** Saves the choice and reloads, so nothing fetched as the previous user stays on screen. */
  switchTo(user: DevUser | null): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    this.document.cookie = `${DEV_USER_COOKIE}=${user?.id ?? GUEST}; path=/; max-age=${ONE_YEAR_S}; SameSite=Lax`;
    this.document.defaultView?.location.reload();
  }

  /** What the local API reads instead of a token. A guest is said out loud, as no header means local_dev. */
  headers(): Record<string, string> {
    const user = this.current();
    if (!user) {
      return { 'X-Anonymous': 'true' };
    }
    return {
      'X-User-Id': user.id,
      'X-User-Name': user.username,
      ...(user.role ? { 'X-User-Role': user.role } : {}),
    };
  }

  private read(): DevUser | null {
    const cookies = isPlatformBrowser(this.platformId)
      ? this.document.cookie
      : (this.request?.headers.get('cookie') ?? '');
    const id = cookies
      .split(';')
      .map((cookie) => cookie.trim().split('='))
      .find(([name]) => name === DEV_USER_COOKIE)?.[1];
    return this.users.find((user) => user.id === id) ?? null;
  }
}
