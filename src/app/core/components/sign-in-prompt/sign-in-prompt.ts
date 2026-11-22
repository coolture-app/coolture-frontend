import { Component, inject } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideX } from '@ng-icons/lucide';
import { TranslatePipe } from '@ngx-translate/core';
import { Dialog } from '../dialog/dialog';
import { SignInCard } from '../sign-in-card/sign-in-card';
import { SignInPromptService } from '../../services/sign-in-prompt/sign-in-prompt.service';

/** Where SignInPromptService's question appears: a sheet on a phone, a card on a wide screen. */
@Component({
  selector: 'app-sign-in-prompt',
  imports: [Dialog, SignInCard, NgIcon, TranslatePipe],
  viewProviders: [provideIcons({ lucideX })],
  templateUrl: './sign-in-prompt.html',
  styleUrl: './sign-in-prompt.scss',
})
export class SignInPrompt {
  readonly prompt = inject(SignInPromptService);
}
