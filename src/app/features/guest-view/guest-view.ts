import { isPlatformBrowser } from '@angular/common';
import { Component, inject, PLATFORM_ID } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { LoadState } from '../../core/components/load-state/load-state';
import { SignInCard, SignInReason } from '../../core/components/sign-in-card/sign-in-card';

/**
 * A page that needs an account, for a guest, at the page's own URL (the routes' `signedIn`). The server can't tell who is
 * signed in, since the session is in the browser's storage, so it renders a spinner: a sign-in screen there would show to
 * signed-in people on every reload.
 */
@Component({
  selector: 'app-guest-view',
  imports: [SignInCard, LoadState],
  template: `
    <div class="page">
      @if (browser) {
        <app-sign-in-card class="guest" [reason]="reason" />
      } @else {
        <app-load-state />
      }
    </div>
  `,
  styles: `
    .page {
      padding: var(--space-md);
    }

    .guest {
      display: block;
      max-width: var(--feed-column);
      margin: var(--space-2xl) auto 0;
    }
  `,
})
export class GuestView {
  readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  readonly reason = inject(ActivatedRoute).snapshot.data['signIn'] as SignInReason;
}
