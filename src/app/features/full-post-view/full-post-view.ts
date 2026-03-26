import {
  AfterViewInit,
  Component,
  ElementRef,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { PostComponent } from '../../core/components/post-component/post-component';
import { ActivatedRoute, Router } from '@angular/router';
import { CommentComponent } from '../../core/components/comment/comment-component';
import { PostService } from '../../core/services/post/post.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-full-post-view',
  imports: [PostComponent, CommentComponent, FormsModule],
  templateUrl: './full-post-view.html',
  styleUrl: './full-post-view.scss',
})
export class FullPostView implements OnInit, AfterViewInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private postService = inject(PostService);
  private isScrolling = false;

  commentSection = viewChild<ElementRef>('commentSection');
  commentInput = viewChild<ElementRef>('commentInput');
  commentContent = signal<string>('');
  isCommentFocused = signal<boolean>(false);
  post = this.postService.activePost;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    this.isScrolling = this.route.snapshot.queryParamMap.get('scrollToComments') === 'true';
    if (id) {
      if (!this.post()) {
        this.postService.getPost(id).subscribe({
          next: (data) => this.postService.setActivePost(data),
          error: (error) => console.log(error),
        });
      }
    } else {
      console.error('NO ID IN URL ERRRR');
    }
  }

  ngAfterViewInit(): void {
    if (this.isScrolling) {
      //the timeout is to ensure that the scrolling is turned on after page renders
      setTimeout(() => {
        this.commentSection()?.nativeElement.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }, 0);
    }
  }

  get comments() {
    return this.post()?.comments ?? [];
  }

  goBack() {
    this.router.navigate(['/']);
  }

  checkIfResize(): void {
    const textarea = this.commentInput()?.nativeElement;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }

  addComment(): void {
    alert('dodano komentarz:\n' + this.commentContent());
  }
}
