import { Component, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Btn } from '../../../core/components/btn/btn';
import { AuthService } from '../../../core/services/auth/auth.service';
import { Users } from '../../../core/services/users/users.service';
import { ToastService } from '../../../core/services/toast/toast.service';
import { UserProfileUpdateRequest } from '../../../core/models/users/user-profile-update-request.model';

/** The API's rule (users-api.yaml), checked here so the field can say why before a save. */
const USERNAME = /^[a-z0-9._]{3,32}$/;

/** Username and first and last name, in Ustawienia's Konto. */
@Component({
  selector: 'app-account-form',
  imports: [TranslatePipe, Btn],
  templateUrl: './account-form.html',
  styleUrl: './account-form.scss',
})
export class AccountForm {
  private auth = inject(AuthService);
  private users = inject(Users);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);

  readonly username = signal(this.auth.currentUser()?.username ?? '');
  readonly firstName = signal(this.auth.currentUser()?.firstName ?? '');
  readonly lastName = signal(this.auth.currentUser()?.lastName ?? '');
  readonly taken = signal(false);
  readonly saving = signal(false);

  private readonly changes = computed<UserProfileUpdateRequest>(() => {
    const user = this.auth.currentUser();
    const changes: UserProfileUpdateRequest = {};
    if (this.username() !== user?.username) changes.username = this.username();
    if (this.firstName().trim() !== (user?.firstName ?? ''))
      changes.firstName = this.firstName().trim();
    if (this.lastName().trim() !== (user?.lastName ?? ''))
      changes.lastName = this.lastName().trim();
    return changes;
  });
  /** A username from sign-up can break the rule, such as "Jan.Kowalski"; it holds nothing back until it's changed. */
  readonly usernameValid = computed(
    () => !('username' in this.changes()) || USERNAME.test(this.username()),
  );
  readonly canSave = computed(
    () => !this.saving() && this.usernameValid() && Object.keys(this.changes()).length > 0,
  );

  /** Lowercase as typed, since the rule allows nothing else. */
  typeUsername(value: string): void {
    this.username.set(value.trim().toLowerCase());
    this.taken.set(false);
  }

  async save(): Promise<void> {
    const userId = this.auth.userId();
    if (!userId || !this.canSave()) return;
    this.saving.set(true);
    try {
      const saved = await firstValueFrom(this.users.updateProfile(userId, this.changes()));
      const user = this.auth.currentUser();
      if (user) {
        const { username, firstName, lastName } = saved;
        this.auth.markProfile({ ...user, username, firstName, lastName });
      }
      this.toast.show(this.translate.instant('SETTINGS.saved'));
    } catch (err) {
      if (err instanceof HttpErrorResponse && err.status === 409) {
        this.taken.set(true);
      } else {
        console.error('Error saving the account', err);
        this.toast.failed();
      }
    } finally {
      this.saving.set(false);
    }
  }
}
