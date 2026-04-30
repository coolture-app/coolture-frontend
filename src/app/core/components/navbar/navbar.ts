import { Component, inject, signal } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '../../services/auth/auth.service';
import { ApiUrlService } from '../../services/api-url.service';
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
  private apiUrl = inject(ApiUrlService);
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
    window.location.href = this.apiUrl.oauthUrl + '/oauth2/authorization/keycloak?prompt=login';
  }

  async logout(): Promise<void> {
    await firstValueFrom(this.authService.logout());
    window.location.href = '/';
  }
}
