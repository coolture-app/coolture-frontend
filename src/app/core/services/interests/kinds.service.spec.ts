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
