import { ComponentFixture, TestBed } from '@angular/core/testing';

import { of, Subject, throwError } from 'rxjs';

import { EditPostView } from './edit-post-view';
import { PostForm } from '../../core/components/post-form/post-form';
import { MediaService } from '../../core/services/media/media.service';
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

function formData(removedMediaIds: string[] = []): PostFormData {
  return { tags: [], mediaIds: [], removedMediaIds } as unknown as PostFormData;
}

describe('EditPostView, after saving', () => {
  it('goes back to where the edit was opened, so the form leaves history', () => {
    const back = spyOn(TestBed.inject(BackService), 'back');
    spyOn(TestBed.inject(PostService), 'updatePost').and.returnValue(of({} as PostDetail));
    const fixture = TestBed.createComponent(EditPostView);
    fixture.componentInstance.currentPost.set({ id: 'p1' } as PostDetail);

    fixture.componentInstance.onFormSubmit(formData());

    expect(back).toHaveBeenCalledWith('/posts/p1');
  });

  it('deletes the removed photos only once the post no longer holds them', () => {
    const saving = new Subject<PostDetail>();
    spyOn(TestBed.inject(BackService), 'back');
    spyOn(TestBed.inject(PostService), 'updatePost').and.returnValue(saving);
    const deleted = spyOn(TestBed.inject(MediaService), 'deleteMedia').and.returnValue(
      of(undefined),
    );
    const fixture = TestBed.createComponent(EditPostView);
    fixture.componentInstance.currentPost.set({ id: 'p1' } as PostDetail);

    fixture.componentInstance.onFormSubmit(formData(['m1']));
    expect(deleted).not.toHaveBeenCalled();

    saving.next({} as PostDetail);
    saving.complete();
    expect(deleted).toHaveBeenCalledOnceWith('m1');
  });

  it('still goes back when a removed photo could not be deleted', () => {
    const back = spyOn(TestBed.inject(BackService), 'back');
    spyOn(console, 'error');
    spyOn(TestBed.inject(PostService), 'updatePost').and.returnValue(of({} as PostDetail));
    spyOn(TestBed.inject(MediaService), 'deleteMedia').and.returnValue(
      throwError(() => new Error('nope')),
    );
    const fixture = TestBed.createComponent(EditPostView);
    fixture.componentInstance.currentPost.set({ id: 'p1' } as PostDetail);

    fixture.componentInstance.onFormSubmit(formData(['m1']));

    expect(back).toHaveBeenCalledWith('/posts/p1');
  });

  it('keeps the photos when the save fails', () => {
    spyOn(console, 'error');
    spyOn(TestBed.inject(PostService), 'updatePost').and.returnValue(
      throwError(() => new Error('nope')),
    );
    const deleted = spyOn(TestBed.inject(MediaService), 'deleteMedia');
    const fixture = TestBed.createComponent(EditPostView);
    fixture.componentInstance.currentPost.set({ id: 'p1' } as PostDetail);
    fixture.componentInstance.postFormComponent = {
      resetSubmitting: () => undefined,
    } as PostForm;

    fixture.componentInstance.onFormSubmit(formData(['m1']));

    expect(deleted).not.toHaveBeenCalled();
  });
});
