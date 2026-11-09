import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, signal, computed, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { catchError, finalize, map, Observable, of, shareReplay, tap } from 'rxjs';
import { ApiUrlService } from '../api-url.service';
import { Me, UserProfile } from '../../models/users/user-profile.model';
import { environment } from '../../../../environments/environment';
import { DEV_IDENTITY } from '../../auth/dev-identity';

interface StoredTokens {
  idToken: string;
  refreshToken?: string;
  expiresAt: number;
}

interface PendingLogin {
  state: string;
  verifier: string;
  returnUrl: string;
}

interface TokenResponse {
  id_token: string;
  access_token: string;
  refresh_token?: string;
}

const TOKENS_KEY = 'coolture.auth.tokens';
const PENDING_LOGIN_KEY = 'coolture.auth.pending-login';
const LOCAL_LOGOUT_KEY = 'coolture.auth.local-logout';
const REFRESH_MARGIN_MS = 60_000;
const SCOPES = 'openid email profile';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private http = inject(HttpClient);
  private apiUrl = inject(ApiUrlService);
  private platformId = inject(PLATFORM_ID);
  /** Development builds act as whoever the DEV pill says, in place of a login. */
  private devIdentity = inject(DEV_IDENTITY, { optional: true });
  private refreshing: Promise<string | null> | null = null;
  private sessionCheck: Observable<boolean> | null = null;

  readonly currentUser = signal<UserProfile | null>(null);
  /**
   * Whether the signed-in user has picked interests, or null while unknown.
   * A selection can only be replaced, never removed, so once true it stays true for the session
   * and a /auth/me response sent before a save cannot undo it.
   */
  readonly interestsSelected = signal<boolean | null>(null);
  readonly isAuthenticated = computed(() => this.currentUser() !== null);
  readonly userId = computed(() => this.currentUser()?.id ?? '');

  checkSession(): Observable<boolean> {
    if (this.isSignedOut()) {
      this.clearUser();
      return of(false);
    }
    this.sessionCheck ??= this.http.get<Me>(this.apiUrl.path('/auth/me')).pipe(
      tap(({ interestsSelected, ...profile }) => {
        this.currentUser.set(profile);
        this.interestsSelected.update((selected) => selected || interestsSelected);
      }),
      map(() => true),
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401 || error.status === 403) {
          this.clearUser();
        }
        return of(false);
      }),
      finalize(() => (this.sessionCheck = null)),
      shareReplay(1),
    );
    return this.sessionCheck;
  }

  markInterestsSelected(): void {
    this.interestsSelected.set(true);
  }

  private clearUser(): void {
    this.currentUser.set(null);
    this.interestsSelected.set(null);
  }

  async login(returnUrl?: string): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    if (this.devIdentity) {
      this.devIdentity.openMenu();
      return;
    }
    if (!this.isCognitoConfigured()) {
      localStorage.removeItem(LOCAL_LOGOUT_KEY);
      window.location.assign(returnUrl ?? '/');
      return;
    }
    const verifier = randomBase64Url(64);
    const state = randomBase64Url(32);
    const pending: PendingLogin = {
      state,
      verifier,
      returnUrl:
        returnUrl ?? window.location.pathname + window.location.search + window.location.hash,
    };
    sessionStorage.setItem(PENDING_LOGIN_KEY, JSON.stringify(pending));

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: environment.cognito.clientId,
      redirect_uri: this.redirectUri(),
      scope: SCOPES,
      state,
      code_challenge: await sha256Base64Url(verifier),
      code_challenge_method: 'S256',
    });
    window.location.assign(`${environment.cognito.domain}/oauth2/authorize?${params}`);
  }

  async completeLogin(code: string | null, state: string | null): Promise<string> {
    const pending = this.takePendingLogin();
    if (!code || !pending || pending.state !== state) {
      throw new Error('Invalid or unexpected login response');
    }
    const tokens = await this.requestTokens({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.redirectUri(),
      code_verifier: pending.verifier,
    });
    this.storeTokens(tokens);
    return pending.returnUrl;
  }

  async getIdToken(): Promise<string | null> {
    const tokens = this.readTokens();
    if (!tokens) {
      return null;
    }
    if (tokens.expiresAt - REFRESH_MARGIN_MS > Date.now()) {
      return tokens.idToken;
    }
    if (!tokens.refreshToken) {
      this.clearTokens();
      return null;
    }
    this.refreshing ??= this.refresh(tokens.refreshToken).finally(() => (this.refreshing = null));
    return this.refreshing;
  }

  logout(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    this.clearTokens();
    this.clearUser();
    if (this.devIdentity) {
      this.devIdentity.signOut();
      return;
    }
    if (!this.isCognitoConfigured()) {
      localStorage.setItem(LOCAL_LOGOUT_KEY, 'true');
      window.location.assign('/');
      return;
    }
    const params = new URLSearchParams({
      client_id: environment.cognito.clientId,
      logout_uri: `${window.location.origin}/`,
    });
    window.location.assign(`${environment.cognito.domain}/logout?${params}`);
  }

  private async refresh(refreshToken: string): Promise<string | null> {
    try {
      const tokens = await this.requestTokens({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      });
      this.storeTokens({ ...tokens, refresh_token: tokens.refresh_token ?? refreshToken });
      return tokens.id_token;
    } catch {
      this.clearTokens();
      this.clearUser();
      return null;
    }
  }

  private async requestTokens(body: Record<string, string>): Promise<TokenResponse> {
    const response = await fetch(`${environment.cognito.domain}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: environment.cognito.clientId, ...body }),
    });
    if (!response.ok) {
      throw new Error(`Token request failed with status ${response.status}`);
    }
    return response.json();
  }

  private isSignedOut(): boolean {
    if (this.devIdentity) {
      return this.devIdentity.isGuest();
    }
    if (this.isCognitoConfigured()) {
      return !this.readTokens();
    }
    return isPlatformBrowser(this.platformId) && !!localStorage.getItem(LOCAL_LOGOUT_KEY);
  }

  private isCognitoConfigured(): boolean {
    return !!environment.cognito.domain && !!environment.cognito.clientId;
  }

  private redirectUri(): string {
    return `${window.location.origin}/auth/callback`;
  }

  private readTokens(): StoredTokens | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }
    try {
      const raw = localStorage.getItem(TOKENS_KEY);
      return raw ? (JSON.parse(raw) as StoredTokens) : null;
    } catch {
      return null;
    }
  }

  private storeTokens(tokens: TokenResponse): void {
    const stored: StoredTokens = {
      idToken: tokens.id_token,
      refreshToken: tokens.refresh_token,
      expiresAt: jwtExpiry(tokens.id_token),
    };
    localStorage.setItem(TOKENS_KEY, JSON.stringify(stored));
  }

  private clearTokens(): void {
    try {
      localStorage.removeItem(TOKENS_KEY);
    } catch {
      return;
    }
  }

  private takePendingLogin(): PendingLogin | null {
    const raw = sessionStorage.getItem(PENDING_LOGIN_KEY);
    sessionStorage.removeItem(PENDING_LOGIN_KEY);
    return raw ? (JSON.parse(raw) as PendingLogin) : null;
  }
}

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomBase64Url(byteLength: number): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

async function sha256Base64Url(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return base64Url(new Uint8Array(digest));
}

function jwtExpiry(jwt: string): number {
  const payload = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  return (JSON.parse(atob(payload)) as { exp: number }).exp * 1000;
}
