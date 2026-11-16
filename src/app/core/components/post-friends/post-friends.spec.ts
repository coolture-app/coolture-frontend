import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController, TestRequest } from '@angular/common/http/testing';

import { PostFriendsList } from './post-friends';
import { PostFriends } from '../../models/posts/friend-stances.model';

describe('PostFriendsList', () => {
  let fixture: ComponentFixture<PostFriendsList>;
  let http: HttpTestingController;

  function element(): HTMLElement {
    return fixture.nativeElement;
  }

  function request(): TestRequest {
    return http.expectOne((r) => r.url.endsWith('/posts/p1/friends'));
  }

  async function answer(friends: PostFriends): Promise<void> {
    request().flush(friends);
    await fixture.whenStable();
  }

  beforeEach(async () => {
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PostFriendsList);
    fixture.componentRef.setInput('postId', 'p1');
    await fixture.whenStable();
  });

  afterEach(() => http.verify());

  it('says it’s loading until the list comes', () => {
    expect(element().querySelector('[role="status"]')?.textContent).toContain('FRIENDS.loading');
    request().flush({ going: [], interested: [] });
  });

  it('lists who goes, then who’s interested, each counted, by full name with a link and no handle', async () => {
    await answer({
      going: [
        {
          id: 'a',
          username: 'anna_demo',
          firstName: 'Anna',
          lastName: 'Nowak',
          avatarUrl: '/a.jpg',
        },
        { id: 'c', username: 'coolture' },
      ],
      interested: [{ id: 'o', username: 'ola', firstName: 'Ola' }],
    });

    const headings = Array.from(element().querySelectorAll('.friends__heading')).map((h) =>
      h.textContent!.replace(/\s+/g, ' ').trim(),
    );
    expect(headings).toEqual(['FRIENDS.going · 2', 'FRIENDS.interested · 1']);
    const rows = Array.from(element().querySelectorAll<HTMLAnchorElement>('.friends__row'));
    expect(rows.map((row) => row.querySelector('.friends__name')!.textContent)).toEqual([
      'Anna Nowak',
      'coolture',
      'Ola',
    ]);
    expect(rows[1].querySelector('.friends__avatar--initial')?.textContent).toBe('C');
    expect(rows.map((row) => row.getAttribute('href'))).toEqual([
      '/users/anna_demo',
      '/users/coolture',
      '/users/ola',
    ]);
    expect(rows[0].querySelector('img')?.getAttribute('src')).toBe('/a.jpg');
    expect(element().textContent).not.toContain('@');
  });

  it('leaves out a stance nobody took', async () => {
    await answer({ going: [], interested: [{ id: 'o', username: 'ola' }] });

    expect(element().querySelectorAll('.friends__section').length).toBe(1);
  });

  it('says so when there’s nobody, as for a guest', async () => {
    await answer({ going: [], interested: [] });

    expect(element().textContent).toContain('FRIENDS.empty');
  });

  it('offers a retry when the list fails, and the retry works', async () => {
    request().flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();
    expect(element().querySelector('[role="alert"]')?.textContent).toContain('FRIENDS.load-error');

    (element().querySelector('.friends__retry') as HTMLButtonElement).click();
    await answer({ going: [{ id: 'c', username: 'coolture' }], interested: [] });

    expect(element().querySelectorAll('.friends__row').length).toBe(1);
  });
});
