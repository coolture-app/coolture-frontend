import { Component, inject, signal } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-navbar',
  imports: [TranslateModule],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
})
export class Navbar {
  private translate = inject(TranslateService);
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
}
