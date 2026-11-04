import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  heroArrowRightOnRectangle,
  heroCalendarDays,
  heroHome,
  heroUser,
  heroUsers,
} from '@ng-icons/heroicons/outline';

import { AuthService } from '../../services/auth/auth.service';
import { Btn } from '../btn/btn';

@Component({
  selector: 'app-navbar',
  imports: [TranslateModule, Btn, RouterLink, RouterLinkActive, NgIcon],
  viewProviders: [
    provideIcons({ heroArrowRightOnRectangle, heroCalendarDays, heroHome, heroUser, heroUsers }),
  ],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
})
export class Navbar {
  private translate = inject(TranslateService);
  authService = inject(AuthService);
  currentLang = signal(this.translate.currentLang);

  readonly links = [
    { path: '/', icon: 'heroHome', labelKey: 'NAVBAR.main-page' },
    { path: '/discover', icon: 'heroUsers', labelKey: 'NAVBAR.friends' },
    { path: '/myEvents', icon: 'heroCalendarDays', labelKey: 'NAVBAR.my-events' },
    { path: '/profile', icon: 'heroUser', labelKey: 'NAVBAR.my-profile' },
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
