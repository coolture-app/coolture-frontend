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

  path(path: string): string {
    return `${this.baseUrl}${path}`;
  }
}
