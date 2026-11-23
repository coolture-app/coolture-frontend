import { HttpHandlerFn, HttpRequest } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiUrlService } from '../services/api-url.service';
import { AuthService } from '../services/auth/auth.service';
import { authTokenInterceptor } from './auth-token.interceptor';

describe('authTokenInterceptor', () => {
  async function authorization(apiOwnsUrl: boolean): Promise<string | null> {
    TestBed.configureTestingModule({
      providers: [
        { provide: ApiUrlService, useValue: { owns: () => apiOwnsUrl } },
        { provide: AuthService, useValue: { getIdToken: () => Promise.resolve('token') } },
      ],
    });
    let header: string | null = null;
    const next: HttpHandlerFn = (req) => {
      header = req.headers.get('Authorization');
      return of();
    };
    TestBed.runInInjectionContext(() =>
      authTokenInterceptor(new HttpRequest('GET', 'https://any.example.com/x'), next).subscribe(),
    );
    await new Promise((resolve) => setTimeout(resolve));
    return header;
  }

  it('puts the token on a request to the API', async () => {
    expect(await authorization(true)).toBe('Bearer token');
  });

  it('keeps the token off a URL that is not the API', async () => {
    expect(await authorization(false)).toBeNull();
  });
});
