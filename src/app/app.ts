import { Component, signal, inject, OnInit } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { Navbar } from './core/components/navbar/navbar';
import { Footer } from './core/components/footer/footer';
import { TranslateService } from '@ngx-translate/core';
import translationEN from '../../public/i18n/en.json';
import translationPL from '../../public/i18n/pl.json';
import { AuthService } from './core/services/auth/auth.service';
import { filter, first } from 'rxjs';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Navbar, Footer],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private translate = inject(TranslateService);
  private authService = inject(AuthService);
  private router = inject(Router);
  protected readonly title = signal('frontend');

  constructor() {
    this.translate.addLangs(['pl', 'en']);
    this.translate.setTranslation('en', translationEN);
    this.translate.setTranslation('pl', translationPL);
    this.translate.setFallbackLang('pl');
    this.translate.use('pl');
  }
  ngOnInit(): void {
    this.authService.checkSession().pipe(first()).subscribe();

    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
      this.authService.checkSession().pipe(first()).subscribe();
    });
  }
}
