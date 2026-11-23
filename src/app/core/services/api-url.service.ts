import { isPlatformBrowser } from '@angular/common';
import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiUrlService {
  private platformId = inject(PLATFORM_ID);
  private baseUrl = isPlatformBrowser(this.platformId)
    ? environment.apiUrlBrowser
    : environment.apiUrlServer;

  get url(): string {
    return this.baseUrl;
  }

  /** Matches on a path boundary, so `/api2` or `api.example.com.evil.com` is not the API's own. */
  owns(url: string): boolean {
    const base = this.baseUrl.replace(/\/+$/, '');
    if (!base) {
      return false;
    }
    return url === base || ['/', '?', '#'].some((boundary) => url.startsWith(base + boundary));
  }

  path(path: string): string {
    return `${this.baseUrl}${path}`;
  }
}
