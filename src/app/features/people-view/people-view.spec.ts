import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { PeopleView } from './people-view';
import { AuthService } from '../../core/services/auth/auth.service';
import { RelationsService } from '../../core/services/relations/relations.service';
import { ToastService } from '../../core/services/toast/toast.service';
import { Users } from '../../core/services/users/users.service';
import { UserListItem } from '../../core/models/users/user-summary.model';

function person(id: string, isFollowing: boolean): UserListItem {
  return {
    id,
    username: `${id}_demo`,
    firstName: id,
    lastName: 'Nowak',
    followersCount: 3,
    followingCount: 4,
    isFollowing,
    followsYou: false,
  };
}

describe('PeopleView', () => {
  let fixture: ComponentFixture<PeopleView>;
  let users: jasmine.SpyObj<Users>;
  let relations: jasmine.SpyObj<RelationsService>;
  let toast: jasmine.SpyObj<ToastService>;

  const buttons = () =>
    Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('app-follow-btn'));
  const following = (button: HTMLElement) => button.textContent?.includes('PROFILE.followingThem');

  function create(items: UserListItem[]): void {
    users.searchForUsers.and.returnValue(of({ items, page: { limit: 20, hasMore: false } }));
    fixture = TestBed.createComponent(PeopleView);
    fixture.detectChanges();
    jasmine.clock().tick(400);
    fixture.detectChanges();
  }

  beforeEach(() => {
    // debounceTime reads the date, so the clock has to move it too.
    jasmine.clock().install();
    jasmine.clock().mockDate();
    users = jasmine.createSpyObj<Users>('Users', ['searchForUsers']);
    relations = jasmine.createSpyObj<RelationsService>('RelationsService', [
      'getFollowing',
      'follow',
      'unfollow',
    ]);
    relations.follow.and.returnValue(of(undefined));
    relations.unfollow.and.returnValue(of(undefined));
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['failed']);
    TestBed.configureTestingModule({
      imports: [PeopleView],
      providers: [
        provideRouter([]),
        { provide: Users, useValue: users },
        { provide: RelationsService, useValue: relations },
        { provide: ToastService, useValue: toast },
        { provide: AuthService, useValue: { currentUser: signal({ id: 'me' }) } },
      ],
    });
  });

  afterEach(() => jasmine.clock().uninstall());

  it('takes each button from the person, however many people you follow, and asks for no list of them', () => {
    create([person('anna', true), person('bartek', false), person('me', false)]);

    expect(buttons().map(following)).toEqual([true, false]);
    expect(relations.getFollowing).not.toHaveBeenCalled();
  });

  it('follows and unfollows in place', async () => {
    create([person('anna', false)]);

    await fixture.componentInstance.toggleFollow(fixture.componentInstance.users().items[0]);
    fixture.detectChanges();
    expect(relations.follow).toHaveBeenCalledWith('anna');
    expect(following(buttons()[0])).toBeTrue();

    await fixture.componentInstance.toggleFollow(fixture.componentInstance.users().items[0]);
    fixture.detectChanges();
    expect(relations.unfollow).toHaveBeenCalledWith('anna');
    expect(following(buttons()[0])).toBeFalse();
  });

  it('leaves the button as it was when the follow fails', async () => {
    spyOn(console, 'error');
    relations.follow.and.returnValue(throwError(() => new Error('down')));
    create([person('anna', false)]);

    await fixture.componentInstance.toggleFollow(fixture.componentInstance.users().items[0]);
    fixture.detectChanges();

    expect(toast.failed).toHaveBeenCalled();
    expect(following(buttons()[0])).toBeFalse();
  });
});
