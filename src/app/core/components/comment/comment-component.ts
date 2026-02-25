import { Component, Input } from '@angular/core';
import { PostComment } from '../../models/posts/comments.model';

@Component({
  selector: 'app-comment-component',
  imports: [],
  templateUrl: './comment-component.html',
  styleUrl: './comment-component.scss',
})
export class CommentComponent {
  @Input({ required: true }) comment!: PostComment;
}
