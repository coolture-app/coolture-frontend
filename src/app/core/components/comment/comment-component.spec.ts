import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CommentComponent } from './comment-component';
import { CommentSummary } from '../../models/comments/comment-summary.model';

describe('CommentComponent', () => {
  let component: CommentComponent;
  let fixture: ComponentFixture<CommentComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommentComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CommentComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('comment', {
      id: 'c1',
      postId: 'p1',
      rootCommentId: null,
      parentCommentId: null,
      author: {
        id: 'u1',
        username: 'ola',
        firstName: 'Ola',
        lastName: 'Nowak',
        followersCount: 0,
        followingCount: 0,
      },
      content: 'hello',
      depth: 0,
      repliesCount: 0,
      createdAt: '2026-11-04T10:00:00Z',
      lastEditedAt: null,
      deletedAt: null,
      status: 'ACTIVE',
    } as CommentSummary);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
