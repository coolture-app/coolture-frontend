import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { DEV_IDENTITY, DevIdentity } from '../../auth/dev-identity';
import { Me } from '../../models/users/user-profile.model';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;

  const respond = (onboarded: boolean) =>
    http
      .expectOne((request) => request.url.endsWith('/auth/me'))
      .flush({ id: 'user-1', onboarded } as Me);

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.removeItem('coolture.auth.local-logout');
  });

  it('treats a local logout as signed out without calling the API', () => {
    localStorage.setItem('coolture.auth.local-logout', 'true');
    const results: boolean[] = [];

    service.checkSession().subscribe((result) => results.push(result));

    expect(results).toEqual([false]);
    expect(service.currentUser()).toBeNull();
  });

  it('keeps the flag of a user without interests', () => {
    service.checkSession().subscribe();
    respond(false);

    expect(service.onboarded()).toBeFalse();
  });

  it('sends one request for session checks made at the same time', () => {
    const results: boolean[] = [];
    service.checkSession().subscribe((result) => results.push(result));
    service.checkSession().subscribe((result) => results.push(result));
    respond(true);

    expect(results).toEqual([true, true]);
  });

  it('sends a new request once the previous check has finished', () => {
    service.checkSession().subscribe();
    respond(true);

    service.checkSession().subscribe();
    respond(true);

    expect(service.isAuthenticated()).toBeTrue();
  });

  it('ignores an older response that says the interests are missing', () => {
    service.checkSession().subscribe();
    respond(true);

    service.checkSession().subscribe();
    respond(false);

    expect(service.onboarded()).toBeTrue();
  });

  it('keeps the user when the session check fails on the server side', () => {
    service.checkSession().subscribe();
    respond(true);

    service.checkSession().subscribe();
    http
      .expectOne((request) => request.url.endsWith('/auth/me'))
      .flush(null, { status: 503, statusText: 'Unavailable' });

    expect(service.isAuthenticated()).toBeTrue();
  });

  it('clears the user when the session is refused', () => {
    service.checkSession().subscribe();
    respond(true);

    service.checkSession().subscribe();
    http
      .expectOne((request) => request.url.endsWith('/auth/me'))
      .flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(service.isAuthenticated()).toBeFalse();
  });
});

describe('AuthService after a logout', () => {
  it('is not signed back in by a /auth/me that was sent before', () => {
    const identity: DevIdentity = {
      isGuest: () => false,
      openMenu: () => undefined,
      signOut: () => undefined,
      headers: () => ({}),
    };
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: DEV_IDENTITY, useValue: identity },
      ],
    });
    const service = TestBed.inject(AuthService);
    const http = TestBed.inject(HttpTestingController);
    const results: boolean[] = [];

    service.checkSession().subscribe((result) => results.push(result));
    service.logout();
    http
      .expectOne((request) => request.url.endsWith('/auth/me'))
      .flush({ id: 'user-1', onboarded: true } as Me);

    expect(service.isAuthenticated()).toBeFalse();
    expect(service.onboarded()).toBeNull();
    expect(results).toEqual([false]);
  });
});

describe('AuthService refreshing the token', () => {
  const key = 'coolture.auth.tokens';
  const cognito = { ...environment.cognito };
  let service: AuthService;

  function answerWith(response: Response | Error): void {
    spyOn(window, 'fetch').and.callFake(() =>
      response instanceof Error ? Promise.reject(response) : Promise.resolve(response),
    );
  }

  beforeEach(() => {
    environment.cognito.domain = 'https://auth.example.com';
    environment.cognito.clientId = 'client';
    localStorage.setItem(
      key,
      JSON.stringify({ idToken: 'old', refreshToken: 'refresh', expiresAt: Date.now() - 1000 }),
    );
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(AuthService);
  });

  afterEach(() => {
    Object.assign(environment.cognito, cognito);
    localStorage.removeItem(key);
  });

  it('keeps the tokens when Cognito cannot be reached', async () => {
    answerWith(new TypeError('Failed to fetch'));

    expect(await service.getIdToken()).toBeNull();
    expect(localStorage.getItem(key)).not.toBeNull();
  });

  it('keeps the tokens when Cognito fails on its side', async () => {
    answerWith(new Response('{}', { status: 503 }));

    expect(await service.getIdToken()).toBeNull();
    expect(localStorage.getItem(key)).not.toBeNull();
  });

  it('drops the tokens when Cognito refuses the refresh token', async () => {
    answerWith(new Response('{"error":"invalid_grant"}', { status: 400 }));

    expect(await service.getIdToken()).toBeNull();
    expect(localStorage.getItem(key)).toBeNull();
  });
});
