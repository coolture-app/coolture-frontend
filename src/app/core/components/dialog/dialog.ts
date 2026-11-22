import { Component, effect, ElementRef, input, output, viewChild } from '@angular/core';

/** The app's modal: a sheet from the bottom on a phone, a card in the middle on a wide screen. */
@Component({
  selector: 'app-dialog',
  templateUrl: './dialog.html',
  styleUrl: './dialog.scss',
})
export class Dialog {
  readonly open = input.required<boolean>();
  /** The id of the projected title, for aria-labelledby. */
  readonly titleId = input.required<string>();
  /** Escape or a tap on the backdrop. The host closes it by turning `open` off. */
  readonly dismissed = output<void>();

  private dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    effect(() => {
      const dialog = this.dialog().nativeElement;
      if (this.open() && !dialog.open) {
        dialog.showModal();
      } else if (!this.open() && dialog.open) {
        dialog.close();
      }
    });
  }
}
