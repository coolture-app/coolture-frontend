import { Component, computed, signal, inject, OnInit } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { Navbar } from './core/components/navbar/navbar';
import { TranslateService } from '@ngx-translate/core';
import translationEN from '../../public/i18n/en.json';
import translationPL from '../../public/i18n/pl.json';
import { AuthService } from './core/services/auth/auth.service';
import { InterestsView } from './features/interests-view/interests-view';
import { Toast } from './core/components/toast/toast';
import { PhotoViewer } from './core/components/photo-viewer/photo-viewer';
import { distinctUntilChanged, filter, first, map } from 'rxjs';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Navbar, InterestsView, Toast, PhotoViewer],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private translate = inject(TranslateService);
  private authService = inject(AuthService);
  private router = inject(Router);
  protected readonly title = signal('frontend');
  protected readonly interestsDismissed = signal(false);
  protected readonly interestsRequired = computed(
    () => this.authService.interestsSelected() === false && !this.interestsDismissed(),
  );

  constructor() {
    this.translate.addLangs(['pl', 'en']);
    this.translate.setTranslation('en', translationEN);
    this.translate.setTranslation('pl', translationPL);
    this.translate.setFallbackLang('pl');
    this.translate.use('pl');
  }
  ngOnInit(): void {
    this.authService.checkSession().pipe(first()).subscribe();

    // By path, because the home page rewrites its query string as filters change.
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        map((event) => event.urlAfterRedirects.split(/[?#]/)[0]),
        distinctUntilChanged(),
      )
      .subscribe(() => {
        this.authService.checkSession().pipe(first()).subscribe();
      });
  }
}
