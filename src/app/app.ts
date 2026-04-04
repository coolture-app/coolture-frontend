import { Component, signal, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Navbar } from './core/components/navbar/navbar';
import { Footer } from './core/components/footer/footer';
import { TranslateService } from '@ngx-translate/core';
import translationEN from '../../public/i18n/en.json';
import translationPL from '../../public/i18n/pl.json';
import { AuthService } from './core/services/auth/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Navbar, Footer],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private translate = inject(TranslateService);
  private authService = inject(AuthService);
  protected readonly title = signal('frontend');

  constructor() {
    this.translate.addLangs(['pl', 'en']);
    this.translate.setTranslation('en', translationEN);
    this.translate.setTranslation('pl', translationPL);
    this.translate.setFallbackLang('pl');
    this.translate.use('pl');
  }
  ngOnInit(): void {
    this.authService.checkSession().subscribe();
  }
}
