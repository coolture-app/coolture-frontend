import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { FollowListComponent } from './follow-list';
import { AuthService } from '../../services/auth/auth.service';
import { RelationsService } from '../../services/relations/relations.service';
import { UserListItem } from '../../models/users/user-summary.model';

function person(id: string, firstName?: string, followsYou = false): UserListItem {
  return {
    id,
    username: `${id}_demo`,
    firstName,
    lastName: firstName ? 'Nowak' : undefined,
    followersCount: 3,
    followingCount: 4,
    followsYou,
  };
}

function page(items: UserListItem[], hasMore = false) {
  return of({ items, page: { limit: 20, hasMore, nextCursor: hasMore ? 'next' : undefined } });
}

describe('FollowListComponent', () => {
  let fixture: ComponentFixture<FollowListComponent>;
  let relations: jasmine.SpyObj<RelationsService>;

  function element(): HTMLElement {
    return fixture.nativeElement;
  }

  beforeEach(() => {
    relations = jasmine.createSpyObj<RelationsService>('RelationsService', [
      'getFollowers',
      'getFollowing',
      'follow',
      'unfollow',
    ]);
    // The viewer's own follows, asked once for the buttons.
    relations.getFollowing.and.returnValue(page([person('anna', 'Anna')]));
    relations.getFollowers.and.returnValue(
      page([person('anna', 'Anna', true), person('bartek', undefined, true)]),
    );
    relations.follow.and.returnValue(of(undefined));
    relations.unfollow.and.returnValue(of(undefined));
    TestBed.configureTestingModule({
      imports: [FollowListComponent],
      providers: [
        provideRouter([]),
        { provide: RelationsService, useValue: relations },
        { provide: AuthService, useValue: { currentUser: signal({ id: 'me' }) } },
      ],
    });
  });

  function create(): void {
    fixture = TestBed.createComponent(FollowListComponent);
    fixture.componentRef.setInput('userId', 'me');
    fixture.componentRef.setInput('type', 'followers');
    fixture.componentRef.setInput('isOwnProfile', true);
    fixture.detectChanges();
  }

  it('shows each person by name, or username with no first name, and how you relate', async () => {
    create();
    await fixture.whenStable();
    fixture.detectChanges();
    const rows = element().querySelectorAll('.follow-list__row');

    expect(rows.length).toBe(2);
    expect(rows[0].querySelector('.follow-list__name')?.textContent).toContain('Anna Nowak');
    expect(rows[0].textContent).toContain('PROFILE.friends');
    expect(rows[1].querySelector('.follow-list__name')?.textContent).toContain('bartek_demo');
    expect(rows[1].textContent).toContain('PROFILE.followsYou');
    expect(element().textContent).not.toContain('@');
    expect(rows[0].querySelector('a')?.getAttribute('href')).toBe('/users/anna_demo');
  });

  it('searches the whole list on the server, after a pause in typing', () => {
    jasmine.clock().install();
    try {
      create();
      fixture.componentInstance.pages.search(' nowak ');
      jasmine.clock().tick(299);
      expect(relations.getFollowers).toHaveBeenCalledTimes(1);

      relations.getFollowers.and.returnValue(page([]));
      jasmine.clock().tick(1);
      fixture.detectChanges();

      expect(relations.getFollowers.calls.mostRecent().args).toEqual([
        'me',
        { limit: 20, cursor: '' },
        'nowak',
      ]);
      expect(element().querySelector('.follow-list__empty')?.textContent).toContain(
        'FOLLOW_LIST.noMatch',
      );
    } finally {
      jasmine.clock().uninstall();
    }
  });

  it('asks for the next page with the cursor it was given', () => {
    relations.getFollowers.and.returnValue(page([person('anna', 'Anna')], true));
    create();

    relations.getFollowers.and.returnValue(page([person('ola', 'Ola')]));
    fixture.componentInstance.pages.loadMore();
    fixture.detectChanges();

    expect(relations.getFollowers.calls.mostRecent().args[1]).toEqual({
      limit: 20,
      cursor: 'next',
    });
    expect(element().querySelectorAll('.follow-list__row').length).toBe(2);
  });

  it('counts your own follows on your own profile', async () => {
    create();
    const changed = jasmine.createSpy('followChanged');
    fixture.componentInstance.followChanged.subscribe(changed);
    const bartek = fixture.componentInstance.pages.items()[1];

    await fixture.componentInstance.toggleFollow(bartek);

    expect(relations.follow).toHaveBeenCalledWith('bartek');
    expect(changed).toHaveBeenCalledWith(1);
    expect(fixture.componentInstance.followingIds().has('bartek')).toBeTrue();
  });

  it('offers Spróbuj ponownie when the list doesn’t load', () => {
    relations.getFollowers.and.returnValue(throwError(() => new Error('down')));
    create();

    expect(element().querySelector('app-load-state')).not.toBeNull();
    expect(element().querySelectorAll('.follow-list__row').length).toBe(0);
  });
});
