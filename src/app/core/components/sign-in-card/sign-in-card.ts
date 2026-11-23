import { Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideBookmark,
  lucideCalendarDays,
  lucideEyeOff,
  lucideHeart,
  lucideMessageCircle,
  lucidePencil,
  lucidePlus,
  lucideSettings,
  lucideThumbsUp,
  lucideUserRound,
  lucideUsers,
} from '@ng-icons/lucide';
import { TranslatePipe } from '@ngx-translate/core';
import { Btn } from '../btn/btn';
import { AuthService } from '../../services/auth/auth.service';
import { appTicket } from '../../icons/ticket';
import { SignInReason } from '../../models/common/sign-in-reason';

const ICONS: Record<SignInReason, string> = {
  addPost: 'lucidePlus',
  editPost: 'lucidePencil',
  plans: 'lucideCalendarDays',
  profile: 'lucideUserRound',
  user: 'lucideUserRound',
  people: 'lucideUsers',
  settings: 'lucideSettings',
  interests: 'lucideHeart',
  like: 'lucideThumbsUp',
  interested: 'lucideBookmark',
  takesPart: 'appTicket',
  notForMe: 'lucideEyeOff',
  comment: 'lucideMessageCircle',
};

/** Says why to sign in, with Zaloguj się and Załóż konto, both coming back to this page. */
@Component({
  selector: 'app-sign-in-card',
  imports: [NgIcon, TranslatePipe, Btn],
  viewProviders: [
    provideIcons({
      appTicket,
      lucideBookmark,
      lucideCalendarDays,
      lucideEyeOff,
      lucideHeart,
      lucideMessageCircle,
      lucidePencil,
      lucidePlus,
      lucideSettings,
      lucideThumbsUp,
      lucideUserRound,
      lucideUsers,
    }),
  ],
  templateUrl: './sign-in-card.html',
  styleUrl: './sign-in-card.scss',
})
export class SignInCard {
  readonly reason = input.required<SignInReason>();
  /** The id of the title, for a dialog's aria-labelledby. */
  readonly titleId = input('sign-in-title');

  private auth = inject(AuthService);
  private router = inject(Router);

  readonly icon = computed(() => ICONS[this.reason()]);

  signIn(): void {
    void this.auth.login(this.router.url);
  }

  signUp(): void {
    void this.auth.signUp(this.router.url);
  }
}
