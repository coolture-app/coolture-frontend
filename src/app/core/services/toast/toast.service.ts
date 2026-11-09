import { Injectable, signal } from '@angular/core';

const SHOWN_MS = 2500;

/** A short note at the bottom of the screen, such as "Saved in Plans". One at a time. */
@Injectable({
  providedIn: 'root',
})
export class ToastService {
  readonly message = signal<string | null>(null);
  private timer: ReturnType<typeof setTimeout> | undefined;

  show(message: string): void {
    clearTimeout(this.timer);
    this.message.set(message);
    this.timer = setTimeout(() => this.message.set(null), SHOWN_MS);
  }
}
