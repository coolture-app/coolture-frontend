import { Injectable, signal } from '@angular/core';
import { PostModel } from '../../models/posts/post.model';

@Injectable({
  providedIn: 'root',
})
export class PostService {
  //LAST SELECTED POST FOR FASTER LOADING AND LESS FETCHES
  readonly activePost = signal<PostModel | null>(null);
  setActivePost(post: PostModel): void {
    this.activePost.set(post);
  }
  clearActivePost(): void {
    this.activePost.set(null);
  }
}
