import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Me } from '../../models/users/user-profile.model';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;

  const respond = (interestsSelected: boolean) =>
    http
      .expectOne((request) => request.url.endsWith('/auth/me'))
      .flush({ id: 'user-1', interestsSelected } as Me);

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

    expect(service.interestsSelected()).toBeFalse();
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

    expect(service.interestsSelected()).toBeTrue();
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
