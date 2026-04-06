import { Component, Input, inject } from '@angular/core';
import { PostComment } from '../../models/posts/comments.model';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiUrlService } from '../../services/api-url.service';

@Component({
  selector: 'app-comment-component',
  imports: [TranslatePipe],
  templateUrl: './comment-component.html',
  styleUrl: './comment-component.scss',
})
export class CommentComponent {
  @Input({ required: true }) comment!: PostComment;
  private apiUrl = inject(ApiUrlService);
  get avatar() {
    return this.apiUrl.path(`/images/avatars/${this.comment.author.id}`);
  }
}
