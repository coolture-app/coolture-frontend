import { Component, computed, signal, inject, OnInit } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { NgComponentOutlet } from '@angular/common';
import { Navbar } from './core/components/navbar/navbar';
import { TranslateService } from '@ngx-translate/core';
import translationEN from '../../public/i18n/en.json';
import translationPL from '../../public/i18n/pl.json';
import { AuthService } from './core/services/auth/auth.service';
import { InterestsView } from './features/interests-view/interests-view';
import { HomeArea } from './features/home-area/home-area';
import { Toast } from './core/components/toast/toast';
import { PhotoViewer } from './core/components/photo-viewer/photo-viewer';
import { CommentsSheet } from './core/components/comments-sheet/comments-sheet';
import { ConfirmDialog } from './core/components/confirm-dialog/confirm-dialog';
import { SignInPrompt } from './core/components/sign-in-prompt/sign-in-prompt';
import { distinctUntilChanged, filter, first, map } from 'rxjs';
import { devTools } from '../environments/dev-tools';
import { pathOf } from './core/services/back/back.service';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    NgComponentOutlet,
    Navbar,
    InterestsView,
    HomeArea,
    Toast,
    PhotoViewer,
    CommentsSheet,
    ConfirmDialog,
    SignInPrompt,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private translate = inject(TranslateService);
  private authService = inject(AuthService);
  private router = inject(Router);
  protected readonly title = signal('frontend');
  protected readonly devSwitcher = devTools?.component ?? null;
  protected readonly interestsDismissed = signal(false);
  protected readonly interestsRequired = computed(
    () => this.authService.onboarded() === false && !this.interestsDismissed(),
  );
  /** Onboarding's optional second step, right after the interests are saved. Skipping it ends onboarding. */
  protected readonly homeStep = signal(false);
  protected readonly onboarding = computed(() => this.interestsRequired() || this.homeStep());

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
        map((event) => pathOf(event.urlAfterRedirects)),
        distinctUntilChanged(),
      )
      .subscribe(() => {
        this.authService.checkSession().pipe(first()).subscribe();
      });
  }
}
