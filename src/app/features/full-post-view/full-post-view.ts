import { Component, inject, OnInit, PLATFORM_ID } from '@angular/core';
import { PostComponent } from '../../core/components/post-component/post-component';
import { PostModel } from '../../core/models/posts/post.model';
import { ActivatedRoute, Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { CommentComponent } from '../../core/components/comment/comment-component';

@Component({
  selector: 'app-full-post-view',
  imports: [PostComponent, CommentComponent],
  templateUrl: './full-post-view.html',
  styleUrl: './full-post-view.scss',
})
export class FullPostView implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);
  post!: PostModel;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (isPlatformBrowser(this.platformId)) {
      this.post = window.history.state['postData'];
    }

    if (!this.post) {
      //fetch post with given id from db
    }
  }

  get comments() {
    return this.post.comments || [];
  }

  goBack() {
    this.router.navigate(['/']);
  }
}
