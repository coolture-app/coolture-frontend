import { inject, Injectable, signal } from '@angular/core';
import { PostModel } from '../../models/posts/post.model';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { Observable } from 'rxjs';

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

  getPosts(): Observable<PostModel[]> {
    return this.http.get<PostModel[]>(`${this.apiUrl}/posts`);
  }

  getPost(id: string): Observable<PostModel> {
    return this.http.get<PostModel>(`${this.apiUrl}/posts/${id}`);
  }
}
