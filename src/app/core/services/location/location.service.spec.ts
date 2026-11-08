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
  });

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

  describe('on the first open', () => {
    it('asks when the browser has not decided yet', async () => {
      permissionIs('prompt');
      allowPosition();

      expect(await service.currentOrAsk(1500, 1000)).toEqual({ latitude: 54.35, longitude: 18.65 });
    });

    it('asks only once per visit', async () => {
      permissionIs('prompt');
      allowPosition();

      await service.currentOrAsk(1500, 1000);
      expect(await service.currentOrAsk(1500, 1000)).toBeNull();
      expect(getPosition).toHaveBeenCalledTimes(1);
    });

    it('stops waiting for an answer that does not come', async () => {
      permissionIs('prompt');

      expect(await service.currentOrAsk(1500, 1)).toBeNull();
    });

    it('never asks once the user has refused in the browser', async () => {
      permissionIs('denied');

      expect(await service.currentOrAsk(1500, 1000)).toBeNull();
      expect(getPosition).not.toHaveBeenCalled();
    });

    it('uses a position already allowed without asking', async () => {
      permissionIs('granted');
      allowPosition();

      expect(await service.currentOrAsk(1500, 1000)).toEqual({ latitude: 54.35, longitude: 18.65 });
    });
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
