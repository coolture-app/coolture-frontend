import { Component, Input } from '@angular/core';
import { CommentSummary } from '../../models/comments/comment-summary.model';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-comment-component',
  imports: [TranslatePipe],
  templateUrl: './comment-component.html',
  styleUrl: './comment-component.scss',
})
export class CommentComponent {
  @Input({ required: true }) comment!: CommentSummary;
}
