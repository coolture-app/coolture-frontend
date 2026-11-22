import { inject, Injectable, signal } from '@angular/core';
import { SignInReason } from '../../models/common/sign-in-reason';
import { AuthService } from '../auth/auth.service';

/** Asks a guest to sign in after a tap that needs an account, in the app's sheet (SignInPrompt). */
@Injectable({
  providedIn: 'root',
})
export class SignInPromptService {
  readonly reason = signal<SignInReason | null>(null);

  private auth = inject(AuthService);

  /** Whether the tap may go on: yes when signed in, else the sheet says what it would have done. */
  allows(reason: SignInReason): boolean {
    if (this.auth.isAuthenticated()) {
      return true;
    }
    this.reason.set(reason);
    return false;
  }

  close(): void {
    this.reason.set(null);
  }
}
