import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditPostView } from './edit-post-view';

describe('EditPostView', () => {
  let component: EditPostView;
  let fixture: ComponentFixture<EditPostView>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditPostView],
    }).compileComponents();

    fixture = TestBed.createComponent(EditPostView);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
