import { TestBed } from '@angular/core/testing';

import { Health } from './health.service';

describe('Health', () => {
  let service: Health;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Health);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
