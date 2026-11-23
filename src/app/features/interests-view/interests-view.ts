import {
  booleanAttribute,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { firstValueFrom, forkJoin } from 'rxjs';
import { BackLink } from '../../core/components/back-link/back-link';
import { Btn } from '../../core/components/btn/btn';
import { KindGrid } from '../../core/components/kind-grid/kind-grid';
import { ConfirmService } from '../../core/services/confirm/confirm.service';
import { Interest, InterestCatalog, label } from '../../core/models/interests/interest.model';
import { AuthService } from '../../core/services/auth/auth.service';
import { InterestsService } from '../../core/services/interests/interests.service';
import { currentLang } from '../../core/utils/current-lang';

type Section = 'kinds' | 'topics';

@Component({
  selector: 'app-interests-view',
  imports: [TranslatePipe, BackLink, Btn, KindGrid],
  templateUrl: './interests-view.html',
  styleUrl: './interests-view.scss',
})
export class InterestsView implements OnInit {
  private authService = inject(AuthService);
  private interestsService = inject(InterestsService);
  private router = inject(Router);
  private element = inject<ElementRef<HTMLElement>>(ElementRef);

  /** First selection after sign-in, shown as an overlay: kinds, then topics. Saving doesn't navigate. */
  readonly onboarding = input(false, { transform: booleanAttribute });
  readonly dismissed = output<void>();
  /** The selection is saved; the home step follows. */
  readonly saved = output<void>();

  private confirm = inject(ConfirmService);
  private savedSnapshot = '';

  private currentLang = currentLang();
  protected catalog = signal<InterestCatalog | null>(null);
  protected kinds = signal<ReadonlySet<string>>(new Set());
  protected interests = signal<ReadonlySet<string>>(new Set());
  protected page = signal(0);
  protected saving = signal(false);
  protected errorKey = signal<string | null>(null);

  /** Onboarding asks for the kinds first, then the topics. The profile's page shows both at once. */
  protected pages = computed<Section[][]>(() =>
    this.onboarding() ? [['kinds'], ['topics']] : [['kinds', 'topics']],
  );
  protected sections = computed(() => this.pages()[this.page()]);
  protected isLastPage = computed(() => this.page() === this.pages().length - 1);
  protected hasKinds = computed(() => this.kinds().size >= (this.catalog()?.minKinds ?? 1));
  protected canSave = computed(() => {
    const catalog = this.catalog();
    const count = this.interests().size;
    return (
      !!catalog && this.hasKinds() && count >= catalog.minInterests && count <= catalog.maxInterests
    );
  });

  private snapshot = computed(
    () => `${[...this.kinds()].sort().join()}|${[...this.interests()].sort().join()}`,
  );

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  /** Onboarding loads what's held too: an account from before kinds sees its interests ticked as topics. */
  protected async load(): Promise<void> {
    this.errorKey.set(null);
    try {
      const { catalog, selection } = await firstValueFrom(
        forkJoin({
          catalog: this.interestsService.getCatalog(),
          selection: this.interestsService.getUserInterests(this.authService.userId()),
        }),
      );
      // The API refuses a topic that isn't offered, so a hidden one the user still holds is dropped on the next save.
      const offered = new Set(catalog.categories.flatMap((c) => c.interests.map((i) => i.key)));
      this.catalog.set(catalog);
      this.kinds.set(new Set(selection.kinds));
      this.interests.set(new Set(selection.interests.filter((key) => offered.has(key))));
      this.savedSnapshot = this.snapshot();
    } catch (error) {
      console.error('Error while fetching interests', error);
      this.errorKey.set('INTERESTS.load-error');
    }
  }

  protected label(item: Interest): string {
    return label(item, this.currentLang());
  }

  protected isSelected(key: string): boolean {
    return this.interests().has(key);
  }

  protected isAtLimit(key: string): boolean {
    return !this.isSelected(key) && this.interests().size >= (this.catalog()?.maxInterests ?? 0);
  }

  protected toggleInterest(key: string): void {
    this.errorKey.set(null);
    this.interests.update((keys) => toggled(keys, key));
  }

  /** The overlay keeps its scroll, so the next page would open where the last one was left. */
  protected goTo(page: number): void {
    this.page.set(page);
    this.element.nativeElement.scrollIntoView?.({ block: 'start' });
  }

  protected async save(): Promise<void> {
    if (!(await this.persist())) {
      return;
    }
    if (this.onboarding()) {
      this.saved.emit();
    } else {
      await this.router.navigateByUrl('/profile');
    }
  }

  private async persist(): Promise<boolean> {
    if (this.saving()) {
      return false;
    }
    if (!this.canSave()) {
      this.errorKey.set('INTERESTS.selection-error');
      return false;
    }
    this.saving.set(true);
    this.errorKey.set(null);
    try {
      const saved = await firstValueFrom(
        this.interestsService.replaceUserInterests(this.authService.userId(), {
          kinds: [...this.kinds()],
          interests: [...this.interests()],
        }),
      );
      this.savedSnapshot = this.snapshot();
      this.authService.markOnboarded(saved);
      return true;
    } catch (error) {
      console.error('Error while saving interests', error);
      this.errorKey.set('INTERESTS.save-error');
      return false;
    } finally {
      this.saving.set(false);
    }
  }

  async confirmLeave(): Promise<boolean> {
    if (this.snapshot() === this.savedSnapshot) {
      return true;
    }
    const answer = await this.confirm.choose({
      title: 'LEAVE.title',
      text: 'LEAVE.text',
      confirm: 'INTERESTS.save',
      other: 'LEAVE.discard',
    });
    return answer === 'confirm' ? this.persist() : answer === 'other';
  }
}

function toggled(keys: ReadonlySet<string>, key: string): ReadonlySet<string> {
  const next = new Set(keys);
  if (!next.delete(key)) {
    next.add(key);
  }
  return next;
}
