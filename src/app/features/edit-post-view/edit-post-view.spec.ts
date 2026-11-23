import { ComponentFixture, TestBed } from '@angular/core/testing';

import { of, Subject, throwError } from 'rxjs';

import { EditPostView } from './edit-post-view';
import { PostForm, PostFormSubmit } from '../../core/components/post-form/post-form';
import { MediaService } from '../../core/services/media/media.service';
import { PostService } from '../../core/services/post/post.service';
import { BackService } from '../../core/services/back/back.service';
import { PostDetail } from '../../core/models/posts/post-detail.model';
import { PostCreateRequest } from '../../core/models/posts/post-create-request.model';

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

const REQUEST: PostCreateRequest = {
  title: 'Koncert',
  description: 'Opis',
  startsAt: '2030-05-01T17:00:00Z',
  type: 'ONLINE',
  mediaIds: [],
};

function formData(removedMediaIds: string[] = []): PostFormSubmit {
  return { request: REQUEST, removedMediaIds };
}

describe('EditPostView, after saving', () => {
  it('goes back to where the edit was opened, so the form leaves history', async () => {
    const back = spyOn(TestBed.inject(BackService), 'back');
    spyOn(TestBed.inject(PostService), 'updatePost').and.returnValue(of({} as PostDetail));
    const fixture = TestBed.createComponent(EditPostView);
    fixture.componentInstance.currentPost.set({ id: 'p1' } as PostDetail);

    await fixture.componentInstance.onFormSubmit(formData());

    expect(back).toHaveBeenCalledWith('/posts/p1');
  });

  it('deletes the removed photos only once the post no longer holds them', async () => {
    const saving = new Subject<PostDetail>();
    spyOn(TestBed.inject(BackService), 'back');
    spyOn(TestBed.inject(PostService), 'updatePost').and.returnValue(saving);
    const deleted = spyOn(TestBed.inject(MediaService), 'deleteMedia').and.returnValue(
      of(undefined),
    );
    const fixture = TestBed.createComponent(EditPostView);
    fixture.componentInstance.currentPost.set({ id: 'p1' } as PostDetail);

    const saved = fixture.componentInstance.onFormSubmit(formData(['m1']));
    expect(deleted).not.toHaveBeenCalled();

    saving.next({} as PostDetail);
    saving.complete();
    await saved;
    expect(deleted).toHaveBeenCalledOnceWith('m1');
  });

  it('still goes back when a removed photo could not be deleted', async () => {
    const back = spyOn(TestBed.inject(BackService), 'back');
    spyOn(console, 'error');
    spyOn(TestBed.inject(PostService), 'updatePost').and.returnValue(of({} as PostDetail));
    spyOn(TestBed.inject(MediaService), 'deleteMedia').and.returnValue(
      throwError(() => new Error('nope')),
    );
    const fixture = TestBed.createComponent(EditPostView);
    fixture.componentInstance.currentPost.set({ id: 'p1' } as PostDetail);

    await fixture.componentInstance.onFormSubmit(formData(['m1']));

    expect(back).toHaveBeenCalledWith('/posts/p1');
  });

  it('keeps the photos when the save fails', async () => {
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

    await fixture.componentInstance.onFormSubmit(formData(['m1']));

    expect(deleted).not.toHaveBeenCalled();
  });
});
