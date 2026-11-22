import { Component, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Btn } from '../btn/btn';
import { Dialog } from '../dialog/dialog';
import { ConfirmService } from '../../services/confirm/confirm.service';
import { mediaQuery, WIDE_FROM_PX } from '../../services/media-query/media-query';

/** Where ConfirmService's questions appear. */
@Component({
  selector: 'app-confirm-dialog',
  imports: [TranslatePipe, Btn, Dialog],
  templateUrl: './confirm-dialog.html',
  styleUrl: './confirm-dialog.scss',
})
export class ConfirmDialog {
  readonly confirm = inject(ConfirmService);
  readonly phone = mediaQuery(`(max-width: ${WIDE_FROM_PX - 1}px)`);
}
