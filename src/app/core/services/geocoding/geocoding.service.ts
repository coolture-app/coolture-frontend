import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiUrlService } from '../api-url.service';

export interface NominatimAddress {
  road?: string;
  house_number?: string;
  suburb?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  state?: string;
  postcode?: string;
  country?: string;
  country_code?: string;
}

export interface NominatimSearchResult {
  place_id: number;
  licence: string;
  osm_type: string;
  osm_id: number;
  boundingbox: string[];
  lat: string;
  lon: string;
  display_name: string;
  class: string;
  type: string;
  importance: number;
  address: NominatimAddress;
}

const COUNTRY_MAP: Record<string, string> = {
  pl: 'POL',
  de: 'DEU',
  cz: 'CZE',
  sk: 'SVK',
  ua: 'UKR',
  lt: 'LTU',
  by: 'BLR',
  us: 'USA',
  gb: 'GBR',
  uk: 'GBR',
  fr: 'FRA',
  it: 'ITA',
  es: 'ESP',
  nl: 'NLD',
};

@Injectable({
  providedIn: 'root',
})
export class GeocodingService {
  private apiUrl = inject(ApiUrlService);
  private http = inject(HttpClient);

  search(query: string): Observable<NominatimSearchResult[]> {
    const url = `${this.apiUrl.oauthUrl}/nominatim/search`;
    return this.http.get<NominatimSearchResult[]>(url, {
      params: {
        format: 'json',
        q: query,
        addressdetails: '1',
        limit: '5',
        'accept-language': 'pl,en',
      },
    });
  }

  reverse(lat: number, lon: number): Observable<NominatimSearchResult> {
    const url = `${this.apiUrl.oauthUrl}/nominatim/reverse`;
    return this.http.get<NominatimSearchResult>(url, {
      params: {
        format: 'json',
        lat: lat.toString(),
        lon: lon.toString(),
        addressdetails: '1',
        'accept-language': 'pl,en',
      },
    });
  }

  mapCountryCode(nominatimCode?: string): string {
    if (!nominatimCode) {
      return 'POL';
    }
    const codeLower = nominatimCode.toLowerCase();
    return COUNTRY_MAP[codeLower] || 'POL';
  }
}
