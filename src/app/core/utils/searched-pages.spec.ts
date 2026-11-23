import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';

import { PaginatedResponse } from '../models/common/paginated-response.model';
import { PageRequest, searchedPages } from './searched-pages';

const page = (items: string[], nextCursor?: string): PaginatedResponse<string> => ({
  items,
  page: { limit: 20, hasMore: !!nextCursor, nextCursor },
});

describe('searchedPages', () => {
  const list = signal('upcoming');
  const scope = signal('anna');
  let sent: { request: PageRequest; answer: Subject<PaginatedResponse<string>> }[];

  function start(searchScope?: () => unknown) {
    list.set('upcoming');
    scope.set('anna');
    sent = [];
    const pages = TestBed.runInInjectionContext(() =>
      searchedPages<string>({
        list,
        searchScope,
        fetch: (request) => {
          const answer = new Subject<PaginatedResponse<string>>();
          sent.push({ request, answer });
          return answer;
        },
      }),
    );
    TestBed.tick();
    return pages;
  }

  it('reads page after page with the cursor, and only while there is more', () => {
    const pages = start();
    expect(sent[0].request).toEqual({ q: undefined, cursor: undefined, limit: 20 });

    pages.loadMore();
    expect(sent.length).toBe(1);

    sent[0].answer.next(page(['a'], 'next'));
    pages.loadMore();
    pages.loadMore();
    expect(sent.length).toBe(2);
    expect(sent[1].request.cursor).toBe('next');

    sent[1].answer.next(page(['b']));
    pages.loadMore();
    expect(pages.items()).toEqual(['a', 'b']);
    expect(sent.length).toBe(2);
  });

  it('never shows the answer to a list that changed since', () => {
    const pages = start();

    list.set('past');
    TestBed.tick();
    sent[0].answer.next(page(['old']));
    sent[1].answer.next(page(['new']));

    expect(pages.items()).toEqual(['new']);
    expect(sent[1].request.cursor).toBeUndefined();
  });

  describe('typing', () => {
    beforeEach(() => jasmine.clock().install());
    afterEach(() => jasmine.clock().uninstall());

    it('asks once the typing pauses for 300 ms, with the words trimmed', () => {
      const pages = start();
      sent[0].answer.next(page(['a']));

      pages.search('ja');
      jasmine.clock().tick(200);
      pages.search(' jazz ');
      jasmine.clock().tick(299);
      TestBed.tick();

      expect(pages.typed()).toBe(' jazz ');
      expect(sent.length).toBe(1);

      jasmine.clock().tick(1);
      TestBed.tick();

      expect(sent.length).toBe(2);
      expect(sent[1].request.q).toBe('jazz');
      expect(pages.items()).toEqual([]);
    });

    it('never shows the answer to words that changed since', () => {
      const pages = start();

      pages.search('ja');
      jasmine.clock().tick(300);
      TestBed.tick();
      pages.search('jazz');
      jasmine.clock().tick(300);
      TestBed.tick();
      sent[1].answer.next(page(['ja-only']));
      sent[2].answer.next(page(['jazz-only']));

      expect(pages.items()).toEqual(['jazz-only']);
    });

    it('clears the words, and their pause, when the list changes', () => {
      const pages = start();
      pages.search('jazz');

      list.set('past');
      jasmine.clock().tick(300);
      TestBed.tick();

      expect(pages.typed()).toBe('');
      expect(sent.map((s) => s.request.q)).toEqual([undefined, undefined]);
    });

    it('keeps the words across lists, and drops them with the scope, when a scope is given', () => {
      const pages = start(scope);
      pages.search('jazz');
      jasmine.clock().tick(300);
      TestBed.tick();

      list.set('past');
      TestBed.tick();
      expect(pages.typed()).toBe('jazz');
      expect(sent.at(-1)!.request.q).toBe('jazz');

      scope.set('jan');
      TestBed.tick();
      expect(pages.typed()).toBe('');
      expect(sent.at(-1)!.request.q).toBeUndefined();
    });
  });

  describe('failing', () => {
    beforeEach(() => spyOn(console, 'error'));

    it('shows the failure, and a retry of the first page starts afresh', () => {
      const pages = start();

      sent[0].answer.error(new Error('down'));
      expect(pages.failed()).toBeTrue();
      expect(pages.loading()).toBeFalse();

      pages.retry();
      expect(pages.failed()).toBeFalse();
      expect(sent[1].request.cursor).toBeUndefined();
      sent[1].answer.next(page(['a']));
      expect(pages.items()).toEqual(['a']);
    });

    it('retries a later page from the same cursor, keeping what is shown', () => {
      const pages = start();
      sent[0].answer.next(page(['a'], 'next'));
      pages.loadMore();
      sent[1].answer.error(new Error('down'));

      pages.retry();

      expect(pages.items()).toEqual(['a']);
      expect(sent[2].request.cursor).toBe('next');
    });
  });
});
