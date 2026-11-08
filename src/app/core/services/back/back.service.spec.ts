import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Location } from '@angular/common';
import { provideRouter, Router } from '@angular/router';
import { BackService } from './back.service';

@Component({ template: '' })
class Page {}

describe('BackService', () => {
  let router: Router;
  let location: Location;
  let back: BackService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: '', component: Page },
          { path: 'post/:id', component: Page },
        ]),
      ],
    });
    router = TestBed.inject(Router);
    location = TestBed.inject(Location);
    back = TestBed.inject(BackService);
  });

  it('goes back in history when the page before is in this app', async () => {
    await router.navigateByUrl('/');
    await router.navigateByUrl('/post/1');
    const historyBack = spyOn(location, 'back');

    back.back('/');

    expect(historyBack).toHaveBeenCalled();
  });

  it('goes to the fallback, in place of this page, when the app was opened here', async () => {
    await router.navigateByUrl('/post/1');
    const historyBack = spyOn(location, 'back');
    const navigate = spyOn(router, 'navigateByUrl').and.resolveTo(true);

    back.back('/');

    expect(historyBack).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/', { replaceUrl: true });
  });
});
