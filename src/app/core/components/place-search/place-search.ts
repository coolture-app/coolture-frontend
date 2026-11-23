import {
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  OnInit,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroMagnifyingGlass } from '@ng-icons/heroicons/outline';

import { GeoPoint } from '../../models/common/geo.model';
import { PlaceKind, PlaceOption, PlaceResults } from '../../models/common/place-suggestion.model';
import { GeocodingService } from '../../services/geocoding/geocoding.service';

let nextId = 0;

/**
 * A search box for a place to live in or centre a radius on, with its suggestions listed under it. What's projected
 * inside shows while the box is empty, such as shortcuts to the home or the user's position.
 */
@Component({
  selector: 'app-place-search',
  imports: [TranslatePipe, NgIcon],
  viewProviders: [provideIcons({ heroMagnifyingGlass })],
  templateUrl: './place-search.html',
  styleUrl: './place-search.scss',
})
export class PlaceSearch implements OnInit {
  private geocoding = inject(GeocodingService);
  private destroyRef = inject(DestroyRef);

  readonly kind = input.required<PlaceKind>();
  /** Where suggestions should come from first. Read for each request. */
  readonly near = input.required<GeoPoint>();
  readonly label = input.required<string>();
  readonly placeholder = input('');
  readonly picked = output<PlaceOption>();

  protected readonly id = `place-search-${nextId++}`;
  protected query = signal('');
  private results = signal<PlaceResults<PlaceOption> | null>(null);
  /** Only for the text in the box, never an older one, which stays on the way to a new answer. */
  private current = computed(() => {
    const results = this.results();
    return results?.text === this.query().trim() ? results : null;
  });
  protected suggestions = computed(() => this.current()?.places ?? []);
  protected unavailable = computed(() => this.current()?.unavailable ?? false);
  protected active = signal(-1);
  private box = viewChild.required<ElementRef<HTMLInputElement>>('box');
  private texts = new Subject<string>();

  ngOnInit(): void {
    this.geocoding
      .searchPlaces(this.texts, () => this.near(), this.kind())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((results) => {
        this.results.set(results);
        this.active.set(-1);
      });
  }

  focus(): void {
    this.box().nativeElement.focus();
  }

  protected onType(text: string): void {
    this.query.set(text);
    if (!text.trim()) {
      this.results.set(null);
    }
    this.texts.next(text);
  }

  protected onKey(event: KeyboardEvent): void {
    const count = this.suggestions().length;
    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && count) {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      this.active.set((this.active() + step + count) % count);
    } else if (event.key === 'Enter' && count) {
      event.preventDefault();
      this.pick(this.suggestions()[Math.max(this.active(), 0)]);
    }
  }

  protected pick(place: PlaceOption): void {
    this.picked.emit(place);
    this.onType('');
  }
}
