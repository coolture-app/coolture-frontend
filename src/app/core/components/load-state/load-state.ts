import { Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Btn } from '../btn/btn';

/** A page's own load in its place: a spinner while it comes, or why it didn't with Spróbuj ponownie. */
@Component({
  selector: 'app-load-state',
  imports: [TranslatePipe, Btn],
  template: `
    @if (failed()) {
      <div class="load load--failed" role="alert">
        <span>{{ message() | translate }}</span>
        <app-btn variant="secondary" size="sm" (btnClick)="retry.emit()">
          {{ 'LOAD.retry' | translate }}
        </app-btn>
      </div>
    } @else {
      <div class="load" role="status" [attr.aria-label]="'LOAD.loading' | translate">
        <span class="load__spinner" aria-hidden="true"></span>
      </div>
    }
  `,
  styleUrl: './load-state.scss',
})
export class LoadState {
  readonly failed = input(false);
  /** A translation key. */
  readonly message = input('LOAD.failed');
  readonly retry = output<void>();
}
