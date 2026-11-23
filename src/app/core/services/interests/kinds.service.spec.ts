import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { InterestsService } from './interests.service';
import { KindsService } from './kinds.service';

describe('KindsService', () => {
  it('leaves no names when the catalogue fails, so a kind shows none rather than a raw key', () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: InterestsService,
          useValue: { getCatalog: () => throwError(() => new Error('down')) },
        },
      ],
    });
    const kinds = TestBed.inject(KindsService);

    expect(kinds.kinds()).toEqual([]);
    expect(kinds.name('concerts')).toBeNull();
    expect(kinds.eventName('concerts')).toBeNull();
  });

  it('loads the kinds on a later try after one failure', () => {
    jasmine.clock().install();
    const concerts = { key: 'concerts', labelPl: 'Koncerty', labelEn: 'Concerts' };
    let calls = 0;
    TestBed.configureTestingModule({
      providers: [
        {
          provide: InterestsService,
          useValue: {
            getCatalog: () =>
              ++calls === 1 ? throwError(() => new Error('down')) : of({ kinds: [concerts] }),
          },
        },
      ],
    });
    const kinds = TestBed.inject(KindsService);

    try {
      expect(kinds.name('concerts')).toBeNull();
      jasmine.clock().tick(1000);

      expect(kinds.name('concerts')).toBe('Koncerty');
    } finally {
      jasmine.clock().uninstall();
    }
  });

  it('names a kind from the catalogue', () => {
    const concerts = { key: 'concerts', labelPl: 'Koncerty', labelEn: 'Concerts' };
    TestBed.configureTestingModule({
      providers: [
        { provide: InterestsService, useValue: { getCatalog: () => of({ kinds: [concerts] }) } },
      ],
    });

    expect(TestBed.inject(KindsService).name('concerts')).toBe('Koncerty');
  });
});
