import { Component, DOCUMENT, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCalendarDays,
  lucideHouse,
  lucideLogOut,
  lucidePlus,
  lucideUserRound,
  lucideUsers,
} from '@ng-icons/lucide';

import { AuthService } from '../../services/auth/auth.service';
import { HomeTapService } from '../../services/home-tap/home-tap.service';
import { Btn } from '../btn/btn';
import { Tooltip } from '../../directives/tooltip';

@Component({
  selector: 'app-navbar',
  imports: [TranslateModule, Btn, RouterLink, RouterLinkActive, NgIcon, Tooltip],
  viewProviders: [
    provideIcons({
      lucideCalendarDays,
      lucideHouse,
      lucideLogOut,
      lucidePlus,
      lucideUserRound,
      lucideUsers,
    }),
  ],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
})
export class Navbar {
  private translate = inject(TranslateService);
  private router = inject(Router);
  private document = inject(DOCUMENT);
  private homeTap = inject(HomeTapService);
  authService = inject(AuthService);
  currentLang = signal(this.translate.currentLang);

  readonly links = [
    { path: '/', icon: 'lucideHouse', labelKey: 'NAVBAR.main-page' },
    { path: '/discover', icon: 'lucideUsers', labelKey: 'NAVBAR.friends' },
    { path: '/addPost', icon: 'lucidePlus', labelKey: 'NAVBAR.addPost' },
    { path: '/myEvents', icon: 'lucideCalendarDays', labelKey: 'NAVBAR.my-events' },
    { path: '/profile', icon: 'lucideUserRound', labelKey: 'NAVBAR.my-profile' },
  ];

  constructor() {
    this.translate.onLangChange.subscribe((event) => {
      this.currentLang.set(event.lang);
    });
  }

  /**
   * On the home page, Home goes to the top, and from the top it starts a fresh feed. Elsewhere it's
   * an ordinary link.
   */
  homeTapped(event: MouseEvent): void {
    if (this.router.url.split(/[?#]/)[0] !== '/') {
      return;
    }
    event.preventDefault();
    const view = this.document.defaultView;
    if (view && view.scrollY > 0) {
      view.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      this.homeTap.freshFeed.next();
    }
  }

  changeLanguage(): void {
    const newLang = this.currentLang() === 'pl' ? 'en' : 'pl';
    this.translate.use(newLang);
  }

  login(): void {
    void this.authService.login();
  }

  async logout(): Promise<void> {
    this.authService.logout();
  }
}
