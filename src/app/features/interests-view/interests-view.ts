import {
  booleanAttribute,
  Component,
  computed,
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
import { firstValueFrom, forkJoin, map, of } from 'rxjs';
import { Btn } from '../../core/components/btn/btn';
import { ModalWindow } from '../../core/components/modal/modal-window/modal-window';
import {
  Interest,
  InterestCatalog,
  InterestCategory,
} from '../../core/models/interests/interest.model';
import { AuthService } from '../../core/services/auth/auth.service';
import { InterestsService } from '../../core/services/interests/interests.service';

export const unsavedInterestsGuard: CanDeactivateFn<InterestsView> = (component) =>
  component.confirmLeave();

@Component({
  selector: 'app-interests-view',
  imports: [TranslatePipe, Btn, ModalWindow],
  templateUrl: './interests-view.html',
  styleUrl: './interests-view.scss',
})
export class InterestsView implements OnInit {
  private authService = inject(AuthService);
  private interestsService = inject(InterestsService);
  private router = inject(Router);
  private translate = inject(TranslateService);

  /** First selection after sign-up, shown as an overlay: nothing saved yet, may be skipped, no navigation after saving. */
  readonly onboarding = input(false, { transform: booleanAttribute });
  readonly dismissed = output<void>();

  private leaveModal = viewChild.required(ModalWindow);
  private resolveLeave: ((leave: boolean) => void) | null = null;
  private savedInterests = '';

  private currentLang = toSignal(this.translate.onLangChange.pipe(map((event) => event.lang)), {
    initialValue: this.translate.getCurrentLang(),
  });
  protected catalog = signal<InterestCatalog | null>(null);
  protected selected = signal<ReadonlySet<string>>(new Set());
  protected expandedCategory = signal<string | null>(null);
  protected saving = signal(false);
  protected errorKey = signal<string | null>(null);

  protected canSave = computed(() => {
    const catalog = this.catalog();
    const count = this.selected().size;
    return !!catalog && count >= catalog.minSelections && count <= catalog.maxSelections;
  });

  private interestsSnapshot = computed(() => [...this.selected()].sort().join());

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  protected async load(): Promise<void> {
    this.errorKey.set(null);
    try {
      const { catalog, selection } = await firstValueFrom(
        forkJoin({
          catalog: this.interestsService.getCatalog(),
          selection: this.onboarding()
            ? of({ interests: [] })
            : this.interestsService.getUserInterests(this.authService.userId()),
        }),
      );
      this.catalog.set(catalog);
      this.selected.set(new Set(selection.interests));
      this.savedInterests = this.interestsSnapshot();
    } catch (error) {
      console.error('Error while fetching interests', error);
      this.errorKey.set('INTERESTS.load-error');
    }
  }

  protected label(item: Interest): string {
    return this.currentLang() === 'en' ? item.labelEn : item.labelPl;
  }

  protected isSelected(key: string): boolean {
    return this.selected().has(key);
  }

  protected categoryLabel(category: InterestCategory): string {
    const count = category.interests.filter((interest) => this.isSelected(interest.key)).length;
    return count ? `${this.label(category)} (${count})` : this.label(category);
  }

  protected isAtLimit(key: string): boolean {
    return !this.isSelected(key) && this.selected().size >= (this.catalog()?.maxSelections ?? 0);
  }

  protected toggleCategory(key: string): void {
    this.expandedCategory.update((expanded) => (expanded === key ? null : key));
  }

  protected toggleInterest(key: string): void {
    this.errorKey.set(null);
    this.selected.update((keys) => {
      const next = new Set(keys);
      if (!next.delete(key)) {
        next.add(key);
      }
      return next;
    });
  }

  protected async save(): Promise<void> {
    if ((await this.persist()) && !this.onboarding()) {
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
      await firstValueFrom(
        this.interestsService.replaceUserInterests(this.authService.userId(), [...this.selected()]),
      );
      this.savedInterests = this.interestsSnapshot();
      this.authService.markInterestsSelected();
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
    if (this.interestsSnapshot() === this.savedInterests) {
      return true;
    }
    this.leaveModal().open();
    return new Promise((resolve) => (this.resolveLeave = resolve));
  }

  protected async onLeaveAnswer(action: string): Promise<void> {
    this.resolveLeave?.(action === 'YES' ? await this.persist() : action === 'NO');
  }
}
