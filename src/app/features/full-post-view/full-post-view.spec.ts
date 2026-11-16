import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FullPostView } from './full-post-view';
import { BackService } from '../../core/services/back/back.service';
import { PostService } from '../../core/services/post/post.service';
import { PostDetail } from '../../core/models/posts/post-detail.model';

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

  it('links back to the home page when the tab came straight here', () => {
    expect(fixture.nativeElement.querySelector('app-back-link a')?.getAttribute('href')).toBe('/');
  });

  it('gives the back link its title, for the pages opened from it', () => {
    TestBed.inject(PostService).setActivePost({
      id: 'p1',
      title: 'Koncert',
      author: { id: 'u1', username: 'anna' },
    } as PostDetail);
    TestBed.tick();

    expect(TestBed.inject(BackService).label('/posts/p1')).toEqual({ text: 'Koncert' });
  });
});
