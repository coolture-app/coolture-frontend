import { Component, inject, signal } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AuthService } from '../../services/auth/auth.service';
import { Btn } from '../btn/btn';

@Component({
  selector: 'app-navbar',
  imports: [TranslateModule, Btn],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
})
export class Navbar {
  private translate = inject(TranslateService);
  authService = inject(AuthService);
  currentLang = signal(this.translate.currentLang);

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
