import { Injectable, signal } from '@angular/core';

/** Translation keys, with params for the title and text. */
export interface ConfirmRequest {
  title: string;
  text?: string;
  /** Names the action, such as "Zablokuj": a bare "Tak" doesn't say what happens. */
  confirm: string;
  /** A second way to go on, such as "Nie zapisuj" beside "Zapisz". */
  other?: string;
  params?: Record<string, unknown>;
  /** Removes or blocks something, so the button is red. */
  danger?: boolean;
}

/** Anuluj, Escape and the backdrop all answer `cancel`. */
export type ConfirmAnswer = 'confirm' | 'other' | 'cancel';

/** Asks before an action, in the app's dialog (ConfirmDialog). One question at a time; a new one cancels the last. */
@Injectable({
  providedIn: 'root',
})
export class ConfirmService {
  readonly request = signal<ConfirmRequest | null>(null);
  private resolve: ((answer: ConfirmAnswer) => void) | null = null;

  async ask(request: ConfirmRequest): Promise<boolean> {
    return (await this.choose(request)) === 'confirm';
  }

  choose(request: ConfirmRequest): Promise<ConfirmAnswer> {
    this.resolve?.('cancel');
    this.request.set(request);
    return new Promise((resolve) => (this.resolve = resolve));
  }

  answer(answer: ConfirmAnswer): void {
    const resolve = this.resolve;
    this.resolve = null;
    this.request.set(null);
    resolve?.(answer);
  }
}
