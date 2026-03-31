import { Component, Input } from '@angular/core';
import { PostComment } from '../../models/posts/comments.model';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-comment-component',
  imports: [],
  templateUrl: './comment-component.html',
  styleUrl: './comment-component.scss',
})
export class CommentComponent {
  @Input({ required: true }) comment!: PostComment;
  get avatar() {
    return `${environment.apiUrl}/images/avatars/${this.comment.author.id}`;
  }
}
