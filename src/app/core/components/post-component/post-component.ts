import { Component, Input, signal } from '@angular/core';
import { PostModel } from '../../models/posts/post.model';

@Component({
  selector: 'app-post-component',
  imports: [],
  templateUrl: './post-component.html',
  styleUrl: './post-component.scss',
})
export class PostComponent {
  isExpanded = signal(false);
  maxLength = 150;

  ToggleExpanded() {
    this.isExpanded.update((v) => !v);
  }

  @Input() data!: PostModel;

  get photos() {
    return this.data.photos || [];
  }
}
