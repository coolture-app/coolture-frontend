import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, switchMap, startWith, takeUntil } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroMagnifyingGlass, heroPlus } from '@ng-icons/heroicons/outline';

import { PostComponent } from '../../core/components/post-component/post-component';
import { HttpClient } from '@angular/common/http';
import { PostCard } from '../../core/models/posts/post-card.model';
import { PostService } from '../../core/services/post/post.service';
import { DitheringFilter } from '../../core/components/filters/dithering-filter/dithering-filter';
import { PaginatedResponse } from '../../core/models/common/paginated-response.model';
import { AuthService } from '../../core/services/auth/auth.service';

@Component({
  selector: 'app-main-page',
  imports: [TranslatePipe, NgIcon, PostComponent, DitheringFilter, ReactiveFormsModule],
  viewProviders: [provideIcons({ heroMagnifyingGlass, heroPlus })],
  templateUrl: './main-page.html',
  styleUrl: './main-page.scss',
})
export class MainPage implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private postService = inject(PostService);
  private router = inject(Router);
  authService = inject(AuthService);

  searchControl = new FormControl('');
  private destroy$ = new Subject<void>();

  posts = signal<PaginatedResponse<PostCard>>({
    items: [],
    page: { limit: 20, hasMore: false, nextCursor: null },
  });

  ngOnInit() {
    this.searchControl.valueChanges
      .pipe(
        startWith(''),
        debounceTime(400),
        distinctUntilChanged(),
        switchMap((query) => {
          const filters = query ? { limit: 20, q: query } : { limit: 20 };
          return this.postService.getPosts(filters);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (data) => this.posts.set(data),
        error: (err) => console.error('Error while fetching posts', err),
      });

    this.postService.clearActivePost();
  }

  goToAddPost(): void {
    this.router.navigate(['/addPost']);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
