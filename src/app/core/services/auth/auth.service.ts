import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal, computed } from '@angular/core';
import { catchError, map, Observable, of, tap } from 'rxjs';
import { ApiUrlService } from '../api-url.service';
import { UserProfile } from '../../models/users/user-profile.model';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private http = inject(HttpClient);
  private apiUrl = inject(ApiUrlService);

  readonly currentUser = signal<UserProfile | null>(null);
  readonly isAuthenticated = computed(() => this.currentUser() !== null);
  readonly userId = computed(() => this.currentUser()?.id ?? '');

  // --- API Calls ---
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

  logout(): void {
    this.currentUser.set(null);
    //TODO ADD LOGOUT TO CLEAR COOKIE
  }
}
