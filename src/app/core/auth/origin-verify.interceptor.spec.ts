import { HttpHandlerFn, HttpRequest } from '@angular/common/http';
import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiUrlService } from '../services/api-url.service';
import { originVerifyInterceptor } from './origin-verify.interceptor';

describe('originVerifyInterceptor', () => {
  const runtime = globalThis as { process?: unknown };
  const original = runtime.process;

  beforeEach(() => {
    runtime.process = { env: { ORIGIN_VERIFY_SECRET: 'secret' } };
  });

  afterEach(() => {
    runtime.process = original;
  });

  function originVerify(platform: string, apiOwnsUrl: boolean): string | null {
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: platform },
        { provide: ApiUrlService, useValue: { owns: () => apiOwnsUrl } },
      ],
    });
    let header: string | null = null;
    const next: HttpHandlerFn = (req) => {
      header = req.headers.get('X-Origin-Verify');
      return of();
    };
    TestBed.runInInjectionContext(() =>
      originVerifyInterceptor(
        new HttpRequest('GET', 'https://any.example.com/x'),
        next,
      ).subscribe(),
    );
    return header;
  }

  it('sends the secret from the server to the API', () => {
    expect(originVerify('server', true)).toBe('secret');
  });

  it('keeps the secret off a URL that is not the API', () => {
    expect(originVerify('server', false)).toBeNull();
  });

  it('sends nothing from the browser', () => {
    expect(originVerify('browser', true)).toBeNull();
  });
});
