import { inject, Injectable } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';

/**
 * "Wróć" and "done" on a form. Going back in history, as the browser's Back does, lets the router put
 * the scroll back and the home page restore its list.
 */
@Injectable({
  providedIn: 'root',
})
export class BackService {
  private router = inject(Router);
  private location = inject(Location);

  /** Back when the page before is in this app. Otherwise `fallback`, in place of this page. */
  back(fallback: string): void {
    if (this.router.lastSuccessfulNavigation?.previousNavigation) {
      this.location.back();
    } else {
      void this.router.navigateByUrl(fallback, { replaceUrl: true });
    }
  }
}
