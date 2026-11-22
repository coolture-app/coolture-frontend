import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { FollowListComponent } from './follow-list';
import { AuthService } from '../../services/auth/auth.service';
import { RelationsService } from '../../services/relations/relations.service';
import { UserListItem } from '../../models/users/user-summary.model';

function person(
  id: string,
  firstName?: string,
  followsYou = false,
  isFollowing = false,
): UserListItem {
  return {
    id,
    username: `${id}_demo`,
    firstName,
    lastName: firstName ? 'Nowak' : undefined,
    followersCount: 3,
    followingCount: 4,
    isFollowing,
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
    relations.getFollowers.and.returnValue(
      page([person('anna', 'Anna', true, true), person('bartek', undefined, true)]),
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
    expect(relations.getFollowing).not.toHaveBeenCalled();
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
    fixture.detectChanges();

    expect(relations.follow).toHaveBeenCalledWith('bartek');
    expect(changed).toHaveBeenCalledWith(1);
    expect(fixture.componentInstance.pages.items()[1].isFollowing).toBeTrue();
    expect(element().querySelectorAll('app-follow-btn')[1].textContent).toContain(
      'PROFILE.followingThem',
    );
  });

  it('keeps a row after an unfollow, so a mistaken tap can be undone', async () => {
    create();
    const changed = jasmine.createSpy('followChanged');
    fixture.componentInstance.followChanged.subscribe(changed);

    await fixture.componentInstance.toggleFollow(fixture.componentInstance.pages.items()[0]);
    fixture.detectChanges();

    expect(relations.unfollow).toHaveBeenCalledWith('anna');
    expect(changed).toHaveBeenCalledWith(-1);
    expect(element().querySelectorAll('.follow-list__row').length).toBe(2);
    expect(element().querySelectorAll('app-follow-btn')[0].textContent).toContain('PROFILE.follow');
    expect(element().querySelectorAll('app-follow-btn')[0].textContent).not.toContain(
      'PROFILE.followingThem',
    );
  });

  it('shows who you follow from each person, however many people you follow', () => {
    const followed = Array.from({ length: 130 }, (_, i) => person(`p${i}`, `P${i}`, false, true));
    relations.getFollowers.and.returnValue(page([...followed, person('last', 'Last')]));
    create();

    const buttons = Array.from(element().querySelectorAll('app-follow-btn'));
    expect(buttons.length).toBe(131);
    expect(buttons.filter((b) => b.textContent?.includes('PROFILE.followingThem')).length).toBe(
      130,
    );
    expect(relations.getFollowing).not.toHaveBeenCalled();
  });

  it('offers Spróbuj ponownie when the list doesn’t load', () => {
    relations.getFollowers.and.returnValue(throwError(() => new Error('down')));
    create();

    expect(element().querySelector('app-load-state')).not.toBeNull();
    expect(element().querySelectorAll('.follow-list__row').length).toBe(0);
  });
});
