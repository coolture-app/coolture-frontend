import { TestBed } from '@angular/core/testing';

import { Comments } from './comments.service';

describe('Comments', () => {
  let service: Comments;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Comments);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
