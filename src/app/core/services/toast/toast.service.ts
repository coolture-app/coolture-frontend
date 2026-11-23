import { inject, Injectable, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

const SHOWN_MS = 2500;

/** A short note at the bottom of the screen, such as "Saved in Plans". One at a time. */
@Injectable({
  providedIn: 'root',
})
export class ToastService {
  readonly message = signal<string | null>(null);
  private timer: ReturnType<typeof setTimeout> | undefined;
  private translate = inject(TranslateService);

  show(message: string): void {
    clearTimeout(this.timer);
    this.message.set(message);
    this.timer = setTimeout(() => this.message.set(null), SHOWN_MS);
  }

  /** Any action the server refused, once its control is put back. */
  failed(): void {
    this.show(this.translate.instant('TOAST.failed'));
  }
}
