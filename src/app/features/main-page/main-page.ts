import { Component, inject, signal, OnInit } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroMagnifyingGlass } from '@ng-icons/heroicons/outline';

import { PostComponent } from '../../core/components/post-component/post-component';
import { HttpClient } from '@angular/common/http';
import { PostModel } from '../../core/models/posts/post.model';
import { PostService } from '../../core/services/post/post.service';
import { DitheringFilter } from '../../core/components/filters/dithering-filter/dithering-filter';

@Component({
  selector: 'app-main-page',
  imports: [TranslatePipe, NgIcon, PostComponent, DitheringFilter],
  viewProviders: [provideIcons({ heroMagnifyingGlass })],
  templateUrl: './main-page.html',
  styleUrl: './main-page.scss',
})
export class MainPage implements OnInit {
  private http = inject(HttpClient);
  private postService = inject(PostService);
  posts = signal<PostModel[]>([]);

  ngOnInit() {
    this.postService.getPosts().subscribe({
      next: (data) => this.posts.set(data),
      error: (err) => console.error('Error while fetching posts', err),
    });
    this.postService.clearActivePost();
  }
}
