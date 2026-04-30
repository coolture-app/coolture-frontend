import { Component, ElementRef, input, output, viewChild } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Btn } from '../../btn/btn';

@Component({
  selector: 'app-modal-window',
  imports: [TranslatePipe, Btn],
  templateUrl: './modal-window.html',
  styleUrl: './modal-window.scss',
})
export class ModalWindow {
  title = input<string>('Modal Title');
  text = input<string>('Modal Text');
  modalType = input<string>('OK');

  //event sent to parent
  modalAction = output<string>();

  dialog = viewChild<ElementRef<HTMLDialogElement>>('modalDialog');
  open() {
    this.dialog()?.nativeElement.showModal();
  }

  close(action: string) {
    this.dialog()?.nativeElement.close();
    this.modalAction.emit(action);
  }
}
