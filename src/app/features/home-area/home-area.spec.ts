import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { HomeArea } from './home-area';
import { NamedPlace } from '../../core/models/common/geo.model';
import { AuthService } from '../../core/services/auth/auth.service';
import { LocationService } from '../../core/services/location/location.service';

const OLIWA: NamedPlace = {
  name: 'Oliwa, Gdańsk',
  coordinates: { latitude: 54.41, longitude: 18.56 },
};

describe('HomeArea', () => {
  let fixture: ComponentFixture<HomeArea>;
  let element: HTMLElement;
  let http: HttpTestingController;
  let position: { latitude: number; longitude: number } | null;
  const home = signal<NamedPlace | null>(null);
  const auth = {
    home,
    userId: () => 'user-1',
    markHome: jasmine
      .createSpy('markHome')
      .and.callFake((place: NamedPlace | null) => home.set(place)),
  };
  let done: jasmine.Spy;

  async function render(onboarding = false): Promise<void> {
    TestBed.configureTestingModule({
      imports: [HomeArea],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: LocationService, useValue: { request: () => Promise.resolve(position) } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(HomeArea);
    fixture.componentRef.setInput('onboarding', onboarding);
    done = jasmine.createSpy('done');
    fixture.componentInstance.done.subscribe(done);
    await fixture.whenStable();
    element = fixture.nativeElement;
  }

  async function settle(): Promise<void> {
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }

  function button(label: string): HTMLButtonElement {
    return [...element.querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => b.textContent!.trim() === label,
    )!;
  }

  beforeEach(() => {
    home.set(null);
    position = null;
    auth.markHome.calls.reset();
  });

  afterEach(() => http.verify());

  it('fills the district around the browser position, and saves only that', async () => {
    position = { latitude: 54.41, longitude: 18.56 };
    await render(true);

    button('HOME_AREA.useMyLocation').click();
    await settle();
    http
      .expectOne((r) => r.url === '/geo/reverse')
      .flush({
        features: [
          {
            geometry: { coordinates: [18.5601, 54.4112] },
            properties: { type: 'district', name: 'Oliwa', city: 'Gdańsk' },
          },
        ],
      });
    await settle();
    expect(element.querySelector('.home-area__name')!.textContent).toBe('Oliwa, Gdańsk');

    button('HOME_AREA.save').click();
    await settle();
    const put = http.expectOne((r) => r.url.endsWith('/users/user-1/home'));
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({
      name: 'Oliwa, Gdańsk',
      coordinates: { latitude: 54.4112, longitude: 18.5601 },
    });
    put.flush(OLIWA);
    await settle();

    expect(auth.markHome).toHaveBeenCalledWith(OLIWA);
    expect(done).toHaveBeenCalled();
  });

  it('says so when the browser gives no position', async () => {
    await render(true);

    button('HOME_AREA.useMyLocation').click();
    await settle();

    expect(element.querySelector('.home-area__error')!.textContent).toContain(
      'HOME_AREA.noPosition',
    );
  });

  it('can be skipped in onboarding, saving nothing', async () => {
    await render(true);

    button('HOME_AREA.skip').click();
    await settle();

    expect(done).toHaveBeenCalled();
    expect(auth.markHome).not.toHaveBeenCalled();
    expect(button('HOME_AREA.remove')).toBeUndefined();
  });

  it('removes a saved home on the profile', async () => {
    home.set(OLIWA);
    await render();
    expect(button('HOME_AREA.save').disabled).toBeTrue();

    button('HOME_AREA.remove').click();
    await settle();
    const removal = http.expectOne((r) => r.url.endsWith('/users/user-1/home'));
    expect(removal.request.method).toBe('DELETE');
    removal.flush(null);
    await settle();

    expect(auth.markHome).toHaveBeenCalledWith(null);
    expect(done).toHaveBeenCalled();
  });

  it('keeps the dialog open and says so when saving fails', async () => {
    home.set(OLIWA);
    await render();
    button('HOME_AREA.change').click();
    await settle();
    fixture.componentInstance['choose']({
      name: 'Sopot',
      coordinates: { latitude: 54.44, longitude: 18.56 },
    });
    await settle();

    button('HOME_AREA.save').click();
    await settle();
    http
      .expectOne((r) => r.url.endsWith('/users/user-1/home'))
      .flush('down', { status: 500, statusText: 'Error' });
    await settle();

    expect(done).not.toHaveBeenCalled();
    expect(element.querySelector('.home-area__error')!.textContent).toContain(
      'HOME_AREA.saveError',
    );
  });
});
