import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCalendarDays,
  lucideHouse,
  lucideLogOut,
  lucideUserRound,
  lucideUsers,
} from '@ng-icons/lucide';

import { AuthService } from '../../services/auth/auth.service';
import { Btn } from '../btn/btn';

@Component({
  selector: 'app-navbar',
  imports: [TranslateModule, Btn, RouterLink, RouterLinkActive, NgIcon],
  viewProviders: [
    provideIcons({ lucideCalendarDays, lucideHouse, lucideLogOut, lucideUserRound, lucideUsers }),
  ],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
})
export class Navbar {
  private translate = inject(TranslateService);
  authService = inject(AuthService);
  currentLang = signal(this.translate.currentLang);

  readonly links = [
    { path: '/', icon: 'lucideHouse', labelKey: 'NAVBAR.main-page' },
    { path: '/discover', icon: 'lucideUsers', labelKey: 'NAVBAR.friends' },
    { path: '/myEvents', icon: 'lucideCalendarDays', labelKey: 'NAVBAR.my-events' },
    { path: '/profile', icon: 'lucideUserRound', labelKey: 'NAVBAR.my-profile' },
  ];

  constructor() {
    this.translate.onLangChange.subscribe((event) => {
      this.currentLang.set(event.lang);
    });
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
