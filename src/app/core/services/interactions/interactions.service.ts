import { inject, Injectable } from '@angular/core';
import { ApiUrlService } from '../api-url.service';
import { HttpClient } from '@angular/common/http';
import { ReactionRequest } from '../../models/interactions/reaction.model';
import { Observable } from 'rxjs';
import { ParticipationRequest } from '../../models/interactions/participation.model';

@Injectable({
  providedIn: 'root',
})
export class InteractionsService {
  private apiurl = inject(ApiUrlService);
  private http = inject(HttpClient);

  // === reactions ===
  setReaction(postId: string, payload: ReactionRequest): Observable<void> {
    return this.http.put<void>(this.apiurl.path(`/posts/${postId}/reaction`), payload);
  }

  removeReaction(postId: string): Observable<void> {
    return this.http.delete<void>(this.apiurl.path(`/posts/${postId}/reaction`));
  }

  // === participation ===
  setParticipation(postId: string, payload: ParticipationRequest): Observable<void> {
    return this.http.put<void>(this.apiurl.path(`/posts/${postId}/participation`), payload);
  }

  removeParticipation(postId: string): Observable<void> {
    return this.http.delete<void>(this.apiurl.path(`/posts/${postId}/participation`));
  }
}
