import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroBars3, heroBell } from '@ng-icons/heroicons/outline';

@Component({
  selector: 'app-navbar',
  imports: [NgIcon],
  viewProviders: [provideIcons({ heroBars3, heroBell })],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
})
export class Navbar {
  private translate = inject(TranslateService);
  currentLang = toSignal(this.translate.onLangChange.pipe(map((event) => event.lang)), {
    initialValue: this.translate.getCurrentLang(),
  });

  changeLanguage(): void {
    const newLang = this.currentLang() === 'pl' ? 'en' : 'pl';
    this.translate.use(newLang);
  }
}
