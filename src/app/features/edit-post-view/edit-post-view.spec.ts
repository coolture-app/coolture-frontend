import { ComponentFixture, TestBed } from '@angular/core/testing';

import { of } from 'rxjs';

import { EditPostView } from './edit-post-view';
import { PostService } from '../../core/services/post/post.service';
import { BackService } from '../../core/services/back/back.service';
import { PostDetail } from '../../core/models/posts/post-detail.model';
import { PostFormData } from '../../core/models/posts/post-form-data.model';

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

describe('EditPostView, after saving', () => {
  it('goes back to where the edit was opened, so the form leaves history', () => {
    const back = spyOn(TestBed.inject(BackService), 'back');
    spyOn(TestBed.inject(PostService), 'updatePost').and.returnValue(of({} as PostDetail));
    const fixture = TestBed.createComponent(EditPostView);
    fixture.componentInstance.currentPost.set({ id: 'p1' } as PostDetail);

    fixture.componentInstance.onFormSubmit({ tags: [], mediaIds: [] } as unknown as PostFormData);

    expect(back).toHaveBeenCalledWith('/post/p1');
  });
});
