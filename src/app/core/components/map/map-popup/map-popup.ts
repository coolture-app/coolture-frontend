import { Component, input, inject } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-map-popup',
  templateUrl: './map-popup.html',
  styleUrls: ['./map-popup.scss'],
})
export class MapPopup {
  private router = inject(Router);

  postId = input.required<string>();
  popupTitle = input.required<string>();
  popupBody = input.required<string>();

  onTitleClick(): void {
    this.router.navigate(['/post', this.postId()]);
  }
}
