import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { GeoPoint } from '../../models/common/geo.model';

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
    if ((await this.permission()) !== 'granted') {
      return null;
    }
    return Promise.race([
      this.request(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), maxWaitMs)),
    ]);
  }

  /** Asks the browser, which prompts if the user hasn't decided yet. Null if refused or unavailable. */
  request(): Promise<GeoPoint | null> {
    return new Promise((resolve) => {
      if (!isPlatformBrowser(this.platformId) || !navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        ({ coords }) =>
          resolve({ latitude: rounded(coords.latitude), longitude: rounded(coords.longitude) }),
        () => resolve(null),
        POSITION_OPTIONS,
      );
    });
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
