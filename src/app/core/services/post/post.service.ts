import { inject, Injectable, signal } from '@angular/core';
import { PostModel } from '../../models/posts/post.model';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { Observable } from 'rxjs';
import { CreatePostModel } from '../../models/posts/createPost.model';

@Injectable({
  providedIn: 'root',
})
export class PostService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  //LAST SELECTED POST FOR FASTER LOADING AND LESS FETCHES
  readonly activePost = signal<PostModel | null>(null);
  setActivePost(post: PostModel): void {
    this.activePost.set(post);
  }
  clearActivePost(): void {
    this.activePost.set(null);
  }

  // ===== api calls =====
  getPosts(page: Number, size: Number): Observable<PostModel[]> {
    //TODO FIX ENDPOINT SO THAT IT PASSES THE PAGE AND SIZE
    console.log(`${page} + ${size}`);
    return this.http.get<PostModel[]>(`${this.apiUrl}/posts`);
  }

  getPost(id: string): Observable<PostModel> {
    return this.http.get<PostModel>(`${this.apiUrl}/posts/${id}`);
  }

  addPost(payload: CreatePostModel, images?: File[]): Observable<PostModel> {
    const formData = new FormData();
    formData.append(
      'postData',
      new Blob([JSON.stringify(payload)], {
        type: 'application/json',
      }),
    );
    if (images) {
      images.forEach((file) => {
        formData.append('images', file);
      });
    }
    return this.http.post<PostModel>(`${this.apiUrl}/posts`, formData);
  }
}
