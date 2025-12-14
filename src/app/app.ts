import { Component, signal, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Navbar } from './core/components/navbar/navbar';
import { Footer } from './core/components/footer/footer';
import { TranslateService } from '@ngx-translate/core';
import translationEN from '../../public/i18n/en.json';
import translationPL from '../../public/i18n/pl.json';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Navbar, Footer],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private translate = inject(TranslateService);
  protected readonly title = signal('frontend');

  constructor() {
    this.translate.addLangs(['pl', 'en']);
    this.translate.setTranslation('en', translationEN);
    this.translate.setTranslation('pl', translationPL);
    this.translate.setFallbackLang('pl');
    this.translate.use('pl');
  }
}
