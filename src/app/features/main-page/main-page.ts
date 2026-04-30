import { Component, inject, signal, OnInit, DestroyRef } from '@angular/core';
import { FormControl, ReactiveFormsModule, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, startWith, combineLatest } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroMagnifyingGlass, heroPlus, heroFunnel, heroXMark } from '@ng-icons/heroicons/outline';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { PostComponent } from '../../core/components/post-component/post-component';
import { Btn } from '../../core/components/btn/btn';
import { HttpClient } from '@angular/common/http';
import { PostCard } from '../../core/models/posts/post-card.model';
import { PostFilterParams } from '../../core/models/posts/post-filter-params.model';
import { PostService } from '../../core/services/post/post.service';
import { PaginatedResponse } from '../../core/models/common/paginated-response.model';
import { AuthService } from '../../core/services/auth/auth.service';
import { DictionaryService } from '../../core/services/dictionary/dictionary.service';
import { EventCategory } from '../../core/models/dictionary/event-category.model';
import { PostType, PostStatus, PostVisibility } from '../../core/models/common/enums';

@Component({
  selector: 'app-main-page',
  imports: [TranslatePipe, NgIcon, PostComponent, ReactiveFormsModule, Btn],
  viewProviders: [provideIcons({ heroMagnifyingGlass, heroPlus, heroFunnel, heroXMark })],
  templateUrl: './main-page.html',
  styleUrl: './main-page.scss',
})
export class MainPage implements OnInit {
  private http = inject(HttpClient);
  private postService = inject(PostService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  authService = inject(AuthService);
  private dictionaryService = inject(DictionaryService);

  searchControl = new FormControl('');

  categories = signal<EventCategory[]>([]);
  showFilters = signal(false);

  filtersForm = new FormGroup({
    categoryId: new FormControl(''),
    type: new FormControl(''),
    tags: new FormControl(''),
    startsFrom: new FormControl(''),
    startsTo: new FormControl(''),
    visibility: new FormControl(''),
    status: new FormControl(''),
  });

  posts = signal<PaginatedResponse<PostCard>>({
    items: [],
    page: { limit: 20, hasMore: false, nextCursor: null },
  });

  ngOnInit() {
    this.dictionaryService.getEventCategories().subscribe({
      next: (categories) => this.categories.set(categories),
      error: (err) => console.error('Error loading categories', err),
    });

    const search$ = this.searchControl.valueChanges.pipe(
      startWith(''),
      debounceTime(400),
      distinctUntilChanged(),
    );

    const filter$ = this.filtersForm.valueChanges.pipe(startWith(this.filtersForm.value));

    combineLatest([search$, filter$])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([search, filters]) => {
        const filterParams: PostFilterParams = {
          limit: 20,
          ...(search && { q: search }),
          ...(filters?.categoryId && { categoryId: filters.categoryId }),
          ...(filters?.type && { type: filters.type as PostType }),
          ...(filters?.tags && {
            tags: (filters.tags as string)
              .split(',')
              .map((t: string) => t.trim())
              .filter(Boolean),
          }),
          ...(filters?.startsFrom && { startsFrom: new Date(filters.startsFrom).toISOString() }),
          ...(filters?.startsTo && { startsFrom: new Date(filters.startsTo).toISOString() }),
          ...(filters?.visibility && { visibility: filters.visibility as PostVisibility }),
          ...(filters?.status && { status: filters.status as PostStatus }),
        };
        this.postService.getPosts(filterParams).subscribe({
          next: (data) => this.posts.set(data),
          error: (err) => console.error('Error while fetching posts', err),
        });
      });

    this.postService.clearActivePost();
  }

  toggleFilters(): void {
    this.showFilters.update((v) => !v);
  }

  clearFilters(): void {
    this.filtersForm.reset();
    this.searchControl.setValue('');
  }

  goToAddPost(): void {
    this.router.navigate(['/addPost']);
  }

  removeChild(idToRemove: string): void {
    this.posts.update((currentData) => ({
      ...currentData,
      items: currentData.items.filter((post) => String(post.id) !== String(idToRemove)),
    }));
  }
}
