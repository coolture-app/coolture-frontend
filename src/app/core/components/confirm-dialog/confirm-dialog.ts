import { Component, effect, ElementRef, inject, viewChild } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Btn } from '../btn/btn';
import { ConfirmService } from '../../services/confirm/confirm.service';
import { mediaQuery, WIDE_FROM_PX } from '../../services/media-query/media-query';

/** Where ConfirmService's questions appear. */
@Component({
  selector: 'app-confirm-dialog',
  imports: [TranslatePipe, Btn],
  templateUrl: './confirm-dialog.html',
  styleUrl: './confirm-dialog.scss',
})
export class ConfirmDialog {
  readonly confirm = inject(ConfirmService);
  readonly phone = mediaQuery(`(max-width: ${WIDE_FROM_PX - 1}px)`);
  private dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    effect(() => {
      const dialog = this.dialog().nativeElement;
      // A click on the backdrop lands on the dialog itself, outside its content. Escape is the dialog's cancel.
      dialog.onclick = (event) => event.target === dialog && this.confirm.answer('cancel');
      if (this.confirm.request() && !dialog.open) {
        dialog.showModal();
      } else if (!this.confirm.request() && dialog.open) {
        dialog.close();
      }
    });
  }
}
