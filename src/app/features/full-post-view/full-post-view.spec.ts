import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FullPostView } from './full-post-view';

describe('FullPostView', () => {
  let component: FullPostView;
  let fixture: ComponentFixture<FullPostView>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FullPostView],
    }).compileComponents();

    fixture = TestBed.createComponent(FullPostView);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
