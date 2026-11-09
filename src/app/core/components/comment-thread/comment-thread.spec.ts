import { signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';

import { CommentThread } from './comment-thread';
import { CommentSummary } from '../../models/comments/comment-summary.model';
import { PaginatedResponse } from '../../models/common/paginated-response.model';
import { AuthService } from '../../services/auth/auth.service';
import { CommentsService } from '../../services/comments/comments.service';
import { ToastService } from '../../services/toast/toast.service';

function comment(id: string, overrides: Partial<CommentSummary> = {}): CommentSummary {
  return {
    id,
    postId: 'p1',
    rootCommentId: null,
    parentCommentId: null,
    author: { id: 'u1', username: 'ola', followersCount: 0, followingCount: 0 },
    content: id,
    depth: 0,
    repliesCount: 0,
    createdAt: '2026-11-04T10:00:00Z',
    lastEditedAt: null,
    deletedAt: null,
    status: 'ACTIVE',
    ...overrides,
  };
}

function page(ids: string[], nextCursor?: string): PaginatedResponse<CommentSummary> {
  return {
    items: ids.map((id) => comment(id)),
    page: { limit: 20, hasMore: !!nextCursor, nextCursor },
  };
}

describe('CommentThread', () => {
  let fixture: ComponentFixture<CommentThread>;
  let component: CommentThread;
  let service: CommentsService;
  let load: jasmine.Spy;
  let currentUser: WritableSignal<{ id: string; username: string } | null>;
  let login: jasmine.Spy;
  let counts: number[];

  function element(): HTMLElement {
    return fixture.nativeElement;
  }

  function shown(): string[] {
    const rows = element().querySelectorAll('.comment__text');
    return Array.from(rows).map((p) => p.textContent!.trim().replace(/^ola\s+/, ''));
  }

  function sendButton(): HTMLButtonElement {
    return element().querySelector('.composer__send') as HTMLButtonElement;
  }

  async function open(firstPage = page(['b', 'a'])): Promise<void> {
    load.and.returnValue(of(firstPage));
    fixture = TestBed.createComponent(CommentThread);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('postId', 'p1');
    counts = [];
    component.countChange.subscribe((by) => counts.push(by));
    await fixture.whenStable();
  }

  async function type(text: string): Promise<void> {
    component.content.set(text);
    await fixture.whenStable();
  }

  beforeEach(() => {
    currentUser = signal({ id: 'me', username: 'ja' });
    login = jasmine.createSpy('login');
    TestBed.configureTestingModule({
      imports: [CommentThread],
      providers: [{ provide: AuthService, useValue: { currentUser, login } }],
    });
    service = TestBed.inject(CommentsService);
    load = spyOn(service, 'getCommentsOfPost');
  });

  it('lists a post’s comments newest first, as they come', async () => {
    await open();

    expect(load).toHaveBeenCalledWith('p1', undefined, { cursor: '', limit: 20 });
    expect(shown()).toEqual(['b', 'a']);
  });

  it('leaves out deleted comments with no replies, and keeps those with replies', async () => {
    await open({
      items: [
        comment('gone', { status: 'DELETED' }),
        comment('kept', { status: 'DELETED', repliesCount: 1 }),
      ],
      page: { limit: 20, hasMore: false },
    });

    expect(component.comments().map((c) => c.id)).toEqual(['kept']);
  });

  it('says when there are no comments yet', async () => {
    await open(page([]));

    expect(element().textContent).toContain('COMMENT.empty');
  });

  it('goes past the first 20 comments (finding F2), without repeating any', async () => {
    await open(page(['c', 'b'], 'next'));

    load.and.returnValue(of(page(['b', 'a'])));
    component.load();
    await fixture.whenStable();

    expect(load.calls.mostRecent().args[2]).toEqual({ cursor: 'next', limit: 20 });
    expect(shown()).toEqual(['c', 'b', 'a']);
    expect(component.hasMore()).toBeFalse();
  });

  it('offers a retry when the comments fail to load', async () => {
    load.and.returnValue(throwError(() => new Error('down')));
    fixture = TestBed.createComponent(CommentThread);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('postId', 'p1');
    await fixture.whenStable();

    expect(element().textContent).toContain('COMMENT.load-error');

    load.and.returnValue(of(page(['a'])));
    (element().querySelector('.thread__retry') as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(shown()).toEqual(['a']);
  });

  describe('writing a comment', () => {
    it('can’t send an empty or blank comment (finding C2)', async () => {
      await open();
      const create = spyOn(service, 'createComment');

      expect(sendButton().disabled).toBeTrue();

      await type('   ');
      expect(sendButton().disabled).toBeTrue();
      component.send();

      expect(create).not.toHaveBeenCalled();
    });

    it('puts a new comment at the top and clears the box (finding C1)', async () => {
      await open();
      const create = spyOn(service, 'createComment').and.returnValue(of(comment('new')));

      await type('  new ');
      sendButton().click();
      await fixture.whenStable();

      expect(create).toHaveBeenCalledWith('p1', { content: 'new', parentCommentId: null });
      expect(shown()).toEqual(['new', 'b', 'a']);
      expect(component.content()).toBe('');
      expect(counts).toEqual([1]);
    });

    it('sends on Ctrl+Enter, and Enter alone doesn’t', async () => {
      await open();
      const create = spyOn(service, 'createComment').and.returnValue(of(comment('new')));
      await type('new');
      const box = element().querySelector('textarea')!;

      box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      expect(create).not.toHaveBeenCalled();

      box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true }));
      expect(create).toHaveBeenCalledTimes(1);
    });

    it('won’t send twice while a comment is on its way', async () => {
      await open();
      const answer = new Subject<CommentSummary>();
      const create = spyOn(service, 'createComment').and.returnValue(answer);
      await type('new');

      component.send();
      component.send();
      await fixture.whenStable();

      expect(create).toHaveBeenCalledTimes(1);
      expect(element().querySelector('textarea')!.readOnly).toBeTrue();
      answer.next(comment('new'));
    });

    it('keeps the text and says so when sending fails (finding C2)', async () => {
      await open();
      spyOn(service, 'createComment').and.returnValue(throwError(() => new Error('400')));
      await type('my words');

      component.send();
      await fixture.whenStable();

      expect(component.content()).toBe('my words');
      expect(sendButton().disabled).toBeFalse();
      expect(TestBed.inject(ToastService).message()).toBe('COMMENT.send-error');
      expect(counts).toEqual([]);
    });

    it('limits the box to the API’s 512 characters, and counts down near it', async () => {
      await open();
      const box = element().querySelector('textarea')!;
      expect(box.maxLength).toBe(512);
      expect(element().querySelector('.composer__counter')).toBeNull();

      await type('x'.repeat(400));

      expect(component.remaining()).toBe(112);
      expect(element().querySelector('.composer__counter')).not.toBeNull();
    });
  });

  describe('replying', () => {
    it('sends a reply to its top comment, and hands it to that comment', async () => {
      await open();
      const reply = comment('r', { parentCommentId: 'a', depth: 1, rootCommentId: 'a' });
      const create = spyOn(service, 'createComment').and.returnValue(of(reply));
      const added: CommentSummary[] = [];
      service.commentAdded$.subscribe((c) => added.push(c));

      component.setReplyTo({ parentId: 'a', username: 'ola', mention: false });
      await type('Też tam będę');
      sendButton().click();
      await fixture.whenStable();

      expect(create).toHaveBeenCalledWith('p1', { content: 'Też tam będę', parentCommentId: 'a' });
      expect(added).toEqual([reply]);
      expect(component.comments().map((c) => c.id)).toEqual(['b', 'a']);
      expect(shown()).toEqual(['b', 'a', 'r']);
      expect(component.replyTo()).toBeNull();
      expect(counts).toEqual([1]);
    });

    it('starts an answer to a reply with @name, which alone can’t be sent', async () => {
      await open();
      const create = spyOn(service, 'createComment');

      component.setReplyTo({ parentId: 'a', username: 'ania', mention: true });
      await fixture.whenStable();

      expect(component.content()).toBe('@ania ');
      expect(sendButton().disabled).toBeTrue();
      component.send();
      expect(create).not.toHaveBeenCalled();
    });

    it('swaps the mention when the reply moves to someone else, and keeps the words', async () => {
      await open();
      component.setReplyTo({ parentId: 'a', username: 'ania', mention: true });
      await type('@ania hej');

      component.setReplyTo({ parentId: 'a', username: 'marek', mention: true });

      expect(component.content()).toBe('@marek hej');
    });

    it('takes the mention away again on cancelling', async () => {
      await open();
      component.setReplyTo({ parentId: 'a', username: 'ania', mention: true });
      await type('@ania hej');

      component.cancelReply();

      expect(component.content()).toBe('hej');
      expect(component.replyTo()).toBeNull();
    });

    it('asks a guest to sign in instead', async () => {
      await open();
      currentUser.set(null);

      component.setReplyTo({ parentId: 'a', username: 'ola', mention: false });

      expect(login).toHaveBeenCalled();
      expect(component.replyTo()).toBeNull();
    });
  });

  it('lets a guest read, and offers signing in instead of the box', async () => {
    currentUser.set(null);
    await open();

    expect(shown()).toEqual(['b', 'a']);
    expect(element().querySelector('textarea')).toBeNull();

    (element().querySelector('.composer__sign-in') as HTMLButtonElement).click();

    expect(login).toHaveBeenCalled();
  });

  it('reports a deleted comment, keeping it in place if it has replies', async () => {
    await open({
      items: [comment('a', { repliesCount: 1 }), comment('b')],
      page: { limit: 20, hasMore: false },
    });

    component.onDeleted({ id: 'a', hasReplies: true });
    component.onDeleted({ id: 'b', hasReplies: false });
    await fixture.whenStable();

    expect(component.comments().map((c) => [c.id, c.status])).toEqual([['a', 'DELETED']]);
    expect(counts).toEqual([-1, -1]);
  });
});
