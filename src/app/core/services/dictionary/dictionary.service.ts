import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiUrlService } from '../api-url.service';
import { CountryCode } from '../../models/dictionary/country-code.model';

@Injectable({
  providedIn: 'root',
})
export class DictionaryService {
  private apiUrl = inject(ApiUrlService);
  private http = inject(HttpClient);

  getCountryCodes(): Observable<CountryCode[]> {
    return this.http.get<CountryCode[]>(this.apiUrl.path('/dicts/country-codes'));
  }
}
