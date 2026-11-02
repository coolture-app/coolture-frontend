import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, Observable, shareReplay, throwError } from 'rxjs';
import { ApiUrlService } from '../api-url.service';
import { InterestCatalog, UserInterests } from '../../models/interests/interest.model';

@Injectable({
  providedIn: 'root',
})
export class InterestsService {
  private apiUrl = inject(ApiUrlService);
  private http = inject(HttpClient);
  private catalog: Observable<InterestCatalog> | null = null;

  getCatalog(): Observable<InterestCatalog> {
    this.catalog ??= this.http.get<InterestCatalog>(this.apiUrl.path('/dicts/interests')).pipe(
      catchError((error) => {
        this.catalog = null;
        return throwError(() => error);
      }),
      shareReplay(1),
    );
    return this.catalog;
  }

  getUserInterests(userId: string): Observable<UserInterests> {
    return this.http.get<UserInterests>(this.apiUrl.path(`/users/${userId}/interests`));
  }

  replaceUserInterests(userId: string, interests: string[]): Observable<UserInterests> {
    return this.http.put<UserInterests>(this.apiUrl.path(`/users/${userId}/interests`), {
      interests,
    });
  }
}
