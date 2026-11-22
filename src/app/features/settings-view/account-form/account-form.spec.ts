import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { AccountForm } from './account-form';
import { AuthService } from '../../../core/services/auth/auth.service';
import { UserProfile } from '../../../core/models/users/user-profile.model';
import { ToastService } from '../../../core/services/toast/toast.service';

describe('AccountForm', () => {
  let fixture: ComponentFixture<AccountForm>;
  let http: HttpTestingController;
  const form = () => fixture.componentInstance;

  beforeEach(() => {
    TestBed.inject(AuthService).currentUser.set({
      id: 'u1',
      username: 'anna',
      firstName: '',
      isFollowing: false,
      isBlocked: false,
      followsYou: false,
    } as UserProfile);
    fixture = TestBed.createComponent(AccountForm);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  it('lowercases the username and holds back a save outside the rule', () => {
    form().typeUsername(' Anna.K ');
    expect(form().username()).toBe('anna.k');
    expect(form().canSave()).toBeTrue();

    form().typeUsername('an');
    expect(form().canSave()).toBeFalse();
    form().typeUsername('anna kowalska');
    expect(form().canSave()).toBeFalse();
  });

  it('sends only what changed, and shows the new name everywhere', async () => {
    form().firstName.set(' Anna ');
    const saving = form().save();
    const request = http.expectOne((r) => r.method === 'PATCH');
    expect(request.request.body).toEqual({ firstName: 'Anna' });
    request.flush({ id: 'u1', username: 'anna', firstName: 'Anna' });
    await saving;

    expect(TestBed.inject(AuthService).currentUser()?.firstName).toBe('Anna');
    expect(TestBed.inject(ToastService).message()).toBe('SETTINGS.saved');
    expect(form().canSave()).toBeFalse();
  });

  it('says a taken username is taken', async () => {
    form().typeUsername('jan');
    const saving = form().save();
    http
      .expectOne((r) => r.method === 'PATCH')
      .flush({ error: 'Username is taken' }, { status: 409, statusText: 'Conflict' });
    await saving;
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.account__hint--error')?.textContent).toContain(
      'SETTINGS.usernameTaken',
    );
  });
});
