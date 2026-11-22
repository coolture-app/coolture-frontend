import { Component, effect, ElementRef, inject, viewChild } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideX } from '@ng-icons/lucide';
import { TranslatePipe } from '@ngx-translate/core';
import { SignInCard } from '../sign-in-card/sign-in-card';
import { SignInPromptService } from '../../services/sign-in-prompt/sign-in-prompt.service';

/** Where SignInPromptService's question appears: a sheet on a phone, a card on a wide screen. */
@Component({
  selector: 'app-sign-in-prompt',
  imports: [SignInCard, NgIcon, TranslatePipe],
  viewProviders: [provideIcons({ lucideX })],
  templateUrl: './sign-in-prompt.html',
  styleUrl: './sign-in-prompt.scss',
})
export class SignInPrompt {
  readonly prompt = inject(SignInPromptService);
  private dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    effect(() => {
      const dialog = this.dialog().nativeElement;
      // A click on the backdrop lands on the dialog itself, outside its content. Escape is the dialog's cancel.
      dialog.onclick = (event) => event.target === dialog && this.prompt.close();
      if (this.prompt.reason() && !dialog.open) {
        dialog.showModal();
      } else if (!this.prompt.reason() && dialog.open) {
        dialog.close();
      }
    });
  }
}
