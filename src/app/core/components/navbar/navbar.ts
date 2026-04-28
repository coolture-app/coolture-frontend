import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { map } from 'rxjs';

@Component({
  selector: 'app-navbar',
  imports: [TranslateModule],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
})
export class Navbar {
  private translate = inject(TranslateService);
  private router = inject(Router);
  currentLang = toSignal(this.translate.onLangChange.pipe(map((event) => event.lang)), {
    initialValue: this.translate.currentLang,
  });

  changeLanguage(): void {
    const newLang = this.currentLang() === 'pl' ? 'en' : 'pl';
    this.translate.use(newLang);
  }

  goToAddPost(): void {
    this.router.navigate(['/addPost']);
  }
}
