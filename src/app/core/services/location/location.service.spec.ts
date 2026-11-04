import { TestBed } from '@angular/core/testing';

import { LocationService } from './location.service';

describe('LocationService', () => {
  let service: LocationService;
  let getPosition: jasmine.Spy;

  function allowPosition(latitude = 54.34567, longitude = 18.64512): void {
    getPosition.and.callFake((success: PositionCallback) =>
      success({ coords: { latitude, longitude } } as GeolocationPosition),
    );
  }

  function permissionIs(state: PermissionState): void {
    spyOn(navigator.permissions, 'query').and.resolveTo({ state } as PermissionStatus);
  }

  beforeEach(() => {
    service = TestBed.inject(LocationService);
    getPosition = spyOn(navigator.geolocation, 'getCurrentPosition');
    localStorage.removeItem('coolture.location.off');
  });

  afterEach(() => localStorage.removeItem('coolture.location.off'));

  it('rounds to 2 decimals before anything else sees the position', async () => {
    allowPosition(54.34567, -18.645);

    expect(await service.request()).toEqual({ latitude: 54.35, longitude: -18.64 });
  });

  it('asks for a coarse, recent position', async () => {
    allowPosition();

    await service.request();

    expect(getPosition.calls.mostRecent().args[2]).toEqual({
      enableHighAccuracy: false,
      timeout: 5000,
      maximumAge: 600000,
    });
  });

  it('returns null when the user refuses', async () => {
    getPosition.and.callFake((_: PositionCallback, failure: PositionErrorCallback) =>
      failure({ code: 1 } as GeolocationPositionError),
    );

    expect(await service.request()).toBeNull();
  });

  it('uses the position without prompting when already granted', async () => {
    permissionIs('granted');
    allowPosition();

    expect(await service.currentIfAllowed(1500)).toEqual({ latitude: 54.35, longitude: 18.65 });
  });

  it('never touches geolocation, so never prompts, unless granted', async () => {
    const query = spyOn(navigator.permissions, 'query');

    for (const state of ['prompt', 'denied'] as PermissionState[]) {
      query.and.resolveTo({ state } as PermissionStatus);

      expect(await service.currentIfAllowed(1500)).toBeNull();
    }
    expect(getPosition).not.toHaveBeenCalled();
  });

  it('stays off once turned off, even with the permission granted', async () => {
    permissionIs('granted');
    allowPosition();

    service.turnOff();

    expect(await service.currentIfAllowed(1500)).toBeNull();
    expect(getPosition).not.toHaveBeenCalled();
  });

  it('turns on again when the user asks for the position and gets it', async () => {
    permissionIs('granted');
    allowPosition();
    service.turnOff();

    await service.request();

    expect(await service.currentIfAllowed(1500)).toEqual({ latitude: 54.35, longitude: 18.65 });
  });

  it('stays off when a new request is refused', async () => {
    permissionIs('granted');
    service.turnOff();
    getPosition.and.callFake((_: PositionCallback, failure: PositionErrorCallback) =>
      failure({ code: 1 } as GeolocationPositionError),
    );

    await service.request();

    allowPosition();
    expect(await service.currentIfAllowed(1500)).toBeNull();
  });

  it('gives up when the position is late, so the feed can load without it', async () => {
    permissionIs('granted');

    expect(await service.currentIfAllowed(1)).toBeNull();
  });

  it('treats a missing permissions API as unknown, without prompting', async () => {
    Object.defineProperty(navigator, 'permissions', { value: undefined, configurable: true });

    try {
      expect(await service.currentIfAllowed(1500)).toBeNull();
      expect(getPosition).not.toHaveBeenCalled();
    } finally {
      delete (navigator as unknown as Record<string, unknown>)['permissions'];
    }
  });

  it('treats a failing permissions query as unknown, without prompting', async () => {
    spyOn(navigator.permissions, 'query').and.rejectWith(new TypeError('not supported'));

    expect(await service.currentIfAllowed(1500)).toBeNull();
    expect(getPosition).not.toHaveBeenCalled();
  });
});
