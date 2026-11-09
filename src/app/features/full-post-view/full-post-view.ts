import {
  afterRenderEffect,
  Component,
  ElementRef,
  inject,
  OnInit,
  viewChild,
  DestroyRef,
} from '@angular/core';
import { Title } from '@angular/platform-browser';
import { PostComponent } from '../../core/components/post-component/post-component';
import { Btn } from '../../core/components/btn/btn';
import { ActivatedRoute, Router } from '@angular/router';
import { CommentThread } from '../../core/components/comment-thread/comment-thread';
import { PostService } from '../../core/services/post/post.service';
import { TranslatePipe } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BackService } from '../../core/services/back/back.service';
import { PostListStore } from '../../core/services/post-list/post-list.store';

@Component({
  selector: 'app-full-post-view',
  imports: [PostComponent, CommentThread, TranslatePipe, Btn],
  templateUrl: './full-post-view.html',
  styleUrl: './full-post-view.scss',
})
export class FullPostView implements OnInit {
  private route = inject(ActivatedRoute);
  private postService = inject(PostService);
  private destroyRef = inject(DestroyRef);
  private title = inject(Title);
  private backService = inject(BackService);
  private list = inject(PostListStore);
  private router = inject(Router);

  private isScrolling = false;

  commentSection = viewChild<ElementRef>('commentSection');
  post = this.postService.activePost;

  constructor() {
    // Once the comments are on the page, which can wait for the post to load. A frame and a task
    // later, so it comes after the router's own scroll to the top.
    afterRenderEffect(() => {
      const section = this.commentSection()?.nativeElement as HTMLElement | undefined;
      if (section && this.isScrolling) {
        this.isScrolling = false;
        requestAnimationFrame(() =>
          setTimeout(() => section.scrollIntoView({ behavior: 'smooth', block: 'start' })),
        );
      }
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    // Not on Back or Forward, where the router puts back the scroll the reader left.
    this.isScrolling =
      this.route.snapshot.fragment === 'comments' &&
      this.router.currentNavigation()?.trigger !== 'popstate';
    if (id) {
      if (!this.post() || this.post()?.id !== id) {
        this.postService
          .getPost(id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (data) => {
              this.postService.setActivePost(data);
              this.title.setTitle(data.title);
            },
            error: (error) => console.log(error),
          });
      }
    } else {
      console.error('NO ID IN URL ERRRR');
    }
  }

  /** As the browser's Back, so the list comes back where it was left. */
  goBack() {
    this.backService.back('/');
  }

  changeCount(by: number): void {
    const post = this.post();
    if (post) {
      const commentsCount = Math.max(0, (post.commentsCount || 0) + by);
      this.postService.setActivePost({ ...post, commentsCount });
    }
  }

  /** The post is gone, so it leaves the list it's going back to as well. */
  removeChild(id: string) {
    this.list.removeItem(id);
    this.backService.back('/');
  }
}
