import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DOCUMENT, PLATFORM_ID, provideZonelessChangeDetection, REQUEST } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DEV_IDENTITY } from '../core/auth/dev-identity';
import { ApiUrlService } from '../core/services/api-url.service';
import { AuthService } from '../core/services/auth/auth.service';
import { devTools } from './dev-tools';
import { DEV_USER_COOKIE, DevIdentityService } from './dev-identity.service';

const ANNA = '00000000-0000-0000-0000-000000000002';
const LOCAL_DEV = '00000000-0000-0000-0000-000000000001';

describe('Dev identity', () => {
  let cookie: string;
  let reloads: number;

  // A document whose cookie and reload the specs can see, instead of the test runner's own.
  const fakeDocument = () => ({
    get cookie() {
      return cookie;
    },
    set cookie(value: string) {
      cookie = value.split(';')[0];
    },
    defaultView: { location: { reload: () => reloads++ } },
  });

  const setUp = (platform = 'browser', request: Request | null = null) => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(withInterceptors([devTools.interceptor])),
        provideHttpClientTesting(),
        ...devTools.providers,
        { provide: DOCUMENT, useFactory: fakeDocument },
        { provide: PLATFORM_ID, useValue: platform },
        { provide: REQUEST, useValue: request },
      ],
    });
    return TestBed.inject(DevIdentityService);
  };

  const sentHeaders = () => {
    const apiUrl = TestBed.inject(ApiUrlService).url;
    TestBed.inject(HttpClient).get(`${apiUrl}/posts`).subscribe();
    const request = TestBed.inject(HttpTestingController).expectOne(`${apiUrl}/posts`).request;
    return Object.fromEntries(request.headers.keys().map((key) => [key, request.headers.get(key)]));
  };

  beforeEach(() => {
    cookie = '';
    reloads = 0;
  });

  it('is a guest in a fresh browser, and tells the API so', () => {
    const identity = setUp();

    expect(identity.isGuest()).toBeTrue();
    expect(sentHeaders()).toEqual({ 'X-Anonymous': 'true' });
  });

  it('sends a seed user without a role, so the API treats them as a regular user', () => {
    cookie = `other=1; ${DEV_USER_COOKIE}=${ANNA}`;
    setUp();

    expect(sentHeaders()).toEqual({ 'X-User-Id': ANNA, 'X-User-Name': 'anna_demo' });
  });

  it('sends the admin role only for local_dev', () => {
    cookie = `${DEV_USER_COOKIE}=${LOCAL_DEV}`;
    setUp();

    expect(sentHeaders()['X-User-Role']).toBe('COOLTURE_ADMIN');
  });

  it('reads the choice from the request when rendering on the server', () => {
    // A browser's Request drops a cookie header, which Node's keeps, so this stands in for the server's.
    const request = {
      headers: new Headers({ cookie: `${DEV_USER_COOKIE}=${ANNA}` }),
    } as unknown as Request;

    const identity = setUp('server', request);

    expect(identity.current()?.username).toBe('anna_demo');
  });

  it('treats an unknown id as a guest', () => {
    cookie = `${DEV_USER_COOKIE}=nobody`;

    expect(setUp().isGuest()).toBeTrue();
  });

  it('saves a switch in the cookie and reloads the page', () => {
    const identity = setUp();

    identity.switchTo(identity.users[1]);

    expect(cookie).toBe(`${DEV_USER_COOKIE}=00000000-0000-0000-0000-000000000003`);
    expect(reloads).toBe(1);
  });

  it('signs out to a guest', () => {
    cookie = `${DEV_USER_COOKIE}=${ANNA}`;
    const identity = setUp();

    TestBed.inject(DEV_IDENTITY).signOut();

    expect(cookie).toBe(`${DEV_USER_COOKIE}=guest`);
    expect(identity.current()?.id).toBe(ANNA);
    expect(reloads).toBe(1);
  });

  it('makes the login button open the menu and a guest skip the session check', async () => {
    const identity = setUp();
    const auth = TestBed.inject(AuthService);
    const results: boolean[] = [];

    auth.checkSession().subscribe((result) => results.push(result));
    await auth.login();

    expect(results).toEqual([false]);
    expect(identity.menuOpen()).toBeTrue();
  });
});
