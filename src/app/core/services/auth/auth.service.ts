import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { UserRole } from '../../models/auth/role';
import { catchError, map, Observable, of, tap } from 'rxjs';
import { ApiUrlService } from '../api-url.service';

interface AuthMeResponse {
  id: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private http = inject(HttpClient);
  private apiUrl = inject(ApiUrlService);

  // ==== getters and setters for auth vars ====
  readonly isAuthenticated = signal<boolean>(false);
  readonly role = signal<UserRole>(UserRole.Guest);
  readonly userId = signal<string>('');

  setIsAuthenticated(value: boolean): void {
    this.isAuthenticated.set(value);
  }

  getIsAuthenticated(): boolean {
    return this.isAuthenticated();
  }

  setRole(value: UserRole): void {
    this.role.set(value);
  }

  getRole(): UserRole {
    return this.role();
  }

  setUserId(value: string): void {
    this.userId.set(value);
  }

  getUserId(): string {
    return this.userId();
  }

  // ==== api calls ====
  checkSession(): Observable<boolean> {
    return this.http
      .get<AuthMeResponse>(this.apiUrl.path('/auth/me'), { withCredentials: true })
      .pipe(
        tap((response) => {
          this.setIsAuthenticated(true);
          this.setUserId(response.id);
          console.log(this.getIsAuthenticated());
        }),
        map(() => true),
        catchError(() => {
          this.setIsAuthenticated(false);
          this.setUserId('');
          return of(false);
        }),
      );
  }
}
