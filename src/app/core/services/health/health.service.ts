import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiUrlService } from '../api-url.service';

export interface HealthResponse {
  status: string;
}

@Injectable({
  providedIn: 'root',
})
export class Health {
  private apiurl = inject(ApiUrlService);
  private http = inject(HttpClient);

  checkHealth(): Observable<boolean> {
    return this.http
      .get<HealthResponse>(this.apiurl.path('/actuator/health'))
      .pipe(map((response) => response.status === 'UP'));
  }
}
