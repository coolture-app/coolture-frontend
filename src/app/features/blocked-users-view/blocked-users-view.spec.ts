import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { BlockedUsersView } from './blocked-users-view';
import { AuthService } from '../../core/services/auth/auth.service';
import { UserProfile } from '../../core/models/users/user-profile.model';

describe('BlockedUsersView', () => {
  let fixture: ComponentFixture<BlockedUsersView>;
  let http: HttpTestingController;
  let element: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [BlockedUsersView] }).compileComponents();
    TestBed.inject(AuthService).currentUser.set({ id: 'me-1', username: 'anna' } as UserProfile);
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(BlockedUsersView);
    element = fixture.nativeElement;
    fixture.detectChanges();
  });

  async function flush(body: object | null, status = 200) {
    http
      .expectOne((r) => r.url.endsWith('/users/me-1/blocking'))
      .flush(body, { status, statusText: status === 200 ? 'OK' : 'Error' });
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('lists the blocked people and unblocks one', async () => {
    await flush({
      items: [
        { id: 'jan-1', username: 'jan', firstName: 'Jan', lastName: 'Kowalski' },
        { id: 'ola-1', username: 'ola', firstName: 'Ola', lastName: 'Wiśniewska' },
      ],
      page: { limit: 100, hasMore: false },
    });
    expect(element.querySelectorAll('.blocked__user').length).toBe(2);

    spyOn(window, 'confirm').and.returnValue(true);
    element.querySelector<HTMLButtonElement>('.blocked__user button')!.click();
    const unblock = http.expectOne((r) => r.method === 'DELETE');
    expect(unblock.request.url).toMatch(/\/users\/jan-1\/block$/);
    unblock.flush(null);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(element.querySelectorAll('.blocked__user').length).toBe(1);
    expect(element.textContent).toContain('@ola');
  });

  it('says so when nobody is blocked', async () => {
    await flush({ items: [], page: { limit: 100, hasMore: false } });

    expect(element.querySelector('.blocked__empty')?.textContent).toContain('PROFILE.no-blocked');
  });

  it('offers a retry when the list can’t be read', async () => {
    await flush(null, 500);

    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'PROFILE.blockedLoadError',
    );
  });
});
