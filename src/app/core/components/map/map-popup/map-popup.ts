import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-map-popup',
  imports: [],
  templateUrl: './map-popup.html',
  styleUrl: './map-popup.scss',
})
export class MapPopup {
  @Input() popupTitle!: string;
  @Input() popupBody!: string;
}
