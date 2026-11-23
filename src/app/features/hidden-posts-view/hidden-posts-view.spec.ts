import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { HiddenPostsView } from './hidden-posts-view';

describe('HiddenPostsView', () => {
  let fixture: ComponentFixture<HiddenPostsView>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HiddenPostsView] }).compileComponents();
    fixture = TestBed.createComponent(HiddenPostsView);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  it('asks for the viewer’s marks, newest first, ended ones too', () => {
    const request = http.expectOne((r) => r.url.endsWith('/posts'));
    const params = request.request.params;

    expect(params.getAll('participationTypes')).toEqual(['NOT_INTERESTED']);
    expect(params.get('sortBy')).toBe('STANCE_NEWEST');
    expect(params.get('includePast')).toBe('true');
  });

  it('says so when nothing is hidden', () => {
    http
      .expectOne((r) => r.url.endsWith('/posts'))
      .flush({ items: [], page: { limit: 20, hasMore: false } });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.hidden-posts__empty').textContent).toContain(
      'HIDDEN.empty',
    );
  });
});
