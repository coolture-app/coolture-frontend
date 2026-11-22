import { Injectable, signal } from '@angular/core';
import { SignInReason } from '../../components/sign-in-card/sign-in-card';

/** Asks a guest to sign in after a tap that needs an account, in the app's sheet (SignInPrompt). */
@Injectable({
  providedIn: 'root',
})
export class SignInPromptService {
  readonly reason = signal<SignInReason | null>(null);

  ask(reason: SignInReason): void {
    this.reason.set(reason);
  }

  close(): void {
    this.reason.set(null);
  }
}
