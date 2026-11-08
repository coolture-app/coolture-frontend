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

function within<T>(promise: Promise<T | null>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

/**
 * The only code that touches `navigator.geolocation` or `navigator.permissions`, so a native wrapper
 * would change only this class. The position is never stored. To opt out, the user denies the
 * browser's permission; there's no separate switch here.
 */
@Injectable({
  providedIn: 'root',
})
export class LocationService {
  private platformId = inject(PLATFORM_ID);
  private asked = false;

  /** The position if the user has already allowed it, never prompting. Null if not, or if late. */
  async currentIfAllowed(maxWaitMs: number): Promise<GeoPoint | null> {
    if ((await this.permission()) !== 'granted') {
      return null;
    }
    return within(this.request(), maxWaitMs);
  }

  /**
   * Like `currentIfAllowed`, but when the browser hasn't decided yet, it asks: once per visit, and
   * waiting at most `maxAnswerMs` for the answer, so an ignored prompt can't hold the page up.
   */
  async currentOrAsk(maxWaitMs: number, maxAnswerMs: number): Promise<GeoPoint | null> {
    const state = await this.permission();
    if (state === 'granted') {
      return within(this.request(), maxWaitMs);
    }
    if (state === 'prompt' && !this.asked) {
      this.asked = true;
      return within(this.request(), maxAnswerMs);
    }
    return null;
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
