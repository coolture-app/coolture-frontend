import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { SettingsView } from './settings-view';
import { AuthService } from '../../core/services/auth/auth.service';
import { UserProfile } from '../../core/models/users/user-profile.model';

describe('SettingsView', () => {
  let fixture: ComponentFixture<SettingsView>;
  let http: HttpTestingController;
  let auth: AuthService;
  let element: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SettingsView] }).compileComponents();
    auth = TestBed.inject(AuthService);
    auth.currentUser.set({ id: 'me-1', username: 'anna' } as UserProfile);
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(SettingsView);
    element = fixture.nativeElement;
    fixture.detectChanges();
  });

  const toggle = () => {
    element.querySelector<HTMLInputElement>('app-switch input')!.click();
    fixture.detectChanges();
  };

  it('links to the blocked people and the hidden posts', () => {
    const links = [...element.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(links).toEqual(['/profile/blocked', '/profile/hidden']);
  });

  it('saves the sharing switch', () => {
    expect(auth.shareStances()).toBeTrue();
    toggle();

    const save = http.expectOne((r) => r.method === 'PATCH');
    expect(save.request.url).toMatch(/\/users\/me-1$/);
    expect(save.request.body).toEqual({ shareStances: false });
    expect(auth.shareStances()).toBeFalse();
  });

  it('switches back when the save fails', async () => {
    toggle();
    http
      .expectOne((r) => r.method === 'PATCH')
      .flush(null, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();

    expect(auth.shareStances()).toBeTrue();
  });
});
