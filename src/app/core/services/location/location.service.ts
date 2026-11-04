import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { GeoPoint } from '../../models/common/geo.model';

const TURNED_OFF_KEY = 'coolture.location.off';

const POSITION_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 5_000,
  maximumAge: 10 * 60 * 1000,
};

/** About 1.1 km. A precise position never leaves this service, so it can't reach URLs or logs. */
function rounded(coordinate: number): number {
  return Math.round(coordinate * 100) / 100;
}

/**
 * The only code that touches `navigator.geolocation` or `navigator.permissions`, so a native wrapper
 * would change only this class. The position is never stored.
 */
@Injectable({
  providedIn: 'root',
})
export class LocationService {
  private platformId = inject(PLATFORM_ID);

  /** The position if the user has already allowed it, never prompting. Null if not, or if late. */
  async currentIfAllowed(maxWaitMs: number): Promise<GeoPoint | null> {
    if (this.isTurnedOff() || (await this.permission()) !== 'granted') {
      return null;
    }
    return Promise.race([
      this.request(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), maxWaitMs)),
    ]);
  }

  /** The user switched nearby ranking off here, which the browser's permission can't express. */
  turnOff(): void {
    this.remember(true);
  }

  /** Asks the browser, which prompts if the user hasn't decided yet. Null if refused or unavailable. */
  request(): Promise<GeoPoint | null> {
    return new Promise((resolve) => {
      if (!isPlatformBrowser(this.platformId) || !navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          this.remember(false);
          resolve({ latitude: rounded(coords.latitude), longitude: rounded(coords.longitude) });
        },
        () => resolve(null),
        POSITION_OPTIONS,
      );
    });
  }

  private isTurnedOff(): boolean {
    return isPlatformBrowser(this.platformId) && localStorage.getItem(TURNED_OFF_KEY) === 'true';
  }

  private remember(turnedOff: boolean): void {
    if (turnedOff) {
      localStorage.setItem(TURNED_OFF_KEY, 'true');
    } else {
      localStorage.removeItem(TURNED_OFF_KEY);
    }
  }

  /** Unknown when the permissions API is missing or fails, as it can in some browsers and wrappers. */
  private async permission(): Promise<PermissionState | 'unknown'> {
    if (!isPlatformBrowser(this.platformId)) {
      return 'unknown';
    }
    try {
      return (await navigator.permissions.query({ name: 'geolocation' })).state;
    } catch {
      return 'unknown';
    }
  }
}
