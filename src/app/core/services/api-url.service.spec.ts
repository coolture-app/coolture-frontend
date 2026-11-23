import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { ApiUrlService } from './api-url.service';

describe('ApiUrlService.owns', () => {
  const original = environment.apiUrlBrowser;

  function withApi(url: string): ApiUrlService {
    environment.apiUrlBrowser = url;
    return TestBed.inject(ApiUrlService);
  }

  afterEach(() => {
    environment.apiUrlBrowser = original;
  });

  it('takes the API itself and everything under it', () => {
    const api = withApi('https://api.example.com/v1');

    expect(api.owns('https://api.example.com/v1')).toBeTrue();
    expect(api.owns('https://api.example.com/v1/auth/me')).toBeTrue();
    expect(api.owns('https://api.example.com/v1?x=1')).toBeTrue();
  });

  it('leaves out a URL that only starts the same', () => {
    const api = withApi('https://api.example.com/v1');

    expect(api.owns('https://api.example.com/v12/auth/me')).toBeFalse();
    expect(api.owns('https://api.example.com/v1.evil.com')).toBeFalse();
    expect(
      withApi('https://api.example.com').owns('https://api.example.com.evil.com/'),
    ).toBeFalse();
  });

  it('owns nothing when the API has no address', () => {
    const api = withApi('');

    expect(api.owns('/anything')).toBeFalse();
    expect(api.owns('https://other.example.com/')).toBeFalse();
  });

  it('ignores a slash at the end of the API address', () => {
    const api = withApi('https://api.example.com/v1/');

    expect(api.owns('https://api.example.com/v1/users')).toBeTrue();
  });
});
