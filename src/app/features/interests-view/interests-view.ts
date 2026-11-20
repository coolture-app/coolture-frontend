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
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CanDeactivateFn, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom, forkJoin, map } from 'rxjs';
import { BackLink } from '../../core/components/back-link/back-link';
import { Btn } from '../../core/components/btn/btn';
import { KindGrid } from '../../core/components/kind-grid/kind-grid';
import { ModalWindow } from '../../core/components/modal/modal-window/modal-window';
import { Interest, InterestCatalog } from '../../core/models/interests/interest.model';
import { AuthService } from '../../core/services/auth/auth.service';
import { InterestsService } from '../../core/services/interests/interests.service';

export const unsavedInterestsGuard: CanDeactivateFn<InterestsView> = (component) =>
  component.confirmLeave();

/** Onboarding asks for the kinds first, then the topics. The profile's page shows both at once. */
type Step = 'kinds' | 'topics';

@Component({
  selector: 'app-interests-view',
  imports: [TranslatePipe, BackLink, Btn, KindGrid, ModalWindow],
  templateUrl: './interests-view.html',
  styleUrl: './interests-view.scss',
})
export class InterestsView implements OnInit {
  private authService = inject(AuthService);
  private interestsService = inject(InterestsService);
  private router = inject(Router);
  private translate = inject(TranslateService);
  private element = inject<ElementRef<HTMLElement>>(ElementRef);

  /** First selection after sign-in, shown as an overlay in two steps, with no navigation after saving. */
  readonly onboarding = input(false, { transform: booleanAttribute });
  readonly dismissed = output<void>();
  /** Onboarding goes on to its next step. */
  readonly saved = output<void>();

  private leaveModal = viewChild.required(ModalWindow);
  private resolveLeave: ((leave: boolean) => void) | null = null;
  private savedSnapshot = '';

  private currentLang = toSignal(this.translate.onLangChange.pipe(map((event) => event.lang)), {
    initialValue: this.translate.getCurrentLang(),
  });
  protected catalog = signal<InterestCatalog | null>(null);
  protected kinds = signal<ReadonlySet<string>>(new Set());
  protected interests = signal<ReadonlySet<string>>(new Set());
  protected step = signal<Step>('kinds');
  protected saving = signal(false);
  protected errorKey = signal<string | null>(null);

  protected showKinds = computed(() => !this.onboarding() || this.step() === 'kinds');
  protected showTopics = computed(() => !this.onboarding() || this.step() === 'topics');
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
      this.catalog.set(catalog);
      this.kinds.set(new Set(selection.kinds));
      this.interests.set(new Set(selection.interests));
      this.savedSnapshot = this.snapshot();
    } catch (error) {
      console.error('Error while fetching interests', error);
      this.errorKey.set('INTERESTS.load-error');
    }
  }

  protected label(item: Interest): string {
    return this.currentLang() === 'en' ? item.labelEn : item.labelPl;
  }

  protected isSelected(key: string): boolean {
    return this.interests().has(key);
  }

  /** A topic held from before but no longer offered isn't shown, yet counts toward the limit, as saving keeps it. */
  protected isAtLimit(key: string): boolean {
    return !this.isSelected(key) && this.interests().size >= (this.catalog()?.maxInterests ?? 0);
  }

  protected toggleKind(key: string): void {
    this.errorKey.set(null);
    this.kinds.update((keys) => toggled(keys, key));
  }

  protected toggleInterest(key: string): void {
    this.errorKey.set(null);
    this.interests.update((keys) => toggled(keys, key));
  }

  /** The overlay keeps its scroll, so the next step would open where the last one was left. */
  protected goTo(step: Step): void {
    this.step.set(step);
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
      this.authService.markInterestsSelected(saved);
      return true;
    } catch (error) {
      console.error('Error while saving interests', error);
      this.errorKey.set('INTERESTS.save-error');
      return false;
    } finally {
      this.saving.set(false);
    }
  }

  confirmLeave(): boolean | Promise<boolean> {
    if (this.snapshot() === this.savedSnapshot) {
      return true;
    }
    this.leaveModal().open();
    return new Promise((resolve) => (this.resolveLeave = resolve));
  }

  protected async onLeaveAnswer(action: string): Promise<void> {
    this.resolveLeave?.(action === 'YES' ? await this.persist() : action === 'NO');
  }
}

function toggled(keys: ReadonlySet<string>, key: string): ReadonlySet<string> {
  const next = new Set(keys);
  if (!next.delete(key)) {
    next.add(key);
  }
  return next;
}
