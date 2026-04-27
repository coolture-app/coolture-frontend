import { Component, inject, signal, OnInit, DestroyRef } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, switchMap, startWith } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroMagnifyingGlass } from '@ng-icons/heroicons/outline';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { PostComponent } from '../../core/components/post-component/post-component';
import { HttpClient } from '@angular/common/http';
import { PostCard } from '../../core/models/posts/post-card.model';
import { PostService } from '../../core/services/post/post.service';
import { DitheringFilter } from '../../core/components/filters/dithering-filter/dithering-filter';
import { PaginatedResponse } from '../../core/models/common/paginated-response.model';

@Component({
  selector: 'app-main-page',
  imports: [TranslatePipe, NgIcon, PostComponent, DitheringFilter, ReactiveFormsModule],
  viewProviders: [provideIcons({ heroMagnifyingGlass })],
  templateUrl: './main-page.html',
  styleUrl: './main-page.scss',
})
export class MainPage implements OnInit {
  private http = inject(HttpClient);
  private postService = inject(PostService);
  private destroyRef = inject(DestroyRef);

  searchControl = new FormControl('');

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
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (data) => this.posts.set(data),
        error: (err) => console.error('Error while fetching posts', err),
      });

    this.postService.clearActivePost();
  }

  removeChild(idToRemove: string) {
    this.posts.update((currentData) => {
      return {
        ...currentData,
        items: currentData.items.filter((post) => String(post.id) !== String(idToRemove)),
      };
    });
  }
}
