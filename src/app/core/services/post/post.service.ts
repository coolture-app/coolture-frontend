import { inject, Injectable, signal } from '@angular/core';
import { PostModel } from '../../models/posts/post.model';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { CreatePostModel } from '../../models/posts/createPost.model';
import { ApiUrlService } from '../api-url.service';

interface ApiPageResponse<T> {
  items: T[];
}

interface ApiUserSummary {
  id: string;
  username: string;
}

interface ApiMediaResource {
  url: string;
}

interface ApiPostBase {
  id: string;
  author: ApiUserSummary;
  startsAt: string;
  createdAt: string;
  description: string;
  title: string;
  positiveReactionCount: number;
  participantCount: number;
  commentsCount: number;
  coverMedia: ApiMediaResource | null;
}

interface ApiPostDetail extends ApiPostBase {
  media?: { media: ApiMediaResource }[];
}

@Injectable({
  providedIn: 'root',
})
export class PostService {
  private http = inject(HttpClient);
  private apiUrl = inject(ApiUrlService);

  //LAST SELECTED POST FOR FASTER LOADING AND LESS FETCHES
  readonly activePost = signal<PostModel | null>(null);
  setActivePost(post: PostModel): void {
    this.activePost.set(post);
  }
  clearActivePost(): void {
    this.activePost.set(null);
  }

  // ===== api calls =====
  getPosts(page: number, size: number): Observable<PostModel[]> {
    // Contract uses cursor+limit pagination; keep current signature for UI compatibility.
    console.log(`fetch page=${page}, limit=${size}`);
    return this.http
      .get<ApiPageResponse<ApiPostBase>>(this.apiUrl.path(`/posts?limit=${size}`))
      .pipe(map((response) => response.items.map((post) => this.mapFeedPost(post))));
  }

  getPost(id: string): Observable<PostModel> {
    return this.http
      .get<ApiPostDetail>(this.apiUrl.path(`/posts/${id}`))
      .pipe(map((post) => this.mapDetailPost(post)));
  }

  addPost(payload: CreatePostModel): Observable<PostModel> {
    return this.http
      .post<ApiPostDetail>(this.apiUrl.path('/posts'), payload)
      .pipe(map((post) => this.mapDetailPost(post)));
  }

  private mapFeedPost(post: ApiPostBase): PostModel {
    const coverUrl = post.coverMedia?.url;
    return {
      id: post.id,
      title: post.title,
      user: post.author,
      dateOfEvent: post.startsAt,
      dateOfPosting: post.createdAt,
      description: post.description,
      photos: coverUrl ? [coverUrl] : [],
      likesCount: post.positiveReactionCount,
      participatingCount: post.participantCount,
      commentCount: post.commentsCount,
      comments: [],
    };
  }

  private mapDetailPost(post: ApiPostDetail): PostModel {
    const mapped = this.mapFeedPost(post);
    if (!post.media?.length) {
      return mapped;
    }
    return {
      ...mapped,
      photos: post.media.map((item) => item.media.url),
    };
  }
}
