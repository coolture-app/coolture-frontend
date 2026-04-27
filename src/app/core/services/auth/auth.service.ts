import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal, computed, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { catchError, map, Observable, of, tap } from 'rxjs';
import { ApiUrlService } from '../api-url.service';
import { UserProfile } from '../../models/users/user-profile.model';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private http = inject(HttpClient);
  private apiUrl = inject(ApiUrlService);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);

  readonly currentUser = signal<UserProfile | null>(null);
  readonly isAuthenticated = computed(() => this.currentUser() !== null);
  readonly userId = computed(() => this.currentUser()?.id ?? '');

  checkSession(): Observable<boolean> {
    return this.http.get<UserProfile>(this.apiUrl.path('/auth/me'), {}).pipe(
      tap((userProfile) => {
        this.currentUser.set(userProfile);
        console.log('Logged in as', userProfile.username);
      }),
      map(() => true),
      catchError((error) => {
        console.error('There is no active session', error.status);
        this.currentUser.set(null);
        return of(false);
      }),
    );
  }

  logout(): Observable<void> {
    this.currentUser.set(null);
    return this.http.post<void>(this.apiUrl.path('/auth/logout'), {}).pipe(
      tap(() => {
        if (isPlatformBrowser(this.platformId)) {
          this.clearAllCookies();
        }
      }),
    );
  }

  private clearAllCookies(): void {
    const hostname = window.location.hostname;
    const isSecure = window.location.protocol === 'https:';
    const domains = ['', hostname, `.${hostname}`];

    document.cookie.split(';').forEach((cookie) => {
      const cookieName = cookie.trim().split('=')[0];
      if (!cookieName) return;

      domains.forEach((domain) => {
        const base = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
        const domainPart = domain ? `; domain=${domain}` : '';

        document.cookie = base + domainPart;
        if (isSecure) {
          document.cookie = base + domainPart + '; secure';
        }
      });
    });
  }
}
