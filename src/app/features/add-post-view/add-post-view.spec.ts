import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddPostView } from './add-post-view';

describe('AddPostView', () => {
  let component: AddPostView;
  let fixture: ComponentFixture<AddPostView>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddPostView],
    }).compileComponents();

    fixture = TestBed.createComponent(AddPostView);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
