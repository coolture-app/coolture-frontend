import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Router } from '@angular/router';
import { of } from 'rxjs';

import { AddPostView } from './add-post-view';
import { PostService } from '../../core/services/post/post.service';
import { PostDetail } from '../../core/models/posts/post-detail.model';
import { PostCreateRequest } from '../../core/models/posts/post-create-request.model';

const REQUEST: PostCreateRequest = {
  title: 'Koncert',
  description: 'Opis',
  startsAt: '2030-05-01T17:00:00Z',
  type: 'ONLINE',
  mediaIds: [],
};

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

describe('AddPostView, after saving', () => {
  it('replaces the form with the new post in history', async () => {
    const router = TestBed.inject(Router);
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    const fixture = TestBed.createComponent(AddPostView);
    fixture.detectChanges();
    spyOn(TestBed.inject(PostService), 'addPost').and.returnValue(of({ id: 'p9' } as PostDetail));

    await fixture.componentInstance.onFormSubmit({ request: REQUEST, removedMediaIds: [] });

    expect(navigate).toHaveBeenCalledWith(['/posts', 'p9'], { replaceUrl: true });
  });
});
