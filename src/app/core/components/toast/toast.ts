import { Component, inject } from '@angular/core';
import { ToastService } from '../../services/toast/toast.service';

/** Where ToastService's notes appear. The live region is always there, so screen readers hear them. */
@Component({
  selector: 'app-toast',
  template: `
    <div class="toast-region" role="status" aria-live="polite">
      @if (toast.message(); as message) {
        <div class="toast">{{ message }}</div>
      }
    </div>
  `,
  styleUrl: './toast.scss',
})
export class Toast {
  readonly toast = inject(ToastService);
}
