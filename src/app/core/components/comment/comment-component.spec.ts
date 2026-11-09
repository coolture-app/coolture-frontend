import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { CommentComponent, DeletedComment, ReplyTarget } from './comment-component';
import { CommentSummary } from '../../models/comments/comment-summary.model';
import { AuthService } from '../../services/auth/auth.service';
import { CommentsService } from '../../services/comments/comments.service';
import { ToastService } from '../../services/toast/toast.service';

function comment(overrides: Partial<CommentSummary> = {}): CommentSummary {
  return {
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
    ...overrides,
  };
}

describe('CommentComponent', () => {
  let component: CommentComponent;
  let fixture: ComponentFixture<CommentComponent>;
  let service: CommentsService;
  let replied: ReplyTarget[];

  function element(): HTMLElement {
    return fixture.nativeElement;
  }

  function buttonNamed(label: string): HTMLButtonElement {
    const buttons = element().querySelectorAll('button');
    return Array.from(buttons).find((b) => b.textContent!.includes(label)) as HTMLButtonElement;
  }

  async function render(data: CommentSummary, rootActive = true): Promise<void> {
    fixture.componentRef.setInput('comment', data);
    fixture.componentRef.setInput('rootActive', rootActive);
    await fixture.whenStable();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CommentComponent],
      providers: [{ provide: AuthService, useValue: { currentUser: signal({ id: 'me' }) } }],
    });
    service = TestBed.inject(CommentsService);
    fixture = TestBed.createComponent(CommentComponent);
    component = fixture.componentInstance;
    replied = [];
    component.replyClicked.subscribe((target) => replied.push(target));
  });

  it('shows the picture, the name, the text and the time', async () => {
    await render(
      comment({
        author: {
          id: 'u1',
          username: 'ola',
          avatar: { url: 'http://x/ola.png' },
          followersCount: 0,
          followingCount: 0,
        } as CommentSummary['author'],
      }),
    );

    expect(element().querySelector('img.comment__avatar')?.getAttribute('src')).toBe(
      'http://x/ola.png',
    );
    expect(element().querySelector('.comment__username')?.textContent).toContain('ola');
    expect(element().querySelector('.comment__text')?.textContent).toContain('hello');
    expect(element().querySelector('time')?.getAttribute('datetime')).toBe('2026-11-04T10:00:00Z');
  });

  it('renders an author with no first or last name or picture', async () => {
    await render(
      comment({ author: { id: 'u2', username: 'anon', followersCount: 0, followingCount: 0 } }),
    );

    expect(element().querySelector('.comment__avatar--placeholder')).not.toBeNull();
  });

  it('has no heart or any other reaction', async () => {
    await render(comment());

    expect(element().querySelector('[class*="like"], [class*="heart"]')).toBeNull();
  });

  it('says when a comment was edited', async () => {
    await render(comment({ lastEditedAt: '2026-11-05T10:00:00Z' }));

    expect(element().textContent).toContain('COMMENT.edited');
  });

  it('shows only a note for a deleted comment, and keeps its replies reachable', async () => {
    await render(comment({ status: 'DELETED', repliesCount: 2 }));

    expect(element().querySelector('.comment__deleted')).not.toBeNull();
    expect(element().querySelector('.comment__username')).toBeNull();
    expect(buttonNamed('COMMENT.reply')).toBeUndefined();
    expect(buttonNamed('COMMENT.show-replies')).toBeDefined();
  });

  describe('replying', () => {
    it('answers a top comment directly, with no mention', async () => {
      await render(comment());

      buttonNamed('COMMENT.reply').click();

      expect(replied).toEqual([{ parentId: 'c1', username: 'ola', mention: false }]);
    });

    it('puts an answer to a reply under the top comment, with a mention', async () => {
      await render(comment({ id: 'r1', depth: 1, rootCommentId: 'c1', parentCommentId: 'c1' }));

      buttonNamed('COMMENT.reply').click();

      expect(replied).toEqual([{ parentId: 'c1', username: 'ola', mention: true }]);
    });

    it('answers the reply itself when the top comment was deleted', async () => {
      await render(comment({ id: 'r1', depth: 1, rootCommentId: 'c1' }), false);

      buttonNamed('COMMENT.reply').click();

      expect(replied[0].parentId).toBe('r1');
    });

    it('offers no reply at the API’s depth limit under a deleted top comment', async () => {
      await render(comment({ id: 'r2', depth: 2, rootCommentId: 'c1' }), false);

      expect(buttonNamed('COMMENT.reply')).toBeUndefined();
    });

    it('links a reply’s leading mention, and leaves a top comment’s text as written', async () => {
      await render(
        comment({ id: 'r1', depth: 1, rootCommentId: 'c1', content: '@ania Zgadzam się' }),
      );
      const mention = element().querySelector('.comment__mention');
      expect(mention?.textContent).toContain('@ania');
      expect(mention?.getAttribute('href')).toBe('/users/ania');
      expect(element().querySelector('.comment__text')?.textContent).toContain('Zgadzam się');

      await render(comment({ content: '@ania hej' }));
      expect(element().querySelector('.comment__mention')).toBeNull();
    });
  });

  describe('its replies', () => {
    const page = (items: CommentSummary[], nextCursor?: string) => ({
      items,
      page: { limit: 20, hasMore: !!nextCursor, nextCursor },
    });
    const reply = (id: string) =>
      comment({ id, depth: 1, rootCommentId: 'c1', parentCommentId: 'c1', content: id });
    const shownReplies = () =>
      Array.from(element().querySelectorAll('.comment__replies .comment__text')).map((p) =>
        p.textContent!.trim().replace(/^ola\s+/, ''),
      );

    it('stays closed until asked, then reads oldest to newest', async () => {
      const load = spyOn(service, 'getCommentsOfPost').and.returnValue(
        of(page([reply('newest'), reply('oldest')])),
      );
      await render(comment({ repliesCount: 2 }));
      expect(load).not.toHaveBeenCalled();

      buttonNamed('COMMENT.show-replies').click();
      await fixture.whenStable();

      expect(load).toHaveBeenCalledWith('p1', 'c1', { cursor: '', limit: 20 });
      expect(shownReplies()).toEqual(['oldest', 'newest']);
    });

    it('puts earlier replies above the ones shown', async () => {
      const load = spyOn(service, 'getCommentsOfPost').and.returnValues(
        of(page([reply('r3')], 'next')),
        of(page([reply('r2'), reply('r1')])),
      );
      await render(comment({ repliesCount: 3 }));
      buttonNamed('COMMENT.show-replies').click();
      await fixture.whenStable();

      buttonNamed('COMMENT.earlier-replies').click();
      await fixture.whenStable();

      expect(load.calls.mostRecent().args[2]).toEqual({ cursor: 'next', limit: 20 });
      expect(shownReplies()).toEqual(['r1', 'r2', 'r3']);
      expect(buttonNamed('COMMENT.earlier-replies')).toBeUndefined();
    });

    it('adds a new reply at the end and opens the thread, with what was there', async () => {
      spyOn(service, 'getCommentsOfPost').and.returnValue(of(page([reply('old')])));
      await render(comment({ repliesCount: 1 }));

      service.commentAdded$.next(reply('new'));
      await fixture.whenStable();

      expect(shownReplies()).toEqual(['old', 'new']);
      expect(component.repliesCount()).toBe(2);
    });

    it('offers a retry when replies fail to load', async () => {
      spyOn(service, 'getCommentsOfPost').and.returnValue(throwError(() => new Error('down')));
      await render(comment({ repliesCount: 1 }));

      buttonNamed('COMMENT.show-replies').click();
      await fixture.whenStable();

      expect(element().textContent).toContain('COMMENT.load-error');
      expect(buttonNamed('COMMENT.retry')).toBeDefined();
    });
  });

  describe('someone’s own comment', () => {
    const mine = () =>
      comment({
        author: { id: 'me', username: 'ja', followersCount: 0, followingCount: 0 },
      });

    it('keeps Edit and Delete behind a menu, for the author alone', async () => {
      await render(comment());
      expect(element().querySelector('.comment__menu-btn')).toBeNull();

      await render(mine());
      expect(buttonNamed('COMMENT.edit-comment')).toBeUndefined();

      (element().querySelector('.comment__menu-btn') as HTMLButtonElement).click();
      await fixture.whenStable();
      expect(buttonNamed('COMMENT.edit-comment')).toBeDefined();
      expect(buttonNamed('COMMENT.delete-comment')).toBeDefined();
    });

    it('closes the menu on the next click anywhere', async () => {
      await render(mine());
      (element().querySelector('.comment__menu-btn') as HTMLButtonElement).click();
      await new Promise((resolve) => setTimeout(resolve));

      document.body.click();
      await fixture.whenStable();

      expect(component.menuOpen()).toBeFalse();
    });

    it('saves an edit on Enter, and shows the new text', async () => {
      const edit = spyOn(service, 'editComment').and.returnValue(of(mine()));
      await render(mine());
      component.startEditing();
      await fixture.whenStable();

      component.saveEdit('  changed ');
      await fixture.whenStable();

      expect(edit).toHaveBeenCalledWith('c1', { content: 'changed' });
      expect(element().querySelector('.comment__text')?.textContent).toContain('changed');
      expect(element().textContent).toContain('COMMENT.edited');
    });

    it('sends nothing when an edit is empty or unchanged', async () => {
      const edit = spyOn(service, 'editComment');
      await render(mine());

      component.startEditing();
      component.saveEdit('   ');
      component.startEditing();
      component.saveEdit('hello');

      expect(edit).not.toHaveBeenCalled();
    });

    it('puts the old text back and says so when an edit fails', async () => {
      spyOn(service, 'editComment').and.returnValue(throwError(() => new Error('down')));
      await render(mine());
      component.startEditing();

      component.saveEdit('changed');
      await fixture.whenStable();

      expect(element().querySelector('.comment__text')?.textContent).toContain('hello');
      expect(TestBed.inject(ToastService).message()).toBe('COMMENT.edit-error');
    });

    it('cancels an edit on Escape, without saving when the box then loses focus', async () => {
      const edit = spyOn(service, 'editComment');
      await render(mine());
      component.startEditing();

      component.cancelEdit(new Event('keydown'));
      component.saveEdit('changed');

      expect(edit).not.toHaveBeenCalled();
      expect(component.isEditing()).toBeFalse();
    });

    it('deletes after the confirmation, and says so when that fails', async () => {
      const remove = spyOn(service, 'deleteComment').and.returnValues(
        throwError(() => new Error('down')),
        of(undefined),
      );
      const deleted: DeletedComment[] = [];
      component.commentDeleted.subscribe((d) => deleted.push(d));
      await render(mine());

      component.handleModalResponse('NO');
      expect(remove).not.toHaveBeenCalled();

      component.handleModalResponse('YES');
      expect(TestBed.inject(ToastService).message()).toBe('COMMENT.delete-error');
      expect(deleted).toEqual([]);

      component.handleModalResponse('YES');
      expect(deleted).toEqual([{ id: 'c1', hasReplies: false }]);
    });

    it('goes from the list once its replies are gone, by what it has now', async () => {
      spyOn(service, 'deleteComment').and.returnValue(of(undefined));
      const deleted: DeletedComment[] = [];
      component.commentDeleted.subscribe((d) => deleted.push(d));
      await render({ ...mine(), repliesCount: 1 });

      component.onReplyDeleted({ id: 'r1', hasReplies: false });
      component.handleModalResponse('YES');

      expect(deleted.at(-1)).toEqual({ id: 'c1', hasReplies: false });
    });

    it('stays as a note while replies remain, and hides with the last one', async () => {
      await render({ ...comment({ status: 'DELETED' }), repliesCount: 1 });
      const row = () => element().querySelector('.comment') as HTMLElement;
      expect(row().hidden).toBeFalse();

      component.onReplyDeleted({ id: 'r1', hasReplies: false });
      await fixture.whenStable();

      expect(row().hidden).toBeTrue();
    });
  });
});
